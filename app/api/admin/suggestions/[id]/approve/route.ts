import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const suggestion = await prisma.feedSuggestion.findUnique({
    where: { id },
    include: { topics: true },
  });

  if (!suggestion || suggestion.status !== "PENDING") {
    return NextResponse.json({ error: "Not found or already reviewed" }, { status: 404 });
  }

  // Create the FeedSource
  const source = await prisma.feedSource.create({
    data: {
      title: suggestion.title || suggestion.url,
      url: suggestion.url,
      isPreinstalled: false,
    },
  });

  // Link topics
  if (suggestion.topics.length > 0) {
    await Promise.all(
      suggestion.topics.map((t) =>
        prisma.feedSourceTopic.create({
          data: { feedSourceId: source.id, topicId: t.topicId },
        })
      )
    );
  }

  // Update suggestion status
  await prisma.feedSuggestion.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedByUserId: session.user.id,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, feedSourceId: source.id });
}
