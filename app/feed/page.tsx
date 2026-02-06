import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { rankFeed } from "@/lib/rank";
import { prisma } from "@/lib/db";
import { FeedList } from "@/components/feed/feed-list";

export default async function FeedPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompletedAt) redirect("/onboarding");

  const [{ items, nextCursor, feedRequestId }, savedInteractions] =
    await Promise.all([
      rankFeed(user.id),
      prisma.interactionEvent.findMany({
        where: { userId: user.id, type: "SAVE" },
        select: { articleId: true },
      }),
    ]);
  const savedArticleIds = savedInteractions.map((i) => i.articleId);

  // Serialize dates for client component
  const serialized = items.map((item) => ({
    ...item,
    publishedAt: item.publishedAt.toISOString(),
  }));

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <FeedList
        initialItems={serialized}
        initialCursor={nextCursor}
        feedRequestId={feedRequestId}
        initialSavedArticleIds={savedArticleIds}
      />
    </div>
  );
}
