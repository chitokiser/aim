"use client";

import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TrendingUp, Play, ExternalLink, Search, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const CACHE_KEY = "coupang_products_v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CoupangProduct {
  id: string;
  productNo?: number;
  name: string;
  iframeCode?: string;
  iframeSrc: string;
  iframeWidth: number;
  iframeHeight: number;
  videoUrl?: string | null;
  active: boolean;
  clicks?: number;
  createdAt: string;
}

export default function CoupangPage() {
  const [products, setProducts] = useState<CoupangProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoTarget, setVideoTarget] = useState<CoupangProduct | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    // Show cached data instantly if available
    let cacheIsFresh = false;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { data, ts } = JSON.parse(raw) as { data: CoupangProduct[]; ts: number };
        if (Array.isArray(data) && data.length > 0) {
          setProducts(data);
          setLoading(false);
          cacheIsFresh = Date.now() - ts < CACHE_TTL_MS;
        }
      }
    } catch { /* ignore */ }

    // Skip network fetch if cache is still fresh
    if (cacheIsFresh) return;

    fetch(`${API}/api/coupang/products`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setProducts(data as CoupangProduct[]);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
          } catch { /* ignore */ }
        }
      })
      .catch(() => { /* keep showing cached data on error */ })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return products;
    const isNumber = /^\d+$/.test(q);
    if (isNumber) {
      return products.filter((p) => p.productNo === Number(q));
    }
    const lower = q.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(lower));
  }, [products, query]);

  const getProductLink = (iframeSrc: string) => {
    try {
      const params = new URL(iframeSrc).searchParams;
      return params.get("link") || params.get("linkUrl") || iframeSrc;
    } catch {
      return iframeSrc;
    }
  };

  const isYouTube = (url: string) =>
    url.includes("youtube.com") || url.includes("youtu.be");

  const getYouTubeEmbed = (url: string) => {
    const match =
      url.match(/(?:v=|youtu\.be\/)([^&?/]+)/) ??
      url.match(/embed\/([^?]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="h-7 w-7 text-orange-500" />
          <h1 className="text-3xl font-black">트랜드픽</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          AI119가 엄선한 트렌드 추천 상품 목록입니다.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="상품명 또는 번호로 검색..."
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
            <div key={i} className="rounded-xl border bg-muted animate-pulse h-80" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>{query ? `"${query}" 검색 결과가 없습니다.` : "등록된 상품이 없습니다."}</p>
          {query && (
            <button onClick={() => setQuery("")} className="mt-3 text-sm text-orange-500 hover:underline">
              검색 초기화
            </button>
          )}
        </div>
      ) : (
        <>
          {query && (
            <p className="text-xs text-muted-foreground mb-3">
              검색 결과 {filtered.length}개
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="rounded-xl border bg-card overflow-hidden flex flex-col hover:shadow-lg transition-shadow"
              >
                {/* Iframe area */}
                <div className="flex items-center justify-center bg-muted/30 p-3 min-h-[230px]">
                  <iframe
                    loading="lazy"
                    srcDoc={(() => {
                    const w = product.iframeWidth || 120;
                    const h = product.iframeHeight || 240;
                    const code = product.iframeCode || `<iframe src="${product.iframeSrc}" width="${w}" height="${h}" frameborder="0" scrolling="no" referrerpolicy="unsafe-url" loading="lazy"></iframe>`;
                    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;}body{overflow:hidden;}iframe{display:block;margin-top:-28px;}</style></head><body>${code}</body></html>`;
                  })()}
                    width={product.iframeWidth || 120}
                    height={(product.iframeHeight || 240) - 28}
                    frameBorder="0"
                    scrolling="no"
                    title={product.name}
                    style={{ maxWidth: "100%" }}
                  />
                </div>

                {/* Info */}
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <Badge variant="outline" className="text-xs w-fit font-mono text-muted-foreground">
                    #{product.productNo ?? "—"}
                  </Badge>
                  <p className="text-sm font-semibold leading-snug line-clamp-2">
                    {product.name}
                  </p>

                  {/* Video link */}
                  {product.videoUrl && (
                    <button
                      onClick={() => setVideoTarget(product)}
                      className="mt-auto flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      상품 영상 보기
                    </button>
                  )}

                  {/* Direct link */}
                  <a
                    href={getProductLink(product.iframeSrc)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      fetch(`${API}/api/coupang/products/${product.id}/click`, { method: "POST" }).catch(() => {});
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-auto"
                  >
                    <ExternalLink className="h-3 w-3" />
                    쿠팡에서 보기
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Video modal */}
      {videoTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setVideoTarget(null)}
        >
          <div
            className="bg-card rounded-xl overflow-hidden w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <p className="font-semibold text-sm truncate pr-4">{videoTarget.name}</p>
              <button
                onClick={() => setVideoTarget(null)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="aspect-video w-full">
              {videoTarget.videoUrl && isYouTube(videoTarget.videoUrl) ? (
                <iframe
                  src={getYouTubeEmbed(videoTarget.videoUrl) ?? videoTarget.videoUrl}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title={videoTarget.name}
                />
              ) : (
                <video
                  src={videoTarget.videoUrl ?? ""}
                  controls
                  autoPlay
                  className="w-full h-full bg-black"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
