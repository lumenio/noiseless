"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface Topic {
  id: string;
  slug: string;
  label: string;
}

export default function SuggestSourcePage() {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/sources/public")
      .then((r) => r.json())
      .then((data) => setTopics(data.topics));
  }, []);

  function toggleTopic(slug: string) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        title: title || undefined,
        note: note || undefined,
        topicSlugs: Array.from(selectedTopics),
      }),
    });

    if (res.ok) {
      toast.success("Suggestion submitted! It will be reviewed by an admin.");
      router.push("/sources");
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to submit suggestion");
    }
    setLoading(false);
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Suggest a Source</CardTitle>
          <CardDescription>
            Know a great RSS feed? Suggest it and we&apos;ll review it for
            inclusion in the directory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Feed URL *</label>
              <Input
                type="url"
                placeholder="https://example.com/feed.xml"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="Source name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Note</label>
              <Textarea
                placeholder="Why should we add this source?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">Topics</label>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <Badge
                    key={topic.slug}
                    variant={
                      selectedTopics.has(topic.slug) ? "default" : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => toggleTopic(topic.slug)}
                  >
                    {topic.label}
                  </Badge>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Submitting..." : "Submit Suggestion"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
