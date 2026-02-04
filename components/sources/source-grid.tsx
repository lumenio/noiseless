"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { TopicFilter } from "./topic-filter";
import { SourceCard } from "./source-card";
import { Search } from "lucide-react";
import { toast } from "sonner";

interface Source {
  id: string;
  title: string;
  description: string | null;
  siteUrl: string | null;
  topics: { topic: { slug: string; label: string } }[];
  _count: { articles: number };
  subscribed?: boolean;
}

interface SourceGridProps {
  initialSources: Source[];
  topics: { id: string; slug: string; label: string }[];
  isLoggedIn: boolean;
}

export function SourceGrid({ initialSources, topics, isLoggedIn }: SourceGridProps) {
  const [sources, setSources] = useState(initialSources);
  const [search, setSearch] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return sources.filter((s) => {
      const matchesSearch =
        !search ||
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.description?.toLowerCase().includes(search.toLowerCase());
      const matchesTopic =
        !selectedTopic ||
        s.topics.some((t) => t.topic.slug === selectedTopic);
      return matchesSearch && matchesTopic;
    });
  }, [sources, search, selectedTopic]);

  async function handleToggleSubscribe(sourceId: string, subscribe: boolean) {
    const endpoint = subscribe ? "subscribe" : "unsubscribe";
    setSources((prev) =>
      prev.map((s) =>
        s.id === sourceId ? { ...s, subscribed: subscribe } : s
      )
    );

    const res = await fetch(`/api/sources/${sourceId}/${endpoint}`, {
      method: "POST",
    });

    if (!res.ok) {
      setSources((prev) =>
        prev.map((s) =>
          s.id === sourceId ? { ...s, subscribed: !subscribe } : s
        )
      );
      toast.error("Failed to update subscription");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <TopicFilter
        topics={topics}
        selected={selectedTopic}
        onSelect={setSelectedTopic}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            isLoggedIn={isLoggedIn}
            onToggleSubscribe={handleToggleSubscribe}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No sources found matching your filters.
        </p>
      )}
    </div>
  );
}
