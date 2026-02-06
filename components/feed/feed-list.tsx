"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ArticleCard, ArticleData } from "./article-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ALGORITHM_VERSION } from "@/lib/constants";

function deriveSubscribedSources(items: ArticleData[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.feedSource.subscribed) ids.add(item.feedSource.id);
  }
  return ids;
}

interface FeedListProps {
  initialItems: ArticleData[];
  initialCursor: string | null;
  feedRequestId: string;
}

export function FeedList({ initialItems, initialCursor, feedRequestId }: FeedListProps) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [subscribedSourceIds, setSubscribedSourceIds] = useState(
    () => deriveSubscribedSources(initialItems)
  );
  const [hiddenSourceIds, setHiddenSourceIds] = useState(() => new Set<string>());
  const currentFeedRequestId = useRef(feedRequestId);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Infinite scroll
  useEffect(() => {
    if (!cursor || !loaderRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && cursor) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  });

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    const res = await fetch(`/api/feed?cursor=${cursor}`);
    const data = await res.json();
    const newItems = data.items as ArticleData[];
    setItems((prev) => [...prev, ...newItems]);
    setCursor(data.nextCursor);
    currentFeedRequestId.current = data.feedRequestId;
    // Merge any newly-subscribed sources from the new page
    setSubscribedSourceIds((prev) => {
      const next = new Set(prev);
      for (const item of newItems) {
        if (item.feedSource.subscribed) next.add(item.feedSource.id);
      }
      return next;
    });
    setLoading(false);
  }

  const logImpression = useCallback(
    async (articleId: string) => {
      const item = items.find((i) => i.id === articleId);
      if (!item) return;
      await fetch("/api/feed/impression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              articleId,
              feedRequestId: currentFeedRequestId.current,
              position: items.findIndex((i) => i.id === articleId),
              algorithmVersion: ALGORITHM_VERSION,
              candidateSources: item.candidateSources,
            },
          ],
        }),
      });
    },
    [items]
  );

  async function handleInteraction(articleId: string, type: string) {
    await fetch(`/api/articles/${articleId}/${type}`, { method: "POST" });
  }

  async function handleToggleSubscribe(sourceId: string, subscribe: boolean) {
    // Optimistic update
    setSubscribedSourceIds((prev) => {
      const next = new Set(prev);
      if (subscribe) {
        next.add(sourceId);
      } else {
        next.delete(sourceId);
      }
      return next;
    });

    const endpoint = subscribe ? "subscribe" : "unsubscribe";
    const res = await fetch(`/api/sources/${sourceId}/${endpoint}`, {
      method: "POST",
    });

    if (!res.ok) {
      // Revert on error
      setSubscribedSourceIds((prev) => {
        const next = new Set(prev);
        if (subscribe) {
          next.delete(sourceId);
        } else {
          next.add(sourceId);
        }
        return next;
      });
    }
  }

  async function handleHideSource(sourceId: string) {
    setHiddenSourceIds((prev) => new Set(prev).add(sourceId));

    const res = await fetch(`/api/sources/${sourceId}/hide`, { method: "POST" });
    if (!res.ok) {
      setHiddenSourceIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  }

  const visibleItems = items.filter(
    (item) => !hiddenSourceIds.has(item.feedSource.id)
  );

  if (visibleItems.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No articles yet</p>
        <p className="mt-2">
          Subscribe to some sources or wait for the next ingestion cycle.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visibleItems.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          isSourceSubscribed={subscribedSourceIds.has(article.feedSource.id)}
          onLike={(id) => handleInteraction(id, "like")}
          onHide={(id) => handleInteraction(id, "hide")}
          onSave={(id) => handleInteraction(id, "save")}
          onImpression={logImpression}
          onToggleSubscribe={handleToggleSubscribe}
          onHideSource={handleHideSource}
        />
      ))}
      {cursor && (
        <div ref={loaderRef} className="space-y-4">
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
        </div>
      )}
    </div>
  );
}
