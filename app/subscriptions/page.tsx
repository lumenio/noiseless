import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SourceGrid } from "@/components/sources/source-grid";

export default async function SubscriptionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const subscriptions = await prisma.userSourceSubscription.findMany({
    where: { userId: session.user.id },
    include: {
      feedSource: {
        include: {
          topics: { include: { topic: true } },
          _count: { select: { articles: true } },
        },
      },
    },
  });

  const topics = await prisma.topic.findMany({ orderBy: { label: "asc" } });

  const sources = subscriptions.map((sub) => ({
    ...sub.feedSource,
    subscribed: true,
  }));

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Your Subscriptions
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage the sources you&apos;re subscribed to.
        </p>
      </div>
      {sources.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No subscriptions yet</p>
          <p className="mt-2">
            Browse the{" "}
            <a href="/sources" className="text-primary hover:underline">
              Sources directory
            </a>{" "}
            to find feeds to subscribe to.
          </p>
        </div>
      ) : (
        <SourceGrid
          initialSources={sources}
          topics={topics}
          isLoggedIn={true}
        />
      )}
    </div>
  );
}
