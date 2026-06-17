"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Gavel } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://aim-backend.up.railway.app";

const CATEGORIES = [
  { label: "YouTube Channel", value: "youtube" },
  { label: "WordPress Blog", value: "wordpress" },
  { label: "Instagram Account", value: "instagram" },
  { label: "TikTok Account", value: "tiktok" },
  { label: "Google Account", value: "google" },
  { label: "Telegram Group", value: "telegram_group" },
  { label: "Telegram Channel", value: "telegram_channel" },
  { label: "Telegram Bot", value: "telegram_bot" },
  { label: "Jumpdao Store", value: "jumpdao_store" },
  { label: "Jumpdao Gold", value: "jumpdao_gold" },
];

export default function AuctionRegisterPage() {
  const { t } = useLanguage();
  const a = t.auction;
  const { user, token } = useAuthStore();
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    category: "",
    description: "",
    thumbnailUrl: "",
    monthlyRevenue: "",
    startPrice: "",
    buyNowPrice: "",
    endsAt: "",
    transferMethod: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError(a.loginRequired); return; }
    setSubmitting(true); setError("");

    const body: Record<string, unknown> = {
      title: form.title,
      category: form.category,
      description: form.description,
      startPrice: Number(form.startPrice),
      endsAt: new Date(form.endsAt).toISOString(),
      transferMethod: form.transferMethod,
    };
    if (form.thumbnailUrl) body.thumbnailUrl = form.thumbnailUrl;
    if (form.monthlyRevenue) body.monthlyRevenue = Number(form.monthlyRevenue);
    if (form.buyNowPrice) body.buyNowPrice = Number(form.buyNowPrice);

    try {
      const res = await fetch(`${API}/auction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Error");
      setSuccess(true);
      setTimeout(() => router.push("/auction"), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-muted-foreground">{a.loginRequired}</p>
        <a href="/auth" className={buttonVariants()}>{a.loginBtn}</a>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href="/auction" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-6")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <Gavel className="h-7 w-7 text-amber-500" />
        <h1 className="text-2xl font-bold">{a.registerTitle}</h1>
      </div>

      {success ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-green-700 font-semibold">{a.submitSuccess}</p>
          <p className="text-sm text-muted-foreground mt-1">Redirecting...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1">{a.fieldTitle}</label>
            <input
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-1">{a.fieldCategory}</label>
            <select
              required
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">—</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">{a.fieldDesc}</label>
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {/* Thumbnail */}
          <div>
            <label className="block text-sm font-medium mb-1">{a.fieldThumbnail}</label>
            <input
              type="url"
              value={form.thumbnailUrl}
              onChange={(e) => set("thumbnailUrl", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="https://..."
            />
          </div>

          {/* Prices row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{a.fieldStartPrice}</label>
              <input
                required
                type="number"
                min={1000}
                value={form.startPrice}
                onChange={(e) => set("startPrice", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="e.g. 100000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{a.fieldBuyNowPrice}</label>
              <input
                type="number"
                min={1000}
                value={form.buyNowPrice}
                onChange={(e) => set("buyNowPrice", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="optional"
              />
            </div>
          </div>

          {/* Monthly Revenue */}
          <div>
            <label className="block text-sm font-medium mb-1">{a.fieldMonthlyRevenue}</label>
            <input
              type="number"
              value={form.monthlyRevenue}
              onChange={(e) => set("monthlyRevenue", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="optional"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium mb-1">{a.fieldEndDate}</label>
            <input
              required
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Transfer Method */}
          <div>
            <label className="block text-sm font-medium mb-1">{a.fieldTransferMethod}</label>
            <textarea
              required
              rows={2}
              value={form.transferMethod}
              onChange={(e) => set("transferMethod", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              placeholder="e.g. I will transfer channel ownership via YouTube Studio"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            {a.revenueShare}
            <br />
            {a.antiSnipe}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-amber-500 text-white py-3 font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? a.submitting : a.submitBtn}
          </button>
        </form>
      )}
    </div>
  );
}
