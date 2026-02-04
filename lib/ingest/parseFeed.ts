import Parser from "rss-parser";

const parser = new Parser({
  timeout: 10000,
  maxRedirects: 3,
  headers: {
    "User-Agent": "Noiseless/1.0 RSS Reader",
  },
});

export interface ParsedArticle {
  title: string;
  url: string;
  guid: string | null;
  author: string | null;
  publishedAt: Date;
  summary: string | null;
  content: string | null;
}

function stripHtmlPreserveBreaks(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parseFeed(
  feedUrl: string,
  options?: { etag?: string | null; lastModified?: string | null }
): Promise<{
  articles: ParsedArticle[];
  etag?: string;
  lastModified?: string;
}> {
  const headers: Record<string, string> = {
    "User-Agent": "Noiseless/1.0 RSS Reader",
  };

  if (options?.etag) headers["If-None-Match"] = options.etag;
  if (options?.lastModified) headers["If-Modified-Since"] = options.lastModified;

  // Fetch with conditional GET
  const response = await fetch(feedUrl, {
    headers,
    signal: AbortSignal.timeout(10000),
  });

  if (response.status === 304) {
    return { articles: [] };
  }

  if (!response.ok) {
    throw new Error(`Feed fetch failed: ${response.status}`);
  }

  const xml = await response.text();
  const feed = await parser.parseString(xml);

  const articles: ParsedArticle[] = (feed.items || [])
    .filter((item) => item.title && (item.link || item.guid))
    .map((item) => {
      const rawContent = item.content || item.contentSnippet || "";
      return {
        title: item.title!.trim(),
        url: (item.link || item.guid || "").trim(),
        guid: item.guid?.trim() || null,
        author: item.creator || item["dc:creator"] || null,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        summary: rawContent
          .replace(/<[^>]*>/g, "")
          .slice(0, 1000)
          .trim() || null,
        content: stripHtmlPreserveBreaks(rawContent) || null,
      };
    });

  return {
    articles,
    etag: response.headers.get("etag") || undefined,
    lastModified: response.headers.get("last-modified") || undefined,
  };
}
