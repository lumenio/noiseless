import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  topicSlugs: z.array(z.string()).min(3),
});

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
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
            userId: user.id,
            topicId: topic.id,
          },
        },
        update: { weight: 1.0 },
        create: {
          userId: user.id,
          topicId: topic.id,
          weight: 1.0,
        },
      })
    )
  );

  // Mark onboarding complete
  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingCompletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
