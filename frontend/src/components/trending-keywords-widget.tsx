"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const REFRESH_MS = 10 * 60 * 1000;

interface TrendingKeyword {
  title: string;
  traffic?: string;
}

export function TrendingKeywordsWidget() {
  const { t } = useLanguage();
  const b = t.blog;
  const [keywords, setKeywords] = useState<TrendingKeyword[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${API}/api/blog/trending-keywords`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: TrendingKeyword[]) => {
          if (!cancelled) setKeywords(data);
        })
        .catch(() => {
          if (!cancelled) setKeywords([]);
        });
    };
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (keywords.length === 0) return null;

  return (
    <div className="mb-8 rounded-xl border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <TrendingUp className="h-4 w-4 text-emerald-500" />
        {b.trendingTitle}
      </div>
      <div className="flex flex-wrap gap-2">
        {keywords.slice(0, 10).map((k, i) => (
          <a
            key={`${k.title}-${i}`}
            href={`https://www.google.com/search?q=${encodeURIComponent(k.title)}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs transition-colors hover:bg-muted"
          >
            <span className="font-bold text-emerald-500">{i + 1}</span>
            {k.title}
          </a>
        ))}
      </div>
    </div>
  );
}
