"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Play, ExternalLink } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CoupangProduct {
  id: string;
  productNo?: number;
  name: string;
  iframeCode: string;
  iframeSrc: string;
  iframeWidth: number;
  iframeHeight: number;
  videoUrl?: string | null;
  active: boolean;
  createdAt: string;
}

export default function CoupangPage() {
  const [products, setProducts] = useState<CoupangProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoTarget, setVideoTarget] = useState<CoupangProduct | null>(null);

  useEffect(() => {
    fetch(`${API}/api/coupang/products`)
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

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
      <div className="mb-8">
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

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-muted animate-pulse h-80" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>등록된 상품이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="rounded-xl border bg-card overflow-hidden flex flex-col hover:shadow-lg transition-shadow"
            >
              {/* Iframe area */}
              <div className="flex items-center justify-center bg-muted/30 p-3 min-h-[260px]">
                <iframe
                  src={product.iframeSrc}
                  width={product.iframeWidth || 120}
                  height={product.iframeHeight || 240}
                  frameBorder="0"
                  scrolling="no"
                  referrerPolicy="unsafe-url"
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
                  href={product.iframeSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-auto"
                >
                  <ExternalLink className="h-3 w-3" />
                  쿠팡에서 보기
                </a>
              </div>
            </div>
          ))}
        </div>
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
