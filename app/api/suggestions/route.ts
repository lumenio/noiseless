import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateUrl } from "@/lib/ingest/validateUrl";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  note: z.string().max(500).optional(),
  topicSlugs: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { url, title, note, topicSlugs } = parsed.data;

  // SSRF validation
  const urlCheck = validateUrl(url);
  if (!urlCheck.valid) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 });
  }

  // Rate limit: 10 suggestions/user/day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = await prisma.feedSuggestion.count({
    where: {
      suggestedByUserId: user.id,
      createdAt: { gte: today },
    },
  });
  if (count >= 10) {
    return NextResponse.json(
      { error: "Daily suggestion limit reached (10/day)" },
      { status: 429 }
    );
  }

  // Try fetching the feed to validate it's a real RSS feed
  let parsedMeta: Record<string, unknown> | null = null;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Noiseless/1.0 RSS Reader" },
    });
    if (response.ok) {
      const contentType = response.headers.get("content-type") || "";
      parsedMeta = {
        contentType,
        status: response.status,
      };
    }
  } catch {
    // Don't block submission if feed validation fails
  }

  const suggestion = await prisma.feedSuggestion.create({
    data: {
      url,
      title,
      note,
      suggestedByUserId: user.id,
      parsedMeta: parsedMeta as Record<string, string | number> | undefined,
    },
  });

  // Link topics if provided
  if (topicSlugs?.length) {
    const topics = await prisma.topic.findMany({
      where: { slug: { in: topicSlugs } },
    });
    await Promise.all(
      topics.map((t) =>
        prisma.feedSuggestionTopic.create({
          data: { suggestionId: suggestion.id, topicId: t.id },
        })
      )
    );
  }

  return NextResponse.json({ id: suggestion.id });
}
