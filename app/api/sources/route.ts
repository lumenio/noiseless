import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = await prisma.feedSource.findMany({
    where: { isPreinstalled: true },
    include: {
      topics: { include: { topic: true } },
      _count: { select: { articles: true } },
    },
    orderBy: { title: "asc" },
  });

  const subscriptions = await prisma.userSourceSubscription.findMany({
    where: { userId: user.id },
    select: { feedSourceId: true },
  });

  const subscribedIds = new Set(subscriptions.map((s) => s.feedSourceId));
  const topics = await prisma.topic.findMany({ orderBy: { label: "asc" } });

  return NextResponse.json({
    sources: sources.map((s) => ({
      ...s,
      subscribed: subscribedIds.has(s.id),
    })),
    topics,
  });
}
