import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { rankFeed } from "@/lib/rank";
import { FeedList } from "@/components/feed/feed-list";

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { items, nextCursor, feedRequestId } = await rankFeed(session.user.id);

  // Serialize dates for client component
  const serialized = items.map((item) => ({
    ...item,
    publishedAt: item.publishedAt.toISOString(),
  }));

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-heading tracking-tight">Your Feed</h1>
      </div>
      <FeedList
        initialItems={serialized}
        initialCursor={nextCursor}
        feedRequestId={feedRequestId}
      />
    </div>
  );
}
