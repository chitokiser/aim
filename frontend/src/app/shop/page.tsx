"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Coins, Package, Sparkles, TriangleAlert, Star, Search, Sun } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CjProduct {
  id: string;
  productNumber?: number;
  nameKo: string;
  images: string[];
  apPrice: number;
  supplyApPrice?: number;
  active: boolean;
  category?: string;
}

function ShopPageContent() {
  const { t } = useLanguage();
  const sh = t.shop;
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<CjProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(searchParams.get("category") ?? "all");
  const [featuredProducts, setFeaturedProducts] = useState<CjProduct[]>([]);
  const [summer2026Products, setSummer2026Products] = useState<CjProduct[]>([]);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

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

  const loadSummer2026Products = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/cj-shop/summer2026`);
      const data = (await res.json()) as CjProduct[];
      setSummer2026Products(Array.isArray(data) ? data : []);
    } catch {
      setSummer2026Products([]);
    }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);
  useEffect(() => { void loadFeaturedProducts(); }, [loadFeaturedProducts]);
  useEffect(() => { void loadSummer2026Products(); }, [loadSummer2026Products]);

  const availableCategories = Array.from(new Set(products.map((p) => p.category || "other")));
  const searchTerm = search.trim().toLowerCase();
  const filteredProducts = products
    .filter((p) => category === "all" || (p.category || "other") === category)
    .filter((p) =>
      !searchTerm ||
      p.nameKo.toLowerCase().includes(searchTerm) ||
      String(p.productNumber ?? "").includes(searchTerm)
    );

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-1 flex items-center gap-2">
          <Package className="h-7 w-7 text-violet-500" />
          {sh.title}
        </h1>
        <p className="text-muted-foreground">{sh.subtitle}</p>
      </div>

      <div className="mb-8 flex items-start gap-3 rounded-xl border border-violet-300/60 bg-gradient-to-r from-violet-50 to-cyan-50 dark:from-violet-950/30 dark:to-cyan-950/30 dark:border-violet-800/60 p-4">
        <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-violet-700 dark:text-violet-300">{sh.expBannerTitle}</p>
          <p className="text-xs text-violet-600/90 dark:text-violet-400/90 leading-relaxed mt-0.5">{sh.expBannerDesc}</p>
        </div>
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

      {summer2026Products.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sun className="h-5 w-5 text-cyan-500" />
            <div>
              <h2 className="font-bold text-lg leading-tight">{sh.summer2026Title}</h2>
              <p className="text-xs text-muted-foreground">{sh.summer2026Subtitle}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {summer2026Products.map((p) => (
              <ProductCard key={p.id} p={p} sh={sh} />
            ))}
          </div>
        </div>
      )}

      <div className="relative mb-8 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={sh.searchPlaceholder}
          className="w-full rounded-full border bg-card pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>

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
        <p className="text-center text-sm text-muted-foreground py-16">
          {searchTerm ? sh.noSearchResults : sh.noProducts}
        </p>
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

export default function ShopPage() {
  return (
    <Suspense>
      <ShopPageContent />
    </Suspense>
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
          {p.productNumber !== undefined && (
            <p className="text-[11px] font-mono text-muted-foreground mb-1">No. {p.productNumber}</p>
          )}
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
            <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-400 dark:border-amber-700 font-semibold text-[11px]">
              <Sparkles className="h-3 w-3" />
              {sh.expPercentBadge.replace(
                "{n}",
                // 10% of the margin is reserved as mandatory AP to fund the mentor
                // bonus — must match MENTOR_FUND_RATIO in backend cj-shop.service.ts.
                Math.floor(((p.apPrice - p.supplyApPrice) / p.apPrice) * 100 * 0.9).toString()
              )}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
