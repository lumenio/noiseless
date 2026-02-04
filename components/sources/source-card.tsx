"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Plus, Check } from "lucide-react";

interface SourceCardProps {
  source: {
    id: string;
    title: string;
    description: string | null;
    siteUrl: string | null;
    topics: { topic: { slug: string; label: string } }[];
    _count: { articles: number };
    subscribed?: boolean;
  };
  isLoggedIn: boolean;
  onToggleSubscribe?: (sourceId: string, subscribed: boolean) => void;
}

export function SourceCard({ source, isLoggedIn, onToggleSubscribe }: SourceCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{source.title}</CardTitle>
          {source.siteUrl && (
            <a
              href={source.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
        {source.description && (
          <CardDescription className="line-clamp-2 text-sm">
            {source.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {source.topics.map(({ topic }) => (
            <Badge key={topic.slug} variant="secondary" className="text-xs">
              {topic.label}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {source._count.articles} articles
          </span>
          {isLoggedIn && onToggleSubscribe ? (
            <Button
              size="sm"
              variant={source.subscribed ? "secondary" : "default"}
              onClick={() => onToggleSubscribe(source.id, !source.subscribed)}
            >
              {source.subscribed ? (
                <>
                  <Check className="mr-1 h-3 w-3" /> Subscribed
                </>
              ) : (
                <>
                  <Plus className="mr-1 h-3 w-3" /> Subscribe
                </>
              )}
            </Button>
          ) : !isLoggedIn ? (
            <a href="/login">
              <Button size="sm" variant="outline">
                Log in to subscribe
              </Button>
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
