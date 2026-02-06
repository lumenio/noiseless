"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Users, Bookmark } from "lucide-react";
import { ArticleCard, ArticleData } from "./article-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  initialSavedArticleIds: string[];
}

export function FeedList({ initialItems, initialCursor, feedRequestId, initialSavedArticleIds }: FeedListProps) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [subscribedSourceIds, setSubscribedSourceIds] = useState(
    () => deriveSubscribedSources(initialItems)
  );
  const [hiddenSourceIds, setHiddenSourceIds] = useState(() => new Set<string>());
  const [filterFollowing, setFilterFollowing] = useState(false);
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const [savedArticleIds, setSavedArticleIds] = useState(() => new Set(initialSavedArticleIds));
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
    if (type === "save") {
      setSavedArticleIds((prev) => {
        const next = new Set(prev);
        if (next.has(articleId)) {
          next.delete(articleId);
        } else {
          next.add(articleId);
        }
        return next;
      });
    }
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

  const filtersActive = filterFollowing || filterBookmarked;

  const visibleItems = items.filter((item) => {
    if (hiddenSourceIds.has(item.feedSource.id)) return false;
    if (filterFollowing && !subscribedSourceIds.has(item.feedSource.id)) return false;
    if (filterBookmarked && !savedArticleIds.has(item.id)) return false;
    return true;
  });

  const emptyMessage = visibleItems.length === 0
    ? filtersActive
      ? filterBookmarked && !filterFollowing
        ? "No bookmarked articles yet"
        : filterFollowing && !filterBookmarked
          ? "No articles from followed sources"
          : "No articles match the active filters"
      : null
    : null;

  return (
    <div className="space-y-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-heading tracking-tight">Your Feed</h1>
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  pressed={filterFollowing}
                  onPressedChange={setFilterFollowing}
                  size="sm"
                  aria-label="Show only following"
                >
                  <Users className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>Following</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  pressed={filterBookmarked}
                  onPressedChange={setFilterBookmarked}
                  size="sm"
                  aria-label="Show only bookmarked"
                >
                  <Bookmark className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>Bookmarked</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {emptyMessage ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">{emptyMessage}</p>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No articles yet</p>
          <p className="mt-2">
            Subscribe to some sources or wait for the next ingestion cycle.
          </p>
        </div>
      ) : null}

      {visibleItems.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          isSourceSubscribed={subscribedSourceIds.has(article.feedSource.id)}
          onLike={(id) => handleInteraction(id, "like")}
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
