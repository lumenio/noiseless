import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  topicSlugs: z.array(z.string()).min(3),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { topicSlugs } = parsed.data;

  // Get topic IDs
  const topics = await prisma.topic.findMany({
    where: { slug: { in: topicSlugs } },
  });

  // Create topic weights
  await Promise.all(
    topics.map((topic) =>
      prisma.userTopicWeight.upsert({
        where: {
          userId_topicId: {
            userId: session.user.id,
            topicId: topic.id,
          },
        },
        update: { weight: 1.0 },
        create: {
          userId: session.user.id,
          topicId: topic.id,
          weight: 1.0,
        },
      })
    )
  );

  // Auto-subscribe to top preinstalled feeds for selected topics
  const topSources = await prisma.feedSource.findMany({
    where: {
      isPreinstalled: true,
      topics: {
        some: { topicId: { in: topics.map((t) => t.id) } },
      },
    },
    take: 15,
  });

  await Promise.all(
    topSources.map((source) =>
      prisma.userSourceSubscription.upsert({
        where: {
          userId_feedSourceId: {
            userId: session.user.id,
            feedSourceId: source.id,
          },
        },
        update: {},
        create: {
          userId: session.user.id,
          feedSourceId: source.id,
        },
      })
    )
  );

  // Mark onboarding complete
  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardingCompletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
