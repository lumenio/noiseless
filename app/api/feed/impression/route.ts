import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  items: z.array(
    z.object({
      articleId: z.string(),
      feedRequestId: z.string(),
      position: z.number(),
      algorithmVersion: z.string(),
      candidateSources: z.array(z.string()),
    })
  ),
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

  // Upsert impressions (idempotent by userId + feedRequestId + articleId)
  await Promise.all(
    parsed.data.items.map((item) =>
      prisma.impressionEvent
        .upsert({
          where: {
            userId_feedRequestId_articleId: {
              userId: session.user.id,
              feedRequestId: item.feedRequestId,
              articleId: item.articleId,
            },
          },
          update: {},
          create: {
            userId: session.user.id,
            articleId: item.articleId,
            feedRequestId: item.feedRequestId,
            position: item.position,
            algorithmVersion: item.algorithmVersion,
            candidateSources: item.candidateSources,
          },
        })
        .catch(() => {
          // Ignore constraint violations
        })
    )
  );

  return NextResponse.json({ ok: true });
}
