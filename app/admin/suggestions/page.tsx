"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Suggestion {
  id: string;
  url: string;
  title: string | null;
  note: string | null;
  status: string;
  createdAt: string;
  suggestedBy: { email: string } | null;
  topics: { topic: { slug: string; label: string } }[];
}

export default function AdminSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [tab, setTab] = useState("PENDING");
  const [loading, setLoading] = useState(true);

  async function loadSuggestions(status: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/suggestions?status=${status}`);
    if (res.ok) {
      const data = await res.json();
      setSuggestions(data.suggestions);
    } else if (res.status === 403) {
      toast.error("You don't have admin access");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadSuggestions(tab);
  }, [tab]);

  async function handleApprove(id: string) {
    const res = await fetch(`/api/admin/suggestions/${id}/approve`, {
      method: "POST",
    });
    if (res.ok) {
      toast.success("Suggestion approved");
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } else {
      toast.error("Failed to approve");
    }
  }

  async function handleReject(id: string) {
    const res = await fetch(`/api/admin/suggestions/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      toast.success("Suggestion rejected");
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } else {
      toast.error("Failed to reject");
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-heading tracking-tight mb-6">
        Suggestion Review
      </h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-4">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : suggestions.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No {tab.toLowerCase()} suggestions
            </p>
          ) : (
            suggestions.map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {s.title || s.url}
                    </CardTitle>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground break-all">
                    {s.url}
                  </p>
                  {s.note && <p className="text-sm">{s.note}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {s.topics.map(({ topic }) => (
                      <Badge key={topic.slug} variant="secondary" className="text-xs">
                        {topic.label}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      by {s.suggestedBy?.email || "Unknown"} ·{" "}
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                    {tab === "PENDING" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(s.id)}
                        >
                          <Check className="mr-1 h-3 w-3" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(s.id)}
                        >
                          <X className="mr-1 h-3 w-3" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
