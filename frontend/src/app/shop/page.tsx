"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Coins, Package, Sparkles, TriangleAlert, Star } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CjProduct {
  id: string;
  nameKo: string;
  images: string[];
  apPrice: number;
  supplyApPrice?: number;
  active: boolean;
  category?: string;
}

export default function ShopPage() {
  const { t } = useLanguage();
  const sh = t.shop;
  const [products, setProducts] = useState<CjProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [featuredProducts, setFeaturedProducts] = useState<CjProduct[]>([]);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/cj-shop/products`);
      const data = (await res.json()) as CjProduct[];
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFeaturedProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/cj-shop/featured`);
      const data = (await res.json()) as CjProduct[];
      setFeaturedProducts(Array.isArray(data) ? data : []);
    } catch {
      setFeaturedProducts([]);
    }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);
  useEffect(() => { void loadFeaturedProducts(); }, [loadFeaturedProducts]);

  const availableCategories = Array.from(new Set(products.map((p) => p.category || "other")));
  const filteredProducts = category === "all" ? products : products.filter((p) => (p.category || "other") === category);

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-1 flex items-center gap-2">
          <Package className="h-7 w-7 text-violet-500" />
          {sh.title}
        </h1>
        <p className="text-muted-foreground">{sh.subtitle}</p>
      </div>

      {featuredProducts.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
            <div>
              <h2 className="font-bold text-lg leading-tight">{sh.featuredTitle}</h2>
              <p className="text-xs text-muted-foreground">{sh.featuredSubtitle}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredProducts.map((p) => (
              <ProductCard key={p.id} p={p} sh={sh} />
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-4">
        <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{sh.noReturnsNotice}</p>
      </div>

      {availableCategories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setCategory("all")}
            className={buttonVariants({ size: "sm", variant: category === "all" ? "default" : "outline" })}
          >
            {sh.categories.all}
          </button>
          {availableCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={buttonVariants({ size: "sm", variant: category === c ? "default" : "outline" })}
            >
              {sh.categories[c as keyof typeof sh.categories] ?? sh.categories.other}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-64 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-16">{sh.noProducts}</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredProducts.map((p) => (
            <ProductCard key={p.id} p={p} sh={sh} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ p, sh }: { p: CjProduct; sh: ReturnType<typeof useLanguage>["t"]["shop"] }) {
  return (
    <Link href={`/shop/${p.id}`} className="group">
      <Card className="h-full overflow-hidden hover:shadow-lg transition-all duration-200 group-hover:-translate-y-0.5">
        <div className="aspect-square bg-muted overflow-hidden">
          {p.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.images[0]} alt={p.nameKo} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <p className="font-semibold text-sm leading-snug line-clamp-2 mb-2 min-h-[2.5rem]">{p.nameKo}</p>
          <div className="flex items-center justify-between mb-2">
            <Badge className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white border-0 gap-1">
              <Coins className="h-3 w-3" />
              {p.apPrice.toLocaleString()} AP
            </Badge>
            <span className={buttonVariants({ size: "sm", variant: "outline", className: "text-xs" })}>
              {sh.buyBtn}
            </span>
          </div>
          {p.supplyApPrice !== undefined && p.apPrice - p.supplyApPrice > 0 && p.apPrice > 0 && (
            <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              <Sparkles className="h-3 w-3" />
              {sh.expPercentBadge.replace(
                "{n}",
                // 10% of the margin is reserved as mandatory AP to fund the mentor
                // bonus — must match MENTOR_FUND_RATIO in backend cj-shop.service.ts.
                Math.floor(((p.apPrice - p.supplyApPrice) / p.apPrice) * 100 * 0.9).toString()
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
