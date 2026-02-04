import OpenAI from "openai";
import { prisma } from "@/lib/db";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;
const EMA_LR = 0.05;

let openaiClient: OpenAI | null = null;

function getOpenAI() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export async function computeEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

export async function computeArticleEmbeddings(batchSize: number = 50) {
  // Find articles without embeddings
  const articles = await prisma.article.findMany({
    where: { embedding: null },
    select: { id: true, title: true, summary: true },
    take: batchSize,
    orderBy: { createdAt: "desc" },
  });

  let processed = 0;

  for (const article of articles) {
    const text = [article.title, article.summary].filter(Boolean).join(". ");
    if (!text) continue;

    try {
      const embedding = await computeEmbedding(text);

      // Store via raw SQL for pgvector
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ArticleEmbedding" ("articleId", "embedding", "model", "createdAt")
         VALUES ($1, $2::vector, $3, NOW())
         ON CONFLICT ("articleId") DO UPDATE SET
           "embedding" = $2::vector,
           "model" = $3`,
        article.id,
        `[${embedding.join(",")}]`,
        EMBEDDING_MODEL
      );

      // Also store the text
      await prisma.articleText.upsert({
        where: { articleId: article.id },
        update: { extractedText: text },
        create: {
          articleId: article.id,
          extractedText: text,
        },
      });

      processed++;
    } catch (err) {
      console.error(`Failed to embed article ${article.id}:`, err);
    }
  }

  return { processed, total: articles.length };
}

function normalize(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vec;
  return vec.map((v) => v / magnitude);
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function updateUserEmbedding(
  userId: string,
  articleEmbedding: number[],
  interactionWeight: number
) {
  const existing = await prisma.userEmbedding.findUnique({
    where: { userId },
  });

  let newEmbedding: number[];

  if (!existing) {
    // Initialize from article embedding
    newEmbedding = normalize(
      articleEmbedding.map((v) => v * Math.abs(interactionWeight))
    );
  } else {
    const userVec = existing.embedding;
    const lr = EMA_LR;

    if (interactionWeight > 0) {
      newEmbedding = normalize(
        userVec.map(
          (u, i) => (1 - lr) * u + lr * interactionWeight * articleEmbedding[i]
        )
      );
    } else {
      newEmbedding = normalize(
        userVec.map(
          (u, i) =>
            (1 - lr) * u -
            lr * Math.abs(interactionWeight) * articleEmbedding[i]
        )
      );
    }
  }

  await prisma.userEmbedding.upsert({
    where: { userId },
    update: {
      embedding: newEmbedding,
      version: { increment: 1 },
    },
    create: {
      userId,
      embedding: newEmbedding,
      model: EMBEDDING_MODEL,
    },
  });
}

export async function initializeUserEmbedding(userId: string) {
  // Get user's selected topics
  const topicWeights = await prisma.userTopicWeight.findMany({
    where: { userId, weight: { gt: 0 } },
    include: { topic: true },
  });

  if (topicWeights.length === 0) return;

  const topicIds = topicWeights.map((tw) => tw.topicId);

  // Get recent articles from those topics with embeddings
  const recentArticles: { embedding: string }[] = await prisma.$queryRaw`
    SELECT ae."embedding"::text
    FROM "ArticleEmbedding" ae
    JOIN "Article" a ON ae."articleId" = a."id"
    JOIN "FeedSource" fs ON a."feedSourceId" = fs."id"
    JOIN "FeedSourceTopic" fst ON fst."feedSourceId" = fs."id"
    WHERE fst."topicId" = ANY(${topicIds})
      AND a."publishedAt" > NOW() - INTERVAL '30 days'
      AND ae."embedding" IS NOT NULL
    ORDER BY a."publishedAt" DESC
    LIMIT 100
  `;

  if (recentArticles.length === 0) return;

  // Average the embeddings
  const avgEmbedding = new Array(EMBEDDING_DIM).fill(0);
  for (const row of recentArticles) {
    const vec = JSON.parse(row.embedding) as number[];
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      avgEmbedding[i] += vec[i];
    }
  }
  const normalized = normalize(
    avgEmbedding.map((v) => v / recentArticles.length)
  );

  await prisma.userEmbedding.upsert({
    where: { userId },
    update: { embedding: normalized },
    create: {
      userId,
      embedding: normalized,
      model: EMBEDDING_MODEL,
    },
  });
}

// Interaction weights for user embedding updates
export const INTERACTION_WEIGHTS: Record<string, number> = {
  SAVE: 3.0,
  LIKE: 2.0,
  OPEN_LONG: 1.5,
  OPEN_MEDIUM: 1.0,
  OPEN_SHORT: 0.2,
  DISLIKE: -2.0,
  HIDE: -3.0,
};

export function getInteractionWeight(
  type: string,
  dwellSeconds?: number
): number {
  if (type === "OPEN" && dwellSeconds !== undefined) {
    if (dwellSeconds >= 60) return INTERACTION_WEIGHTS.OPEN_LONG;
    if (dwellSeconds >= 10) return INTERACTION_WEIGHTS.OPEN_MEDIUM;
    return INTERACTION_WEIGHTS.OPEN_SHORT;
  }
  return INTERACTION_WEIGHTS[type] ?? 0;
}
