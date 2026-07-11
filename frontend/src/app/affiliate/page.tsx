"use client";

import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Tag, ExternalLink, Search, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const CACHE_KEY = "affiliate_products_v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface AffiliateProduct {
  id: string;
  name: string;
  category: string;
  embedCode: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  width: number;
  height: number;
  active: boolean;
  clicks?: number;
  createdAt: string;
}

const CATEGORY_KEYS = [
  "all", "cps", "cpa", "cpl", "cpi", "cpc", "cpm", "cpv", "cpe", "revshare",
] as const;

export default function AffiliatePage() {
  const { t } = useLanguage();
  const af = t.affiliate;

  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cacheIsFresh = false;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { data, ts } = JSON.parse(raw) as { data: AffiliateProduct[]; ts: number };
        if (Array.isArray(data) && data.length > 0) {
          setProducts(data);
          setLoading(false);
          cacheIsFresh = Date.now() - ts < CACHE_TTL_MS;
        }
      }
    } catch { /* ignore */ }

    if (cacheIsFresh) return;

    fetch(`${API}/api/linkprice/products`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setProducts(data as AffiliateProduct[]);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
          } catch { /* ignore */ }
        }
      })
      .catch(() => { /* keep showing cached data on error */ })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = category === "all" ? products : products.filter((p) => p.category === category);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [products, category, query]);

  const categoryLabel = (key: string) => {
    const map: Record<string, string> = {
      all: af.catAll, cps: af.catCps, cpa: af.catCpa, cpl: af.catCpl,
      cpi: af.catCpi, cpc: af.catCpc, cpm: af.catCpm, cpv: af.catCpv,
      cpe: af.catCpe, revshare: af.catRevshare,
    };
    return map[key] ?? key;
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Tag className="h-7 w-7 text-violet-500" />
          <h1 className="text-3xl font-black">{af.title}</h1>
        </div>
        <p className="text-muted-foreground text-sm">{af.subtitle}</p>
        <p className="text-xs text-muted-foreground mt-1">{af.disclaimer}</p>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORY_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              category === key
                ? "bg-violet-600 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {categoryLabel(key)}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={af.searchPlaceholder}
          className="pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-muted animate-pulse h-64" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>{query ? af.searchNoResults : af.noProducts}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="rounded-xl border bg-card overflow-hidden flex flex-col hover:shadow-lg transition-shadow"
            >
              {/* Embed area — ad-box products render inside a sandboxed srcDoc iframe so
                  ad-network script/iframe embed codes can never touch the host page's
                  DOM; deep-link products (no embed code) just show their thumbnail. */}
              <div className="flex items-center justify-center bg-muted/30 p-3 min-h-[180px] overflow-hidden">
                {product.embedCode ? (
                  <iframe
                    loading="lazy"
                    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;}body{overflow:hidden;display:flex;align-items:center;justify-content:center;}</style></head><body>${product.embedCode}</body></html>`}
                    width={product.width || 300}
                    height={product.height || 250}
                    frameBorder="0"
                    scrolling="no"
                    title={product.name}
                    style={{ maxWidth: "100%" }}
                  />
                ) : product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-[180px] object-contain" />
                ) : null}
              </div>

              <div className="p-3 flex flex-col gap-2 flex-1">
                <p className="text-sm font-semibold leading-snug line-clamp-2">{product.name}</p>
                {product.linkUrl && (
                  <a
                    href={product.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    onClick={() => {
                      fetch(`${API}/api/linkprice/products/${product.id}/click`, { method: "POST" }).catch(() => {});
                    }}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium mt-auto"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {af.visitBtn}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
