"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Copy,
  Loader2,
  MessageSquare,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import type { Basket } from "@/lib/types";
import { buildShareUrl } from "@/lib/share";

interface Props {
  basket: Basket;
  executionNotionalUsd?: number;
}

export function ExplainBasket({ basket, executionNotionalUsd }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedTweet, setCopiedTweet] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  async function openAndExplain() {
    setOpen(true);
    if (text) return; // already generated
    setLoading(true);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basket }),
      });
      const data = await res.json();
      setText(data.text ?? null);
    } finally {
      setLoading(false);
    }
  }

  const shareUrl = buildShareUrl(
    {
      basket,
      execution: executionNotionalUsd
        ? { notionalUsd: executionNotionalUsd, executedAt: new Date().toISOString() }
        : undefined,
    },
  );

  async function copy(t: string, which: "tweet" | "link") {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(t);
      if (which === "tweet") {
        setCopiedTweet(true);
        setTimeout(() => setCopiedTweet(false), 1500);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1500);
      }
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={openAndExplain}>
          <Sparkles className="h-3.5 w-3.5" />
          Explain my basket
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => copy(shareUrl, "link")}
          title="Copy share link"
        >
          {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" /> : <Share2 className="h-3.5 w-3.5" />}
          {copiedLink ? "Copied" : "Share basket"}
        </Button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-brand-500" />
                  Tweet-ready explanation
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  280 characters · ready to copy or post directly to X
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading && (
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 dark:bg-background/40 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                  Asking the agent for a clean explanation…
                </div>
              )}
              {!loading && text && (
                <div className="rounded-lg border border-border/60 bg-secondary/30 dark:bg-background/40 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">
                      {text.length} / 280
                    </Badge>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => copy(text, "tweet")}>
                        {copiedTweet ? <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedTweet ? "Copied" : "Copy"}
                      </Button>
                      <a
                        href={`https://x.com/intent/tweet?text=${encodeURIComponent(text + "\n\n" + shareUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm">Post on X</Button>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border/60 bg-secondary/30 dark:bg-background/40 p-3 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Direct share link
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate font-mono text-[11px]">{shareUrl}</code>
                  <Button size="sm" variant="ghost" onClick={() => copy(shareUrl, "link")}>
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
