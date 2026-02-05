import { prisma } from "@/lib/db";
import { parseFeed } from "./parseFeed";

const BATCH_SIZE = 25;

export async function ingestBatch(): Promise<{
  sourcesProcessed: number;
  articlesCreated: number;
  errors: string[];
}> {
  // Select sources with oldest lastFetchedAt first
  const sources = await prisma.feedSource.findMany({
    orderBy: [
      { lastFetchedAt: { sort: "asc", nulls: "first" } },
    ],
    take: BATCH_SIZE,
  });

  let articlesCreated = 0;
  const errors: string[] = [];

  for (const source of sources) {
    try {
      const result = await parseFeed(source.url, {
        etag: source.etag,
        lastModified: source.lastModified,
      });

      for (const article of result.articles) {
        try {
          // Dedupe by guid first, then by url
          const existing = article.guid
            ? await prisma.article.findUnique({
                where: {
                  feedSourceId_guid: {
                    feedSourceId: source.id,
                    guid: article.guid,
                  },
                },
                select: { id: true, content: true, summary: true },
              })
            : null;

          if (existing) {
            if ((existing.content === null && article.content) || (existing.summary === null && article.summary)) {
              await prisma.article.update({
                where: { id: existing.id },
                data: {
                  ...(existing.content === null && article.content ? { content: article.content } : {}),
                  ...(existing.summary === null && article.summary ? { summary: article.summary } : {}),
                },
              });
            }
            continue;
          }

          const existingByUrl = await prisma.article.findUnique({
            where: {
              feedSourceId_url: {
                feedSourceId: source.id,
                url: article.url,
              },
            },
            select: { id: true, content: true, summary: true },
          });

          if (existingByUrl) {
            if ((existingByUrl.content === null && article.content) || (existingByUrl.summary === null && article.summary)) {
              await prisma.article.update({
                where: { id: existingByUrl.id },
                data: {
                  ...(existingByUrl.content === null && article.content ? { content: article.content } : {}),
                  ...(existingByUrl.summary === null && article.summary ? { summary: article.summary } : {}),
                },
              });
            }
            continue;
          }

          await prisma.article.create({
            data: {
              feedSourceId: source.id,
              title: article.title,
              url: article.url,
              guid: article.guid,
              author: article.author,
              publishedAt: article.publishedAt,
              dateEstimated: article.dateEstimated,
              summary: article.summary,
              content: article.content,
            },
          });
          articlesCreated++;
        } catch (err) {
          // Skip individual article errors (likely duplicate constraint)
          continue;
        }
      }

      await prisma.feedSource.update({
        where: { id: source.id },
        data: {
          lastFetchedAt: new Date(),
          lastFetchStatus: "ok",
          etag: result.etag || source.etag,
          lastModified: result.lastModified || source.lastModified,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`${source.title}: ${message}`);
      await prisma.feedSource.update({
        where: { id: source.id },
        data: {
          lastFetchedAt: new Date(),
          lastFetchStatus: `error: ${message.slice(0, 200)}`,
        },
      });
    }
  }

  return {
    sourcesProcessed: sources.length,
    articlesCreated,
    errors,
  };
}
