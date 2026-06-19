"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Gavel, Clock, Eye, TrendingUp } from "lucide-react";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "https://ai119-bot-production.up.railway.app"}/api`;

const CATEGORIES = [
  "catAll", "catYoutube", "catWordpress", "catInstagram", "catTiktok",
  "catGoogle", "catTelegramGroup", "catTelegramChannel", "catTelegramBot",
  "catJumpdaoStore", "catJumpdaoGold",
] as const;

const CAT_VALUES: Record<string, string> = {
  catAll: "", catYoutube: "youtube", catWordpress: "wordpress",
  catInstagram: "instagram", catTiktok: "tiktok", catGoogle: "google",
  catTelegramGroup: "telegram_group", catTelegramChannel: "telegram_channel",
  catTelegramBot: "telegram_bot", catJumpdaoStore: "jumpdao_store",
  catJumpdaoGold: "jumpdao_gold",
};

const SORTS = [
  { key: "sortEndingSoon", value: "ending_soon" },
  { key: "sortPopular", value: "popular" },
  { key: "sortLatest", value: "latest" },
  { key: "sortHighest", value: "highest" },
  { key: "sortViews", value: "views" },
] as const;

interface Auction {
  id: string;
  title: string;
  category: string;
  thumbnailUrl?: string;
  currentBid: number;
  startPrice: number;
  buyNowPrice?: number;
  bidCount: number;
  viewCount: number;
  endsAt: string;
  status: string;
}

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export default function AuctionPage() {
  const { t } = useLanguage();
  const a = t.auction;
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("ending_soon");
  const [category, setCategory] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ sort });
    if (category) params.set("category", category);
    fetch(`${API}/auction?${params}`)
      .then((r) => r.json())
      .then((data) => setAuctions(Array.isArray(data) ? data : []))
      .catch(() => setAuctions([]))
      .finally(() => setLoading(false));
  }, [sort, category]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gavel className="h-8 w-8 text-amber-500" />
            {a.title}
          </h1>
          <p className="text-muted-foreground mt-1">{a.subtitle}</p>
        </div>
        <a href="/auction/register" className={cn(buttonVariants({ variant: "default" }), "bg-amber-500 hover:bg-amber-600 text-white")}>
          {a.registerBtn}
        </a>
      </div>

      {/* Sort tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SORTS.map(({ key, value }) => (
          <button
            key={value}
            onClick={() => setSort(value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              sort === value ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:bg-amber-100"
            )}
          >
            {a[key as keyof typeof a]}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(CAT_VALUES[cat])}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              category === CAT_VALUES[cat]
                ? "bg-amber-500 border-amber-500 text-white"
                : "border-border text-muted-foreground hover:border-amber-300"
            )}
          >
            {a[cat as keyof typeof a]}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">{a.noAuctions}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {auctions.map((item) => (
            <Link
              key={item.id}
              href={`/auction/${item.id}`}
              className="group rounded-xl border bg-card overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-muted relative overflow-hidden">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gavel className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                <span className="absolute top-2 left-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded-full capitalize">
                  {item.category?.replace(/_/g, " ")}
                </span>
                {item.status === "active" && (
                  <span className="absolute top-2 right-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">LIVE</span>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold line-clamp-1 mb-2">{item.title}</h3>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{a.currentBid}</p>
                    <p className="text-lg font-bold text-amber-600">{(item.currentBid || item.startPrice).toLocaleString()} AP</p>
                  </div>
                  {item.buyNowPrice && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{a.buyNow}</p>
                      <p className="text-sm font-semibold text-green-600">{item.buyNowPrice.toLocaleString()} AP</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeLeft(item.endsAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {item.bidCount} {a.bids}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {item.viewCount}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
