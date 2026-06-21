"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Gavel, Clock, Eye, TrendingUp, ArrowLeft, Pencil, Trash2, ShieldCheck } from "lucide-react";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "https://ai119-bot-production.up.railway.app"}/api`;

const STATUSES = [
  "pending_approval", "active", "ended", "transfer_pending",
  "completed", "disputed", "cancelled",
];

const CAT_LABEL: Record<string, string> = {
  youtube: "YouTube", wordpress: "WordPress", instagram: "Instagram",
  tiktok: "TikTok", google: "Google", telegram_group: "TG Group",
  telegram_channel: "TG Channel", telegram_bot: "TG Bot",
  jumpdao_store: "Jumpdao Store", jumpdao_gold: "Jumpdao Gold",
};

interface Auction {
  id: string;
  title: string;
  category: string;
  description: string;
  thumbnailUrl?: string;
  monthlyRevenue?: number;
  startPrice: number;
  buyNowPrice?: number;
  currentBid: number;
  currentBidderId?: string;
  bidCount: number;
  viewCount: number;
  endsAt: string;
  status: string;
  transferMethod: string;
  sellerId: string;
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

function toDatetimeLocal(iso: string): string {
  const dt = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

interface Bid {
  id: string;
  bidderId: string;
  amount: number;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  ended: "bg-gray-100 text-gray-800",
  transfer_pending: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  disputed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-500",
};

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export default function AuctionDetailClient({ id }: { id: string }) {
  const { t } = useLanguage();
  const a = t.auction;
  const { user, token } = useAuthStore();
  const isAdmin = user?.isAdmin === true;

  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchData = async () => {
    try {
      const [aRes, bRes] = await Promise.all([
        fetch(`${API}/auction/${id}`),
        fetch(`${API}/auction/${id}/bids`),
      ]);
      const aData = await aRes.json();
      const bData = await bRes.json();
      setAuction(aData);
      setBids(Array.isArray(bData) ? bData : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const authHeader = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

  const handleBid = async (amount: number) => {
    if (!user) { setError(a.loginRequired); return; }
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`${API}/auction/${id}/bid`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Error");
      setSuccess("Bid placed!");
      setBidAmount("");
      fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuyNow = async () => {
    if (!user) { setError(a.loginRequired); return; }
    if (!confirm(a.buyNowConfirm)) return;
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`${API}/auction/${id}/buy-now`, {
        method: "POST", headers: authHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Error");
      setSuccess("Purchase successful!");
      fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!confirm(a.confirmTransferDesc)) return;
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`${API}/auction/${id}/confirm-transfer`, {
        method: "POST", headers: authHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Error");
      setSuccess("Transfer confirmed!");
      fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = () => {
    if (!auction) return;
    setEditForm({
      title: auction.title ?? "",
      category: auction.category ?? "",
      description: auction.description ?? "",
      thumbnailUrl: auction.thumbnailUrl ?? "",
      startPrice: String(auction.startPrice ?? ""),
      buyNowPrice: String(auction.buyNowPrice ?? ""),
      monthlyRevenue: String(auction.monthlyRevenue ?? ""),
      endsAt: auction.endsAt ? toDatetimeLocal(auction.endsAt) : "",
      transferMethod: auction.transferMethod ?? "",
      status: auction.status ?? "active",
    });
    setEditError("");
    setShowEditModal(true);
  };

  const handleAdminSave = async () => {
    if (!auction || !editForm) return;
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
      const res = await fetch(`${API}/auction/admin/${auction.id}`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message ?? "Failed to save");
      }
      setShowEditModal(false);
      fetchData();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleAdminDelete = async () => {
    if (!auction) return;
    if (!confirm(`Delete auction "${auction.title}"? Active bidders will be refunded.`)) return;
    try {
      const res = await fetch(`${API}/auction/admin/${auction.id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Delete failed");
      window.location.href = "/auction";
    } catch {
      setError("Failed to delete auction.");
    }
  };

  const handleAdminAction = async (path: string, body?: Record<string, unknown>) => {
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`${API}/auction/admin/${auction!.id}/${path}`, {
        method: "POST",
        headers: authHeader(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Error");
      setSuccess(data.message ?? "Done");
      fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispute = async () => {
    if (!confirm(a.disputeDesc)) return;
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`${API}/auction/${id}/dispute`, {
        method: "POST", headers: authHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Error");
      setSuccess("Dispute raised. Admin will review.");
      fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Loading...</div>;
  if (!auction) return <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Auction not found.</div>;

  const isActive = auction.status === "active";
  const isTransferPending = auction.status === "transfer_pending";
  const isBuyer = user && auction.currentBidderId === user.telegramId?.toString();
  const statusKey = `status${auction.status.split("_").map((s: string) => s[0].toUpperCase() + s.slice(1)).join("")}` as keyof typeof a;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link href="/auction" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: details */}
        <div className="lg:col-span-2 space-y-4">
          {auction.thumbnailUrl && (
            <img src={auction.thumbnailUrl} alt={auction.title} className="w-full rounded-xl object-cover max-h-72" />
          )}

          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl font-bold">{auction.title}</h1>
            <span className={cn("text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap", STATUS_COLORS[auction.status] ?? "bg-muted")}>
              {a[statusKey] ?? auction.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">{a.startPrice}</p>
              <p className="font-semibold">{auction.startPrice.toLocaleString()} AP</p>
            </div>
            {auction.monthlyRevenue && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">{a.monthlyRevenue}</p>
                <p className="font-semibold">{auction.monthlyRevenue.toLocaleString()} AP</p>
              </div>
            )}
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{a.timeLeft}</p>
              <p className="font-semibold">{timeLeft(auction.endsAt)}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" />{a.views}</p>
              <p className="font-semibold">{auction.viewCount}</p>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="font-semibold mb-2">{a.description}</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{auction.description}</p>
          </div>

          <div className="rounded-lg border p-4 text-sm">
            <p><span className="text-muted-foreground">{a.transferMethod}:</span> {auction.transferMethod}</p>
            <p className="mt-1 text-xs text-muted-foreground">{a.revenueShare}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{a.antiSnipe}</p>
          </div>

          {/* Bid History */}
          <div className="rounded-lg border p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {a.bidHistory} ({auction.bidCount})
            </h2>
            {bids.length === 0 ? (
              <p className="text-sm text-muted-foreground">{a.noBids}</p>
            ) : (
              <div className="space-y-2">
                {bids.map((bid, i) => (
                  <div key={bid.id} className={cn("flex items-center justify-between py-2 text-sm", i < bids.length - 1 && "border-b")}>
                    <span className="text-muted-foreground font-mono text-xs">{bid.bidderId.slice(0, 8)}...</span>
                    <span className="font-semibold text-amber-600">{bid.amount.toLocaleString()} AP</span>
                    <span className="text-xs text-muted-foreground">{new Date(bid.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: bid panel */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-4 sticky top-20">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{a.currentBid}</p>
              <p className="text-3xl font-bold text-amber-600">{(auction.currentBid || auction.startPrice).toLocaleString()} AP</p>
              {auction.buyNowPrice && (
                <p className="text-sm text-muted-foreground mt-1">
                  {a.buyNow}: <span className="font-semibold text-green-600">{auction.buyNowPrice.toLocaleString()} AP</span>
                </p>
              )}
            </div>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            {success && <p className="text-sm text-green-600 text-center">{success}</p>}

            {isActive && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{a.placeBid}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[10000, 50000, 100000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleBid((auction.currentBid || auction.startPrice) + amt)}
                      disabled={submitting}
                      className="rounded-lg border py-2 text-xs font-semibold hover:bg-amber-50 hover:border-amber-300 transition-colors disabled:opacity-50"
                    >
                      +{(amt / 1000).toFixed(0)}K AP
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={a.bidAmountLabel}
                    className="flex-1 rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    onClick={() => handleBid(Number(bidAmount))}
                    disabled={submitting || !bidAmount}
                    className="rounded-lg bg-amber-500 text-white px-4 py-2 text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? a.bidding : a.bidBtn}
                  </button>
                </div>

                {auction.buyNowPrice && (
                  <button
                    onClick={handleBuyNow}
                    disabled={submitting}
                    className="w-full rounded-lg bg-green-600 text-white py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {a.buyNowBtn} — {auction.buyNowPrice.toLocaleString()} AP
                  </button>
                )}
              </div>
            )}

            {isTransferPending && isBuyer && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{a.confirmTransferDesc}</p>
                <button
                  onClick={handleConfirmTransfer}
                  disabled={submitting}
                  className="w-full rounded-lg bg-blue-600 text-white py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {a.confirmTransferBtn}
                </button>
                <button
                  onClick={handleDispute}
                  disabled={submitting}
                  className="w-full rounded-lg border border-red-300 text-red-600 py-2 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {a.disputeBtn}
                </button>
              </div>
            )}

            {!user && (
              <a href="/auth" className={cn(buttonVariants(), "w-full justify-center")}>
                {a.loginBtn}
              </a>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span className="flex items-center gap-1"><Gavel className="h-3 w-3" />{auction.bidCount} {a.bids}</span>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{auction.viewCount} {a.views}</span>
            </div>

            {/* Admin Panel */}
            {isAdmin && (
              <div className="rounded-lg border border-dashed border-amber-400 p-3 space-y-2 mt-1">
                <p className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> 관리자 도구
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={openEditModal}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 py-1.5 text-xs font-semibold transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> 수정
                  </button>
                  <button
                    onClick={handleAdminDelete}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 py-1.5 text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> 삭제
                  </button>
                </div>
                {auction.status === "pending_approval" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAdminAction("approve")}
                      disabled={submitting}
                      className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 text-white py-1.5 text-xs font-semibold disabled:opacity-50 transition-colors"
                    >
                      ✅ 승인
                    </button>
                    <button
                      onClick={() => handleAdminAction("stop")}
                      disabled={submitting}
                      className="flex-1 rounded-lg bg-gray-600 hover:bg-gray-700 text-white py-1.5 text-xs font-semibold disabled:opacity-50 transition-colors"
                    >
                      🚫 거절
                    </button>
                  </div>
                )}
                {auction.status === "active" && (
                  <button
                    onClick={() => handleAdminAction("stop")}
                    disabled={submitting}
                    className="w-full rounded-lg border border-red-300 text-red-600 hover:bg-red-50 py-1.5 text-xs font-semibold disabled:opacity-50 transition-colors"
                  >
                    🚫 강제 종료
                  </button>
                )}
                {auction.status === "disputed" && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">분쟁 해결:</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAdminAction("resolve", { resolution: "buyer" })}
                        disabled={submitting}
                        className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-1.5 text-xs font-semibold disabled:opacity-50 transition-colors"
                      >
                        구매자 승리
                      </button>
                      <button
                        onClick={() => handleAdminAction("resolve", { resolution: "seller" })}
                        disabled={submitting}
                        className="flex-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white py-1.5 text-xs font-semibold disabled:opacity-50 transition-colors"
                      >
                        판매자 승리
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Edit Modal */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">옥션 수정</h2>
              <button onClick={() => setShowEditModal(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {editError && <p className="text-sm text-red-500">{editError}</p>}
              <div>
                <label className="text-xs font-medium text-muted-foreground">제목</label>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">카테고리</label>
                  <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                    {Object.entries(CAT_LABEL).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">상태</label>
                  <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">설명</label>
                <textarea rows={3} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">썸네일 URL</label>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={editForm.thumbnailUrl} onChange={(e) => setEditForm({ ...editForm, thumbnailUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">시작가 (AP)</label>
                  <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={editForm.startPrice} onChange={(e) => setEditForm({ ...editForm, startPrice: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">즉구가 (AP)</label>
                  <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={editForm.buyNowPrice} onChange={(e) => setEditForm({ ...editForm, buyNowPrice: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">월 수익 (AP)</label>
                  <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={editForm.monthlyRevenue} onChange={(e) => setEditForm({ ...editForm, monthlyRevenue: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">마감일시</label>
                <input type="datetime-local" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={editForm.endsAt} onChange={(e) => setEditForm({ ...editForm, endsAt: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">이전 방법</label>
                <textarea rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={editForm.transferMethod} onChange={(e) => setEditForm({ ...editForm, transferMethod: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t">
              <button onClick={handleAdminSave} disabled={saving}
                className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white py-2 text-sm font-semibold disabled:opacity-50 transition-colors">
                {saving ? "저장 중..." : "저장"}
              </button>
              <button onClick={() => setShowEditModal(false)}
                className="px-4 rounded-lg border hover:bg-muted py-2 text-sm font-medium transition-colors">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
