import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Aggregate stats from events
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  // Get all articles with recent events
  const articles = await prisma.article.findMany({
    where: {
      publishedAt: { gte: cutoff },
    },
    select: { id: true },
  });

  let updated = 0;

  for (const article of articles) {
    const [impressions, interactions] = await Promise.all([
      prisma.impressionEvent.count({
        where: { articleId: article.id },
      }),
      prisma.interactionEvent.groupBy({
        by: ["type"],
        where: { articleId: article.id },
        _count: true,
      }),
    ]);

    const opens =
      interactions.find((i) => i.type === "OPEN")?._count || 0;
    const likes =
      interactions.find((i) => i.type === "LIKE")?._count || 0;
    const saves =
      interactions.find((i) => i.type === "SAVE")?._count || 0;

    const ctr = impressions > 0 ? opens / impressions : null;
    const qualityScore =
      impressions > 0
        ? (likes * 2 + saves * 3 + opens) / (impressions * 3)
        : null;

    await prisma.articleStats.upsert({
      where: { articleId: article.id },
      update: {
        impressions,
        opens,
        likes,
        saves,
        ctr,
        qualityScore: qualityScore ? Math.min(1, qualityScore) : null,
      },
      create: {
        articleId: article.id,
        impressions,
        opens,
        likes,
        saves,
        ctr,
        qualityScore: qualityScore ? Math.min(1, qualityScore) : null,
      },
    });
    updated++;
  }

  return NextResponse.json({ articlesUpdated: updated });
}
