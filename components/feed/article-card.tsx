"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ThumbsUp,
  ThumbsDown,
  EyeOff,
  Bookmark,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "@/lib/time";
import { MarkdownContent } from "./markdown-content";

export interface ArticleData {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  content: string | null;
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

const CLAMP_HEIGHT = 200;

function hasMarkdownFormatting(text: string): boolean {
  // Only match patterns that turndown produces (not plain text artifacts):
  // - fenced code blocks (```)
  // - markdown links [text](https://...)
  // - bold (**text**)
  // - headings (# ...)
  // - images (![alt](url))
  // Deliberately excluded (too common in plain text): - lists, > quotes, `inline`
  return /```|\[.+?\]\(https?:\/\/[^\s)]+\)|\*\*\S|^\s*#{1,6}\s|!\[/m.test(text);
}

interface ArticleCardProps {
  article: ArticleData;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onHide?: (id: string) => void;
  onSave?: (id: string) => void;
  onImpression?: (id: string) => void;
}

export function ArticleCard({
  article,
  onLike,
  onDislike,
  onHide,
  onSave,
  onImpression,
}: ArticleCardProps) {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
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

  // Use ResizeObserver to reliably detect overflow after markdown renders
  useEffect(() => {
    const el = contentRef.current;
    if (!el || expanded) return;
    const ro = new ResizeObserver(() => {
      setOverflows(el.scrollHeight > CLAMP_HEIGHT);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded]);

  if (hidden) return null;

  function getWhyReason() {
    const reasons: string[] = [];
    if (article.scoreBreakdown.subscribed > 0) {
      reasons.push(`Subscribed to ${article.feedSource.title}`);
    }
    if (article.scoreBreakdown.topicRelevance > 0.5) {
      reasons.push("Matches your topic interests (high relevance)");
    } else if (article.scoreBreakdown.topicRelevance > 0) {
      reasons.push("Related to your topic interests");
    }
    if (article.candidateSources.includes("TRENDING")) {
      reasons.push("Trending today");
    }
    if (reasons.length === 0) reasons.push("Exploring new content for you");
    return reasons;
  }

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
            className="mt-1.5 block text-xl font-semibold leading-snug hover:underline"
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
        {(article.content || article.summary) && (
          <div className="text-sm text-foreground/80">
            {article.content && hasMarkdownFormatting(article.content) ? (
              <>
                <div
                  ref={contentRef}
                  className={
                    !expanded ? "relative overflow-hidden" : undefined
                  }
                  style={
                    !expanded ? { maxHeight: CLAMP_HEIGHT } : undefined
                  }
                >
                  <MarkdownContent content={article.content} />
                  {!expanded && overflows && (
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
                  )}
                </div>
                {overflows && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="mt-1 text-muted-foreground hover:text-foreground"
                  >
                    {expanded ? "Show less" : "Read more"}
                  </button>
                )}
              </>
            ) : article.summary ? (
              <>
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
              </>
            ) : null}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {article.topics.map((t) => (
            <Badge key={t.slug} variant="secondary" className="text-xs">
              {t.label}
            </Badge>
          ))}
        </div>
        {(onLike || onDislike || onHide || onSave) && (
          <>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLiked(!liked);
                  setDisliked(false);
                  onLike?.(article.id);
                }}
                className={liked ? "text-primary" : ""}
              >
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDisliked(!disliked);
                  setLiked(false);
                  onDislike?.(article.id);
                }}
                className={disliked ? "text-destructive" : ""}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSaved(!saved);
                  onSave?.(article.id);
                }}
                className={saved ? "text-primary" : ""}
              >
                <Bookmark className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setHidden(true);
                  onHide?.(article.id);
                }}
              >
                <EyeOff className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWhy(!showWhy)}
                className="ml-auto text-xs text-muted-foreground"
              >
                Why this?
                {showWhy ? (
                  <ChevronUp className="ml-1 h-3 w-3" />
                ) : (
                  <ChevronDown className="ml-1 h-3 w-3" />
                )}
              </Button>
            </div>
            {showWhy && (
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                {getWhyReason().map((reason, i) => (
                  <p key={i}>· {reason}</p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
