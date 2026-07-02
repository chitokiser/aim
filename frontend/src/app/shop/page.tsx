"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Coins, Package, Sparkles } from "lucide-react";
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

  useEffect(() => { void loadProducts(); }, [loadProducts]);

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
            <Link key={p.id} href={`/shop/${p.id}`} className="group">
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
                  {p.supplyApPrice !== undefined && p.apPrice - p.supplyApPrice > 0 && (
                    <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      <Sparkles className="h-3 w-3" />
                      {sh.maxExpPayable.replace("{n}", (p.apPrice - p.supplyApPrice).toLocaleString())}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
