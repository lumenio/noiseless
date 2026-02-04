"use client";

import { Badge } from "@/components/ui/badge";

interface TopicFilterProps {
  topics: { id: string; slug: string; label: string }[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
}

export function TopicFilter({ topics, selected, onSelect }: TopicFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant={selected === null ? "default" : "outline"}
        className="cursor-pointer"
        onClick={() => onSelect(null)}
      >
        All
      </Badge>
      {topics.map((topic) => (
        <Badge
          key={topic.slug}
          variant={selected === topic.slug ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => onSelect(selected === topic.slug ? null : topic.slug)}
        >
          {topic.label}
        </Badge>
      ))}
    </div>
  );
}
