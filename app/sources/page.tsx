import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SourceGrid } from "@/components/sources/source-grid";
import { SuggestDialog } from "@/components/sources/suggest-dialog";

export default async function SourcesPage() {
  const user = await getAuthUser();
  const isLoggedIn = !!user;

  const sources = await prisma.feedSource.findMany({
    where: { isPreinstalled: true },
    include: {
      topics: { include: { topic: true } },
      _count: { select: { articles: true } },
    },
    orderBy: { title: "asc" },
  });

  const topics = await prisma.topic.findMany({ orderBy: { label: "asc" } });

  let subscribedIds = new Set<string>();
  if (user) {
    const subs = await prisma.userSourceSubscription.findMany({
      where: { userId: user.id },
      select: { feedSourceId: true },
    });
    subscribedIds = new Set(subs.map((s) => s.feedSourceId));
  }

  const sourcesWithState = sources.map((s) => ({
    ...s,
    subscribed: subscribedIds.has(s.id),
  }));

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading tracking-tight">Sources</h1>
          <p className="mt-2 text-muted-foreground">
            Browse our curated collection of RSS feeds. Subscribe to the ones
            you find interesting.
          </p>
        </div>
        {isLoggedIn && <SuggestDialog topics={topics} />}
      </div>
      <SourceGrid
        initialSources={sourcesWithState}
        topics={topics}
        isLoggedIn={isLoggedIn}
      />
    </div>
  );
}
