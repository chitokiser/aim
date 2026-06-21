"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Gavel, Clock, Eye, TrendingUp, Pencil, Trash2 } from "lucide-react";

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

const CAT_LABEL: Record<string, string> = {
  youtube: "YouTube", wordpress: "WordPress", instagram: "Instagram",
  tiktok: "TikTok", google: "Google", telegram_group: "TG Group",
  telegram_channel: "TG Channel", telegram_bot: "TG Bot",
  jumpdao_store: "Jumpdao Store", jumpdao_gold: "Jumpdao Gold",
};

const SORTS = [
  { key: "sortEndingSoon", value: "ending_soon" },
  { key: "sortPopular", value: "popular" },
  { key: "sortLatest", value: "latest" },
  { key: "sortHighest", value: "highest" },
  { key: "sortViews", value: "views" },
] as const;

const STATUSES = [
  "pending_approval", "active", "ended", "transfer_pending",
  "completed", "disputed", "cancelled",
];

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
  description?: string;
  monthlyRevenue?: number;
  transferMethod?: string;
}

interface EditForm {
  title: string;
  category: string;
  description: string;
  thumbnailUrl: string;
  startPrice: string;
  buyNowPrice: string;
  monthlyRevenue: string;
  endsAt: string;
  transferMethod: string;
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

function toDatetimeLocal(iso: string): string {
  const dt = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export default function AuctionPage() {
  const { t } = useLanguage();
  const a = t.auction;
  const { user, token } = useAuthStore();
  const isAdmin = user?.isAdmin === true;

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("ending_soon");
  const [category, setCategory] = useState("");
  const [showAll, setShowAll] = useState(false);

  const [editAuction, setEditAuction] = useState<Auction | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const authHeader = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const load = () => {
    setLoading(true);
    if (isAdmin && showAll) {
      fetch(`${API}/auction/admin/all`, { headers: authHeader() })
        .then((r) => r.json())
        .then((data) => setAuctions(Array.isArray(data) ? data : []))
        .catch(() => setAuctions([]))
        .finally(() => setLoading(false));
    } else {
      const params = new URLSearchParams({ sort });
      if (category) params.set("category", category);
      fetch(`${API}/auction?${params}`)
        .then((r) => r.json())
        .then((data) => setAuctions(Array.isArray(data) ? data : []))
        .catch(() => setAuctions([]))
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => { load(); }, [sort, category, showAll, isAdmin]);

  const openEdit = (item: Auction) => {
    setEditAuction(item);
    setEditForm({
      title: item.title ?? "",
      category: item.category ?? "",
      description: item.description ?? "",
      thumbnailUrl: item.thumbnailUrl ?? "",
      startPrice: String(item.startPrice ?? ""),
      buyNowPrice: String(item.buyNowPrice ?? ""),
      monthlyRevenue: String(item.monthlyRevenue ?? ""),
      endsAt: item.endsAt ? toDatetimeLocal(item.endsAt) : "",
      transferMethod: item.transferMethod ?? "",
      status: item.status ?? "active",
    });
    setEditError("");
  };

  const handleEditSave = async () => {
    if (!editAuction || !editForm) return;
    setSaving(true);
    setEditError("");
    try {
      const body: Record<string, unknown> = {
        title: editForm.title,
        category: editForm.category,
        description: editForm.description,
        thumbnailUrl: editForm.thumbnailUrl || undefined,
        startPrice: editForm.startPrice ? Number(editForm.startPrice) : undefined,
        buyNowPrice: editForm.buyNowPrice ? Number(editForm.buyNowPrice) : undefined,
        monthlyRevenue: editForm.monthlyRevenue ? Number(editForm.monthlyRevenue) : undefined,
        endsAt: editForm.endsAt ? new Date(editForm.endsAt).toISOString() : undefined,
        transferMethod: editForm.transferMethod,
        status: editForm.status,
      };
      const res = await fetch(`${API}/auction/admin/${editAuction.id}`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message ?? "Failed to save");
      }
      setEditAuction(null);
      setEditForm(null);
      load();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete auction "${title}"? This will refund any active bidders.`)) return;
    try {
      const res = await fetch(`${API}/auction/admin/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Delete failed");
      load();
    } catch {
      alert("Failed to delete auction.");
    }
  };

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
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowAll(!showAll)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                showAll
                  ? "bg-purple-600 border-purple-600 text-white"
                  : "border-purple-400 text-purple-600 hover:bg-purple-50"
              )}
            >
              {showAll ? "전체 보기 ON" : "전체 보기"}
            </button>
          )}
          <a href="/auction/register" className={cn(buttonVariants({ variant: "default" }), "bg-amber-500 hover:bg-amber-600 text-white")}>
            {a.registerBtn}
          </a>
        </div>
      </div>

      {/* Sort tabs — hidden when showAll */}
      {!showAll && (
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
      )}

      {/* Category filter — hidden when showAll */}
      {!showAll && (
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
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">{a.noAuctions}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {auctions.map((item) => (
            <div key={item.id} className="rounded-xl border bg-card overflow-hidden hover:shadow-lg transition-shadow">
              <Link href={`/auction/${item.id}`} className="group block">
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
                    {CAT_LABEL[item.category] ?? item.category?.replace(/_/g, " ")}
                  </span>
                  {item.status === "active" && (
                    <span className="absolute top-2 right-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">LIVE</span>
                  )}
                  {showAll && item.status !== "active" && (
                    <span className="absolute top-2 right-2 text-xs bg-gray-600 text-white px-2 py-0.5 rounded-full capitalize">
                      {item.status.replace(/_/g, " ")}
                    </span>
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

              {/* Admin controls */}
              {isAdmin && (
                <div className="border-t flex gap-1 px-3 py-2 bg-amber-50/60 dark:bg-amber-950/20">
                  <button
                    onClick={() => openEdit(item)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> 수정
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.title)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> 삭제
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editAuction && editForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">옥션 수정</h2>
              <button
                onClick={() => { setEditAuction(null); setEditForm(null); }}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              {editError && <p className="text-sm text-red-500">{editError}</p>}

              <div>
                <label className="text-xs font-medium text-muted-foreground">제목</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">카테고리</label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  >
                    {Object.entries(CAT_LABEL).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">상태</label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">설명</label>
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">썸네일 URL</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={editForm.thumbnailUrl}
                  onChange={(e) => setEditForm({ ...editForm, thumbnailUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">시작가 (AP)</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={editForm.startPrice}
                    onChange={(e) => setEditForm({ ...editForm, startPrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">즉구가 (AP)</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={editForm.buyNowPrice}
                    onChange={(e) => setEditForm({ ...editForm, buyNowPrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">월 수익 (AP)</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={editForm.monthlyRevenue}
                    onChange={(e) => setEditForm({ ...editForm, monthlyRevenue: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">마감일시</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={editForm.endsAt}
                  onChange={(e) => setEditForm({ ...editForm, endsAt: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">이전 방법</label>
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={editForm.transferMethod}
                  onChange={(e) => setEditForm({ ...editForm, transferMethod: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 p-5 border-t">
              <button
                onClick={handleEditSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white py-2 text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
              <button
                onClick={() => { setEditAuction(null); setEditForm(null); }}
                className="px-4 rounded-lg border hover:bg-muted py-2 text-sm font-medium transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
