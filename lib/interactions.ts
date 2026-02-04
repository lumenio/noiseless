import { prisma } from "@/lib/db";
import { InteractionType } from "@/lib/generated/prisma/client";

const TOPIC_WEIGHT_DELTA = 0.2;
const WEIGHT_MIN = -3;
const WEIGHT_MAX = 3;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export async function recordInteraction(
  userId: string,
  articleId: string,
  type: InteractionType,
  value?: number
) {
  // Create interaction event
  await prisma.interactionEvent.create({
    data: { userId, articleId, type, value },
  });

  // Update topic weights for relevant interaction types
  if (["LIKE", "DISLIKE", "HIDE", "SAVE"].includes(type)) {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: {
        feedSource: {
          include: { topics: true },
        },
      },
    });

    if (article) {
      const delta =
        type === "LIKE" || type === "SAVE"
          ? TOPIC_WEIGHT_DELTA
          : -TOPIC_WEIGHT_DELTA;

      await Promise.all(
        article.feedSource.topics.map((fst) =>
          prisma.userTopicWeight.upsert({
            where: {
              userId_topicId: { userId, topicId: fst.topicId },
            },
            update: {
              weight: {
                set: undefined, // will be overridden below
              },
            },
            create: {
              userId,
              topicId: fst.topicId,
              weight: clamp(delta, WEIGHT_MIN, WEIGHT_MAX),
            },
          }).then(async (existing) => {
            // Update with clamped value
            await prisma.userTopicWeight.update({
              where: {
                userId_topicId: { userId, topicId: fst.topicId },
              },
              data: {
                weight: clamp(existing.weight + delta, WEIGHT_MIN, WEIGHT_MAX),
              },
            });
          })
        )
      );

      // Update source affinity
      const affinityDelta =
        type === "LIKE" || type === "SAVE" ? 0.3 : -0.3;

      const existing = await prisma.userSourceAffinity.findUnique({
        where: {
          userId_feedSourceId: {
            userId,
            feedSourceId: article.feedSourceId,
          },
        },
      });

      await prisma.userSourceAffinity.upsert({
        where: {
          userId_feedSourceId: {
            userId,
            feedSourceId: article.feedSourceId,
          },
        },
        update: {
          weight: clamp(
            (existing?.weight || 0) + affinityDelta,
            WEIGHT_MIN,
            WEIGHT_MAX
          ),
        },
        create: {
          userId,
          feedSourceId: article.feedSourceId,
          weight: clamp(affinityDelta, WEIGHT_MIN, WEIGHT_MAX),
        },
      });
    }
  }
}
