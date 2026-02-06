"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PlusCircle } from "lucide-react";

interface Topic {
  id: string;
  slug: string;
  label: string;
}

export function SuggestDialog({ topics }: { topics: Topic[] }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  function toggleTopic(slug: string) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function resetForm() {
    setUrl("");
    setTitle("");
    setNote("");
    setSelectedTopics(new Set());
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
      setOpen(false);
      resetForm();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to submit suggestion");
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <PlusCircle className="h-4 w-4" />
          Suggest
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suggest a Source</DialogTitle>
          <DialogDescription>
            Know a great RSS feed? Suggest it and we&apos;ll review it for
            inclusion in the directory.
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
