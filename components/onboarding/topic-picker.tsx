"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TOPIC_ICONS: Record<string, string> = {
  ai: "🤖",
  robotics: "🦾",
  biology: "🧬",
  neuroscience: "🧠",
  security: "🔒",
  programming: "💻",
  startups: "🚀",
  math: "📐",
  design: "🎨",
  geopolitics: "🌍",
  economics: "📈",
  climate: "🌱",
  hardware: "🔧",
  data: "📊",
};

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {topics.map((topic) => {
          const isSelected = selected.has(topic.slug);
          return (
            <Card
              key={topic.slug}
              className={cn(
                "cursor-pointer transition-colors",
                isSelected && "border-primary bg-primary/5"
              )}
              onClick={() => toggle(topic.slug)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <span className="text-2xl">
                  {TOPIC_ICONS[topic.slug] || "📌"}
                </span>
                <span className="font-medium">{topic.label}</span>
                {isSelected && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </CardContent>
            </Card>
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
