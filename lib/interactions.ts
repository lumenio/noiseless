import { prisma } from "@/lib/db";
import { InteractionType } from "@/lib/generated/prisma/client";
import { getInteractionWeight, updateUserEmbedding } from "@/lib/embeddings";

const TOPIC_WEIGHT_DELTA = 0.2;
const WEIGHT_MIN = -3;
const WEIGHT_MAX = 3;

export async function recordInteraction(
  userId: string,
  articleId: string,
  type: InteractionType,
  value?: number
) {
  // Create interaction event
  await prisma.interactionEvent.create({
    data: { userId, articleId, type, value },
  });

  // Atomically increment ArticleStats so counts are visible immediately
  if (type === "LIKE" || type === "SAVE") {
    const field = type === "LIKE" ? "likes" : "saves";
    await prisma.articleStats.upsert({
      where: { articleId },
      create: { articleId, [field]: 1 },
      update: { [field]: { increment: 1 } },
    });
  }

  // Fire-and-forget: update user embedding based on article embedding
  const embWeight = getInteractionWeight(type, value ?? undefined);
  if (embWeight !== 0) {
    updateUserEmbeddingForArticle(userId, articleId, embWeight).catch((err) =>
      console.error("Failed to update user embedding:", err)
    );
  }

  // Update topic weights for relevant interaction types (including OPEN for dwell-based learning)
  if (["LIKE", "DISLIKE", "HIDE", "SAVE", "OPEN"].includes(type)) {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: {
        feedSource: {
          include: { topics: true },
        },
      },
    });

    if (article) {
      // For OPEN events, only update topic weights if meaningful dwell time
      const isOpen = type === "OPEN";
      const dwellSeconds = value ?? 0;
      if (isOpen && dwellSeconds < 10) {
        // Short dwell — skip topic weight update but still update source affinity below
      } else {
        const delta =
          type === "LIKE" || type === "SAVE" || (isOpen && dwellSeconds >= 10)
            ? TOPIC_WEIGHT_DELTA
            : -TOPIC_WEIGHT_DELTA;

        // Atomic upsert with clamped weight via raw SQL
        await Promise.all(
          article.feedSource.topics.map((fst) =>
            prisma.$executeRawUnsafe(
              `INSERT INTO "UserTopicWeight" ("userId", "topicId", "weight", "updatedAt")
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT ("userId", "topicId")
               DO UPDATE SET
                 "weight" = GREATEST(${WEIGHT_MIN}, LEAST(${WEIGHT_MAX}, "UserTopicWeight"."weight" + $3)),
                 "updatedAt" = NOW()`,
              userId,
              fst.topicId,
              delta
            )
          )
        );
      }

      // Update source affinity
      const affinityDelta =
        type === "LIKE" || type === "SAVE" || (isOpen && dwellSeconds >= 60)
          ? 0.3
          : type === "DISLIKE" || type === "HIDE"
            ? -0.3
            : 0;

      if (affinityDelta !== 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "UserSourceAffinity" ("userId", "feedSourceId", "weight", "updatedAt")
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT ("userId", "feedSourceId")
           DO UPDATE SET
             "weight" = GREATEST(${WEIGHT_MIN}, LEAST(${WEIGHT_MAX}, "UserSourceAffinity"."weight" + $3)),
             "updatedAt" = NOW()`,
          userId,
          article.feedSourceId,
          affinityDelta
        );
      }
    }
  }
}

async function updateUserEmbeddingForArticle(
  userId: string,
  articleId: string,
  weight: number
) {
  // Fetch article embedding via raw SQL (pgvector stores as vector type)
  const rows: { embedding: string }[] = await prisma.$queryRawUnsafe(
    `SELECT "embedding"::text FROM "ArticleEmbedding" WHERE "articleId" = $1 AND "embedding" IS NOT NULL`,
    articleId
  );

  if (rows.length === 0) return;

  const articleEmbedding = JSON.parse(rows[0].embedding) as number[];
  await updateUserEmbedding(userId, articleEmbedding, weight);
}
