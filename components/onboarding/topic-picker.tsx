"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { toast } from "sonner";

interface TopicPickerProps {
  topics: { id: string; slug: string; label: string }[];
}

export function TopicPicker({ topics }: TopicPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function handleContinue() {
    if (selected.size < 3) {
      toast.error("Please select at least 3 topics");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicSlugs: Array.from(selected) }),
    });
    if (res.ok) {
      router.push("/feed");
    } else {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => {
          const isSelected = selected.has(topic.slug);
          return (
            <Badge
              key={topic.slug}
              variant={isSelected ? "default" : "outline"}
              className="cursor-pointer select-none px-4 py-2 text-sm"
              onClick={() => toggle(topic.slug)}
            >
              {topic.label}
              {isSelected && <Check className="ml-1.5 h-3 w-3" />}
            </Badge>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.size} selected (minimum 3)
        </p>
        <Button
          onClick={handleContinue}
          disabled={selected.size < 3 || loading}
          size="lg"
        >
          {loading ? "Setting up..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
