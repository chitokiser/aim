"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Gavel, Clock, Eye, TrendingUp, ArrowLeft } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://aim-backend.up.railway.app";

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

  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
          </div>
        </div>
      </div>
    </div>
  );
}
