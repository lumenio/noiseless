import { prisma } from "@/lib/db";

const PAGE_SIZE = 20;
const OVERFETCH_MULTIPLIER = 10;
const MAX_AGE_DAYS = 30;
const SOURCE_CAP_TOP_20 = 2;

interface PublicArticle {
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
  };
}

export async function publicFeed(
  topicSlug?: string,
  cursor?: string
): Promise<{ items: PublicArticle[]; nextCursor: string | null }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);

  // Resolve cursor for composite pagination (dateEstimated ASC, publishedAt DESC, id DESC)
  let cursorArticleData: { publishedAt: Date; dateEstimated: boolean } | undefined;
  let cursorId: string | undefined;
  if (cursor) {
    const cursorArticle = await prisma.article.findUnique({
      where: { id: cursor },
      select: { publishedAt: true, dateEstimated: true },
    });
    if (cursorArticle) {
      cursorArticleData = cursorArticle;
      cursorId = cursor;
    }
  }

  // Build cursor filter for sort order: dateEstimated ASC, publishedAt DESC, id DESC
  let cursorFilter = {};
  if (cursorArticleData && cursorId) {
    if (!cursorArticleData.dateEstimated) {
      // Cursor is in the dateEstimated=false group
      cursorFilter = {
        OR: [
          // Same group, older or same-time-lower-id
          {
            dateEstimated: false,
            OR: [
              { publishedAt: { lt: cursorArticleData.publishedAt } },
              { publishedAt: cursorArticleData.publishedAt, id: { lt: cursorId } },
            ],
          },
          // Next group (dateEstimated=true)
          { dateEstimated: true },
        ],
      };
    } else {
      // Cursor is in the dateEstimated=true group
      cursorFilter = {
        dateEstimated: true,
        OR: [
          { publishedAt: { lt: cursorArticleData.publishedAt } },
          { publishedAt: cursorArticleData.publishedAt, id: { lt: cursorId } },
        ],
      };
    }
  }

  const articles = await prisma.article.findMany({
    where: {
      publishedAt: { gte: cutoffDate },
      feedSource: {
        isPreinstalled: true,
        ...(topicSlug
          ? { topics: { some: { topic: { slug: topicSlug } } } }
          : {}),
      },
      ...cursorFilter,
    },
    include: {
      feedSource: {
        include: {
          topics: { include: { topic: true } },
        },
      },
    },
    orderBy: [{ dateEstimated: "asc" }, { publishedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE * OVERFETCH_MULTIPLIER,
  });

  // Apply source diversity: max SOURCE_CAP_TOP_20 per source in first 20 items
  const selected: typeof articles = [];
  const sourceCount = new Map<string, number>();

  for (const article of articles) {
    if (selected.length >= PAGE_SIZE) break;

    const count = sourceCount.get(article.feedSourceId) || 0;
    if (selected.length < 20 && count >= SOURCE_CAP_TOP_20) continue;

    selected.push(article);
    sourceCount.set(article.feedSourceId, count + 1);
  }

  const items: PublicArticle[] = selected.map((article) => ({
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
    },
    topics: article.feedSource.topics.map((t) => ({
      slug: t.topic.slug,
      label: t.topic.label,
    })),
    score: 0,
    candidateSources: ["PUBLIC"],
    scoreBreakdown: {
      topicRelevance: 0,
      freshness: 0,
      subscribed: 0,
      sourceAffinity: 0,
      qualityScore: 0,
      seenPenalty: 0,
    },
  }));

  const nextCursor =
    items.length === PAGE_SIZE ? items[items.length - 1].id : null;

  return { items, nextCursor };
}
