import { prisma } from "@/lib/db";
import { cosine } from "@/lib/embeddings";

import { ALGORITHM_VERSION } from "@/lib/constants";
export { ALGORITHM_VERSION };
const PAGE_SIZE = 20;
const MAX_AGE_DAYS = 30;
const SOURCE_CAP_TOP_20 = 2;
const EXPLORE_RATE = 0.15;
const MMR_LAMBDA = 0.8;
const TRENDING_LIMIT = 50;
const EXPLORE_POOL_SIZE = 20;

interface RankedArticle {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date;
  dateEstimated: boolean;
  author: string | null;
  feedSource: {
    id: string;
    title: string;
    siteUrl: string | null;
    description: string | null;
    subscribed: boolean;
  };
  topics: { slug: string; label: string }[];
  score: number;
  likes: number;
  saves: number;
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
  const [topicWeights, subscriptions, affinities, recentImpressions, userEmbedding, hiddenSources] =
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
      prisma.userHiddenSource.findMany({
        where: { userId },
        select: { feedSourceId: true },
      }),
    ]);

  const subscribedIds = new Set(subscriptions.map((s) => s.feedSourceId));
  const hiddenSourceIds = new Set(hiddenSources.map((h) => h.feedSourceId));
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

  // Trending candidates — articles with highest engagement in last 7 days
  const trendingCutoff = new Date();
  trendingCutoff.setDate(trendingCutoff.getDate() - 7);
  let trendingIds = new Set<string>();

  try {
    const trendingRows: { articleId: string }[] = await prisma.$queryRawUnsafe(
      `SELECT s."articleId"
       FROM "ArticleStats" s
       JOIN "Article" a ON s."articleId" = a."id"
       WHERE a."publishedAt" > $1
         AND (s."likes" > 0 OR s."opens" > 0)
       ORDER BY (s."likes" * 3 + s."saves" * 5 + s."opens") DESC
       LIMIT $2`,
      trendingCutoff,
      TRENDING_LIMIT
    );
    trendingIds = new Set(trendingRows.map((r) => r.articleId));
  } catch {
    // ArticleStats may not be populated yet
  }

  // Topic + subscription + vector + trending candidates
  const candidateArticles = await prisma.article.findMany({
    where: {
      publishedAt: { gte: cutoffDate },
      id: { notIn: Array.from(hiddenIds) },
      feedSourceId: { notIn: Array.from(hiddenSourceIds) },
      OR: [
        { feedSourceId: { in: Array.from(subscribedIds) } },
        {
          feedSource: {
            topics: { some: { topicId: { in: topicIds.length ? topicIds : ["_none_"] } } },
          },
        },
        { id: { in: Array.from(vectorCandidateIds) } },
        { id: { in: Array.from(trendingIds) } },
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

    // Freshness (neutral for articles with no real date)
    const freshness = article.dateEstimated
      ? 0.3
      : Math.exp(-(Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60) / 48);

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
    if (trendingIds.has(article.id)) candidateSources.push("TRENDING");

    return {
      id: article.id,
      title: article.title,
      url: article.url,
      summary: article.summary,
      publishedAt: article.publishedAt,
      dateEstimated: article.dateEstimated,
      author: article.author,
      feedSource: {
        id: article.feedSource.id,
        title: article.feedSource.title,
        siteUrl: article.feedSource.siteUrl,
        description: article.feedSource.description,
        subscribed: isSubscribed,
      },
      topics: article.feedSource.topics.map((t) => ({
        slug: t.topic.slug,
        label: t.topic.label,
      })),
      score,
      likes: article.stats?.likes ?? 0,
      saves: article.stats?.saves ?? 0,
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

  // Fetch real embeddings for top candidates to use in MMR diversity
  const topCandidateIds = scored.slice(0, 200).map((a) => a.id);
  const embeddingMap = await fetchArticleEmbeddings(topCandidateIds);
  for (const article of scored) {
    const emb = embeddingMap.get(article.id);
    if (emb) article._embedding = emb;
  }

  // Re-rank with constraints + MMR diversity
  const reranked = rerankWithConstraints(scored);

  // Inject exploration items from DB
  const candidateIdSet = new Set(scored.map((a) => a.id));
  const candidateSourceIdSet = new Set(scored.map((a) => a.feedSource.id));
  const withExplore = await injectExploration(
    reranked,
    EXPLORE_RATE,
    userId,
    candidateIdSet,
    candidateSourceIdSet,
    hiddenIds,
    hiddenSourceIds,
    cutoffDate,
    subscribedIds
  );

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

async function fetchArticleEmbeddings(
  articleIds: string[]
): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  if (articleIds.length === 0) return map;

  try {
    const rows: { articleId: string; embedding: string }[] =
      await prisma.$queryRawUnsafe(
        `SELECT "articleId", "embedding"::text
         FROM "ArticleEmbedding"
         WHERE "articleId" = ANY($1)
           AND "embedding" IS NOT NULL`,
        articleIds
      );

    for (const row of rows) {
      map.set(row.articleId, JSON.parse(row.embedding) as number[]);
    }
  } catch {
    // Embeddings not available
  }

  return map;
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

      // MMR diversity penalty using real embeddings when available, topic overlap as fallback
      let diversityPenalty = 0;
      if (result.length > 0) {
        diversityPenalty = result.reduce((max, s) => {
          // Same source: high penalty
          if (s.feedSource.id === a.feedSource.id) return Math.max(max, 0.8);

          // Use real embedding cosine similarity when both have embeddings
          if (a._embedding && s._embedding) {
            return Math.max(max, cosine(a._embedding, s._embedding));
          }

          // Fallback: topic overlap proxy
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

async function injectExploration(
  articles: RankedArticle[],
  rate: number,
  userId: string,
  existingIds: Set<string>,
  existingSourceIds: Set<string>,
  hiddenIds: Set<string>,
  hiddenSourceIds: Set<string>,
  cutoffDate: Date,
  subscribedIds: Set<string>
): Promise<RankedArticle[]> {
  const interval = Math.round(1 / rate);

  // Fetch novel exploration candidates from DB
  let explorePool: RankedArticle[] = [];
  try {
    const excludeArticleIds = Array.from(existingIds);
    const excludeSourceIds = Array.from(
      new Set([...existingSourceIds, ...hiddenSourceIds])
    );
    const hiddenArticleIds = Array.from(hiddenIds);

    // Find recent articles from sources the user hasn't seen in this feed,
    // preferring preinstalled (quality floor)
    const exploreRows = await prisma.article.findMany({
      where: {
        publishedAt: { gte: cutoffDate },
        id: { notIn: [...excludeArticleIds, ...hiddenArticleIds] },
        feedSourceId: { notIn: excludeSourceIds },
        feedSource: { isPreinstalled: true },
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
      take: EXPLORE_POOL_SIZE * 3, // fetch extra so we can randomize
    });

    // Shuffle and take EXPLORE_POOL_SIZE
    const shuffled = exploreRows.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, EXPLORE_POOL_SIZE);

    explorePool = selected.map((article) => {
      const isSubscribed = subscribedIds.has(article.feedSourceId);
      return {
        id: article.id,
        title: article.title,
        url: article.url,
        summary: article.summary,
        publishedAt: article.publishedAt,
        dateEstimated: article.dateEstimated,
        author: article.author,
        feedSource: {
          id: article.feedSource.id,
          title: article.feedSource.title,
          siteUrl: article.feedSource.siteUrl,
          description: article.feedSource.description,
          subscribed: isSubscribed,
        },
        topics: article.feedSource.topics.map((t) => ({
          slug: t.topic.slug,
          label: t.topic.label,
        })),
        score: 0.5, // minimum score floor — visible but not dominant
        likes: article.stats?.likes ?? 0,
        saves: article.stats?.saves ?? 0,
        candidateSources: ["EXPLORE"],
        scoreBreakdown: {
          topicRelevance: 0,
          freshness: 0.3,
          subscribed: 0,
          sourceAffinity: 0,
          qualityScore: 0,
          seenPenalty: 0,
          vectorSimilarity: 0,
        },
      };
    });
  } catch {
    // If explore query fails, continue without exploration
  }

  // Insert exploration items at every Nth position
  if (explorePool.length === 0) return articles;

  const result: RankedArticle[] = [];
  let exploreIdx = 0;

  for (let i = 0; i < articles.length; i++) {
    result.push(articles[i]);
    // After every interval items, inject an exploration item
    if ((i + 1) % interval === 0 && exploreIdx < explorePool.length) {
      result.push(explorePool[exploreIdx]);
      exploreIdx++;
    }
  }

  return result;
}
