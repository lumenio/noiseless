import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const sources = await prisma.feedSource.findMany({
    where: { isPreinstalled: true },
    include: {
      topics: { include: { topic: true } },
      _count: { select: { articles: true } },
    },
    orderBy: { title: "asc" },
  });

  const topics = await prisma.topic.findMany({ orderBy: { label: "asc" } });

  return NextResponse.json({ sources, topics });
}
