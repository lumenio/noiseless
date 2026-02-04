import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prune impressions older than 90 days
  const impressionCutoff = new Date();
  impressionCutoff.setDate(impressionCutoff.getDate() - 90);

  const deletedImpressions = await prisma.impressionEvent.deleteMany({
    where: { shownAt: { lt: impressionCutoff } },
  });

  // Prune old interaction events (keep 180 days)
  const interactionCutoff = new Date();
  interactionCutoff.setDate(interactionCutoff.getDate() - 180);

  const deletedInteractions = await prisma.interactionEvent.deleteMany({
    where: { createdAt: { lt: interactionCutoff } },
  });

  // Prune old articles (keep 60 days)
  const articleCutoff = new Date();
  articleCutoff.setDate(articleCutoff.getDate() - 60);

  const deletedArticles = await prisma.article.deleteMany({
    where: { publishedAt: { lt: articleCutoff } },
  });

  return NextResponse.json({
    deletedImpressions: deletedImpressions.count,
    deletedInteractions: deletedInteractions.count,
    deletedArticles: deletedArticles.count,
  });
}
