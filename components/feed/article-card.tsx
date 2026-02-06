"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Heart, EyeOff, Bookmark, ExternalLink } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "@/lib/time";

export interface ArticleData {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string;
  dateEstimated?: boolean;
  author: string | null;
  feedSource: {
    id: string;
    title: string;
    siteUrl: string | null;
  };
  topics: { slug: string; label: string }[];
  score: number;
  likes: number;
  saves: number;
  candidateSources: string[];
  scoreBreakdown: {
    topicRelevance: number;
    freshness: number;
    subscribed: number;
    sourceAffinity: number;
    qualityScore: number;
    seenPenalty: number;
  };
}

interface ArticleCardProps {
  article: ArticleData;
  onLike?: (id: string) => void;
  onHide?: (id: string) => void;
  onSave?: (id: string) => void;
  onImpression?: (id: string) => void;
}

export function ArticleCard({
  article,
  onLike,
  onHide,
  onSave,
  onImpression,
}: ArticleCardProps) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const impressionLogged = useRef(false);

  useEffect(() => {
    if (!onImpression) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionLogged.current) {
          impressionLogged.current = true;
          onImpression(article.id);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [article.id, onImpression]);

  if (hidden) return null;

  const likeCount = article.likes + (liked ? 1 : 0);
  const saveCount = article.saves + (saved ? 1 : 0);

  return (
    <article ref={ref} className="border-b border-border pb-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{article.feedSource.title}</span>
            {!article.dateEstimated && (
              <>
                <span className="text-xs">·</span>
                <span>{formatDistanceToNow(new Date(article.publishedAt))}</span>
              </>
            )}
            {article.author && (
              <>
                <span className="text-xs">·</span>
                <span>{article.author}</span>
              </>
            )}
          </div>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 block text-xl font-heading leading-snug hover:underline"
          >
            {article.title}
          </a>
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <div className="mt-3 space-y-2">
        {article.summary && (
          <div className="text-sm text-foreground/80">
            {article.summary.length > 600 && !expanded ? (
              <>
                <p>{article.summary.slice(0, 600).trim()}...</p>
                <button
                  onClick={() => setExpanded(true)}
                  className="mt-1 text-muted-foreground hover:text-foreground"
                >
                  Read more
                </button>
              </>
            ) : (
              <>
                <p>{article.summary}</p>
                {article.summary.length > 600 && (
                  <button
                    onClick={() => setExpanded(false)}
                    className="mt-1 text-muted-foreground hover:text-foreground"
                  >
                    Show less
                  </button>
                )}
              </>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {article.topics.map((t) => (
            <Badge key={t.slug} variant="secondary" className="text-xs">
              {t.label}
            </Badge>
          ))}
        </div>
        {(onLike || onHide || onSave) && (
          <TooltipProvider>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLiked(!liked);
                      onLike?.(article.id);
                    }}
                    className={liked ? "text-primary" : ""}
                  >
                    <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
                    {likeCount > 0 && (
                      <span className="ml-1 text-xs">{likeCount}</span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Like</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSaved(!saved);
                      onSave?.(article.id);
                    }}
                    className={saved ? "text-primary" : ""}
                  >
                    <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
                    {saveCount > 0 && (
                      <span className="ml-1 text-xs">{saveCount}</span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bookmark</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      setHidden(true);
                      onHide?.(article.id);
                    }}
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Hide from feed</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        )}
      </div>
    </article>
  );
}
