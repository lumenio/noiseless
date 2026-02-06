import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { publicFeed } from "@/lib/public-feed";
import { PublicFeedList } from "@/components/feed/public-feed-list";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/feed");
  }

  const [feedResult, topics] = await Promise.all([
    publicFeed(),
    prisma.topic.findMany({
      orderBy: { label: "asc" },
      select: { id: true, slug: true, label: true },
    }),
  ]);

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">Explore</h1>
        <p className="mt-1 text-muted-foreground">
          Fresh articles from our curated sources
        </p>
      </div>
      <PublicFeedList
        initialItems={feedResult.items.map((item) => ({
          ...item,
          publishedAt: item.publishedAt.toISOString(),
        }))}
        initialCursor={feedResult.nextCursor}
        topics={topics}
        initialTopicSlug={null}
      />
    </main>
  );
}
