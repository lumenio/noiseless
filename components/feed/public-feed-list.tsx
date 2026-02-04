"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArticleCard, ArticleData } from "./article-card";
import { TopicFilter } from "@/components/sources/topic-filter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface PublicFeedListProps {
  initialItems: ArticleData[];
  initialCursor: string | null;
  topics: { id: string; slug: string; label: string }[];
  initialTopicSlug: string | null;
}

export function PublicFeedList({
  initialItems,
  initialCursor,
  topics,
  initialTopicSlug,
}: PublicFeedListProps) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [topicSlug, setTopicSlug] = useState(initialTopicSlug);
  const [switching, setSwitching] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Infinite scroll
  useEffect(() => {
    if (!cursor || !loaderRef.current) return;
    const el = loaderRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && cursor) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  });

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("cursor", cursor);
    if (topicSlug) params.set("topic", topicSlug);
    const res = await fetch(`/api/feed/public?${params}`);
    const data = await res.json();
    setItems((prev) => [...prev, ...data.items]);
    setCursor(data.nextCursor);
    setLoading(false);
  }

  async function handleTopicChange(slug: string | null) {
    setTopicSlug(slug);
    setSwitching(true);
    const params = new URLSearchParams();
    if (slug) params.set("topic", slug);
    const res = await fetch(`/api/feed/public?${params}`);
    const data = await res.json();
    setItems(data.items);
    setCursor(data.nextCursor);
    setSwitching(false);
  }

  return (
    <div className="space-y-6">
      <TopicFilter
        topics={topics}
        selected={topicSlug}
        onSelect={handleTopicChange}
      />

      <div className="rounded-lg border bg-muted/30 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Sign in to get a personalized feed tailored to your interests.
        </p>
        <Link href="/login">
          <Button size="sm" className="mt-2">
            Sign in
          </Button>
        </Link>
      </div>

      {switching ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No articles yet</p>
          <p className="mt-2">Check back soon for fresh content.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((article) => (
            <ArticleCard key={article.id} article={article} />
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
      )}
    </div>
  );
}
