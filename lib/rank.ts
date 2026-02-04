import { prisma } from "@/lib/db";
import { cosine } from "@/lib/embeddings";

import { ALGORITHM_VERSION } from "@/lib/constants";
export { ALGORITHM_VERSION };
const PAGE_SIZE = 20;
const MAX_AGE_DAYS = 30;
const SOURCE_CAP_TOP_20 = 2;
const EXPLORE_RATE = 0.15;
const MMR_LAMBDA = 0.8;

interface RankedArticle {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date;
  author: string | null;
  feedSource: {
    id: string;
    title: string;
    siteUrl: string | null;
  };
  topics: { slug: string; label: string }[];
  score: number;
  candidateSources: string[];
  scoreBreakdown: {
    topicRelevance: number;
    freshness: number;
    subscribed: number;
    sourceAffinity: number;
    qualityScore: number;
    seenPenalty: number;
    vectorSimilarity: number;
  };
  _embedding?: number[];
}

export async function rankFeed(
  userId: string,
  cursor?: string
): Promise<{ items: RankedArticle[]; nextCursor: string | null; feedRequestId: string }> {
  const feedRequestId = crypto.randomUUID();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);

  // Fetch user state
  const [topicWeights, subscriptions, affinities, recentImpressions, userEmbedding] =
    await Promise.all([
      prisma.userTopicWeight.findMany({ where: { userId } }),
      prisma.userSourceSubscription.findMany({
        where: { userId },
        select: { feedSourceId: true },
      }),
      prisma.userSourceAffinity.findMany({ where: { userId } }),
      prisma.impressionEvent.findMany({
        where: {
          userId,
          shownAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { articleId: true },
      }),
      prisma.userEmbedding.findUnique({ where: { userId } }),
    ]);

  const subscribedIds = new Set(subscriptions.map((s) => s.feedSourceId));
  const topicWeightMap = new Map(topicWeights.map((tw) => [tw.topicId, tw.weight]));
  const affinityMap = new Map(affinities.map((a) => [a.feedSourceId, a.weight]));
  const recentlyShown = new Set(recentImpressions.map((i) => i.articleId));

  // Hidden articles (HIDE interactions)
  const hiddenArticles = await prisma.interactionEvent.findMany({
    where: { userId, type: "HIDE" },
    select: { articleId: true },
  });
  const hiddenIds = new Set(hiddenArticles.map((h) => h.articleId));

  // Generate candidates from multiple sources
  const topicIds = topicWeights
    .filter((tw) => tw.weight > 0)
    .map((tw) => tw.topicId);

  // Vector candidates (if user has embedding)
  let vectorCandidateIds = new Set<string>();
  let vectorSimilarities = new Map<string, number>();

  if (userEmbedding?.embedding?.length) {
    try {
      const vecStr = `[${userEmbedding.embedding.join(",")}]`;
      const vectorResults: { articleId: string; distance: number }[] =
        await prisma.$queryRawUnsafe(
          `SELECT ae."articleId", ae."embedding" <=> $1::vector AS distance
           FROM "ArticleEmbedding" ae
           JOIN "Article" a ON ae."articleId" = a."id"
           WHERE a."publishedAt" > $2
             AND ae."embedding" IS NOT NULL
           ORDER BY ae."embedding" <=> $1::vector
           LIMIT 200`,
          vecStr,
          cutoffDate
        );

      for (const r of vectorResults) {
        vectorCandidateIds.add(r.articleId);
        // Convert distance to similarity (cosine distance = 1 - cosine similarity)
        vectorSimilarities.set(r.articleId, 1 - r.distance);
      }
    } catch {
      // Vector search not available yet, fall back
    }
  }

  // Topic + subscription candidates
  const candidateArticles = await prisma.article.findMany({
    where: {
      publishedAt: { gte: cutoffDate },
      id: { notIn: Array.from(hiddenIds) },
      OR: [
        { feedSourceId: { in: Array.from(subscribedIds) } },
        {
          feedSource: {
            topics: { some: { topicId: { in: topicIds.length ? topicIds : ["_none_"] } } },
          },
        },
        { id: { in: Array.from(vectorCandidateIds) } },
      ],
    },
    include: {
      feedSource: {
        include: {
          topics: { include: { topic: true } },
        },
      },
      stats: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 500,
  });

  // Score and rank
  const scored: RankedArticle[] = candidateArticles.map((article) => {
    const isSubscribed = subscribedIds.has(article.feedSourceId);
    const sourceAff = affinityMap.get(article.feedSourceId) || 0;

    // Topic relevance
    const articleTopicIds = article.feedSource.topics.map((t) => t.topicId);
    const topicScores = articleTopicIds
      .map((tid) => topicWeightMap.get(tid) || 0)
      .filter((w) => w > 0);
    const topicRelevance =
      topicScores.length > 0
        ? topicScores.reduce((a, b) => a + b, 0) / topicScores.length
        : 0;

    // Freshness
    const ageHours =
      (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60);
    const tau = 48;
    const freshness = Math.exp(-ageHours / tau);

    const qualityScore = article.stats?.qualityScore || 0;
    const seenPenalty = recentlyShown.has(article.id) ? 1 : 0;
    const vectorSimilarity = vectorSimilarities.get(article.id) || 0;

    // Hybrid scoring (spec formula + vector similarity)
    const score =
      1.5 * Math.max(topicRelevance, vectorSimilarity) +
      0.8 * freshness +
      0.6 * (isSubscribed ? 1 : 0) +
      0.4 * Math.max(0, Math.min(1, sourceAff)) +
      0.3 * qualityScore -
      1.0 * seenPenalty;

    const candidateSources: string[] = [];
    if (isSubscribed) candidateSources.push("SUBSCRIBED");
    if (topicRelevance > 0) candidateSources.push("TOPIC");
    if (vectorSimilarity > 0.3) candidateSources.push("VECTOR");
    if (qualityScore > 0.5) candidateSources.push("TRENDING");

    return {
      id: article.id,
      title: article.title,
      url: article.url,
      summary: article.summary,
      publishedAt: article.publishedAt,
      author: article.author,
      feedSource: {
        id: article.feedSource.id,
        title: article.feedSource.title,
        siteUrl: article.feedSource.siteUrl,
      },
      topics: article.feedSource.topics.map((t) => ({
        slug: t.topic.slug,
        label: t.topic.label,
      })),
      score,
      candidateSources,
      scoreBreakdown: {
        topicRelevance,
        freshness,
        subscribed: isSubscribed ? 1 : 0,
        sourceAffinity: sourceAff,
        qualityScore,
        seenPenalty,
        vectorSimilarity,
      },
    };
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  // Re-rank with constraints + MMR diversity
  const reranked = rerankWithConstraints(scored);

  // Inject exploration items
  const withExplore = injectExploration(reranked, EXPLORE_RATE);

  // Apply cursor pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIdx = withExplore.findIndex((a) => a.id === cursor);
    if (cursorIdx >= 0) startIndex = cursorIdx + 1;
  }

  const items = withExplore
    .slice(startIndex, startIndex + PAGE_SIZE)
    .map(({ _embedding, ...rest }) => rest);
  const nextCursor =
    items.length === PAGE_SIZE ? items[items.length - 1].id : null;

  return { items, nextCursor, feedRequestId };
}

function rerankWithConstraints(articles: RankedArticle[]): RankedArticle[] {
  const result: RankedArticle[] = [];
  const sourceCount = new Map<string, number>();
  const remaining = [...articles];

  while (result.length < Math.min(100, remaining.length + result.length) && remaining.length > 0) {
    let bestIdx = -1;
    let bestVal = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const a = remaining[i];
      const count = sourceCount.get(a.feedSource.id) || 0;

      // Hard constraint: source cap in top 20
      if (result.length < 20 && count >= SOURCE_CAP_TOP_20) continue;

      // MMR diversity penalty (using score breakdown as proxy when no embeddings)
      let diversityPenalty = 0;
      if (result.length > 0) {
        // Penalize articles from same source or very similar topic mix
        diversityPenalty = result.reduce((max, s) => {
          if (s.feedSource.id === a.feedSource.id) return Math.max(max, 0.8);
          const sharedTopics = a.topics.filter((t) =>
            s.topics.some((st) => st.slug === t.slug)
          ).length;
          const topicOverlap =
            sharedTopics /
            Math.max(1, Math.max(a.topics.length, s.topics.length));
          return Math.max(max, topicOverlap * 0.5);
        }, 0);
      }

      const val = MMR_LAMBDA * a.score - (1 - MMR_LAMBDA) * diversityPenalty;
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) break;

    const selected = remaining[bestIdx];
    result.push(selected);
    sourceCount.set(
      selected.feedSource.id,
      (sourceCount.get(selected.feedSource.id) || 0) + 1
    );
    remaining.splice(bestIdx, 1);
  }

  return result;
}

function injectExploration(
  articles: RankedArticle[],
  rate: number
): RankedArticle[] {
  // Mark every Nth item as an explore slot
  const interval = Math.round(1 / rate);
  return articles.map((article, i) => {
    if ((i + 1) % interval === 0 && !article.candidateSources.includes("EXPLORE")) {
      return {
        ...article,
        candidateSources: [...article.candidateSources, "EXPLORE"],
      };
    }
    return article;
  });
}
