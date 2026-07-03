"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import DOMPurify from "isomorphic-dompurify";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Coins, Loader2, Minus, Package, Plus, Sparkles } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ProductVariant {
  vid: string;
  label: string;
  image?: string;
  cjPriceUsd: number;
  supplyApPrice: number;
  apPrice: number;
}

interface CjProduct {
  id: string;
  nameKo: string;
  images: string[];
  video?: string | null;
  description?: string;
  apPrice: number;
  supplyApPrice?: number;
  active: boolean;
  variants?: ProductVariant[];
}

export default function ShopDetailClient({ id }: { id: string }) {
  const { t } = useLanguage();
  const sh = t.shop;
  const router = useRouter();
  const { user, token } = useAuthStore();
  // When this page is served from the static-export fallback (id="_", e.g. via
  // a Netlify _redirects rewrite for a product created after the last build),
  // useParams() still reflects the real browser URL — prefer it over the
  // build-time prop so newly registered products work without a redeploy.
  const routeParams = useParams();
  const productId = (routeParams?.id as string) || id;

  const [product, setProduct] = useState<CjProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVid, setSelectedVid] = useState<string | null>(null);
  const [shipping, setShipping] = useState({ name: "", phone: "", address: "", detailAddress: "", zip: "", country: "KR" });
  const [submitting, setSubmitting] = useState(false);
  const [spendableExp, setSpendableExp] = useState(0);
  const [expToUse, setExpToUse] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/cj-shop/products/${productId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CjProduct | null) => {
        setProduct(data);
        setSelectedVid(data?.variants?.[0]?.vid ?? null);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [productId]);

  const activeVariant = product?.variants?.find((v) => v.vid === selectedVid) ?? product?.variants?.[0] ?? null;
  const displayApPrice = activeVariant?.apPrice ?? product?.apPrice ?? 0;
  const displaySupplyApPrice = activeVariant?.supplyApPrice ?? product?.supplyApPrice;

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/cj-shop/my-exp`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { exp?: number } | null) => setSpendableExp(data?.exp ?? 0))
      .catch(() => setSpendableExp(0));
  }, [token]);

  const totalAp = product ? displayApPrice * quantity : 0;
  // 10% of the margin is reserved as mandatory AP to fund the mentor bonus —
  // must match MENTOR_FUND_RATIO in backend/src/cj-shop/cj-shop.service.ts.
  const maxExpPayable = displaySupplyApPrice !== undefined
    ? Math.floor(Math.max(0, displayApPrice - displaySupplyApPrice) * quantity * 0.9)
    : 0;
  const expCap = Math.min(maxExpPayable, spendableExp);
  const clampedExpToUse = Math.min(expToUse, expCap);
  const apToCharge = totalAp - clampedExpToUse;

  const handlePurchase = async () => {
    if (!user || !token) { router.push("/auth"); return; }
    if (!shipping.name.trim() || !shipping.phone.trim() || !shipping.address.trim() || !shipping.zip.trim()) {
      toast.error(sh.fillShippingInfo);
      return;
    }
    if (!confirm(sh.confirmPurchase)) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/cj-shop/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId, quantity, shipping, expToUse: clampedExpToUse, selectedVid: activeVariant?.vid }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast.error(err.message ?? "Error");
        return;
      }
      toast.success(sh.purchaseSuccess);
      router.push("/profile?tab=cjOrders");
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="h-96 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">{sh.noProducts}</p>
        <Link href="/shop" className={buttonVariants({ variant: "outline" })}>{sh.backToShop}</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        {sh.backToShop}
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="aspect-square rounded-2xl bg-muted overflow-hidden">
            {product.images?.[activeImage] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.images[activeImage]} alt={product.nameKo} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <Package className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}
          </div>
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {product.images.map((img, i) => (
                <button
                  key={img}
                  onClick={() => setActiveImage(i)}
                  className={`shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 ${
                    i === activeImage ? "border-violet-500" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={`${product.nameKo} ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {product.video && (
            <video controls className="w-full rounded-xl mt-3 bg-black">
              <source src={product.video} />
            </video>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold mb-3">{product.nameKo}</h1>
          <Badge className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white border-0 gap-1.5 text-base px-3 py-1.5 mb-2">
            <Coins className="h-4 w-4" />
            {displayApPrice.toLocaleString()} AP
          </Badge>
          {user && (
            <p className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              {sh.myExpLabel}: {spendableExp.toLocaleString()} EXP
            </p>
          )}
          {maxExpPayable > 0 && (
            <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              {sh.maxExpPayable.replace("{n}", maxExpPayable.toLocaleString())}
            </p>
          )}

          {product.variants && product.variants.length > 1 && (
            <div className="mb-6">
              <Label className="text-xs mb-2 block">{sh.selectOptionLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.vid}
                    type="button"
                    onClick={() => {
                      setSelectedVid(v.vid);
                      if (v.image) {
                        const idx = product.images?.indexOf(v.image) ?? -1;
                        if (idx >= 0) setActiveImage(idx);
                      }
                    }}
                    className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                      v.vid === (selectedVid ?? product.variants?.[0]?.vid)
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300"
                        : "border-transparent bg-muted hover:bg-muted/70"
                    }`}
                  >
                    {v.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.image} alt={v.label} className="h-5 w-5 rounded object-cover" />
                    )}
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mb-6">
            <Label className="shrink-0">{sh.qtyLabel}</Label>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQuantity((q) => q + 1)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-sm text-muted-foreground">{sh.qtyUnit}</span>
            </div>
          </div>

          {user && expCap > 0 && (
            <Card className="mb-6">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    {sh.expPaymentTitle}
                  </p>
                  <button
                    type="button"
                    className="text-xs text-violet-600 dark:text-violet-400 font-semibold hover:underline"
                    onClick={() => setExpToUse(expCap)}
                  >
                    {sh.useMaxExp}
                  </button>
                </div>
                {totalAp > 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium -mt-2">
                    {sh.expPercentBadge.replace("{n}", Math.floor((maxExpPayable / totalAp) * 100).toString())}
                  </p>
                )}
                <input
                  type="range"
                  min={0}
                  max={expCap}
                  step={1}
                  value={clampedExpToUse}
                  onChange={(e) => setExpToUse(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {sh.myExpLabel}: {spendableExp.toLocaleString()} EXP
                  </span>
                  <span className="font-bold text-violet-600 dark:text-violet-400">
                    {clampedExpToUse.toLocaleString()} EXP {sh.expUsedSuffix}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardContent className="p-5 space-y-3">
              <p className="font-semibold text-sm">{sh.shippingTitle}</p>
              <p className="text-xs text-muted-foreground -mt-2">{sh.shippingCountriesNote}</p>
              <div className="space-y-1.5">
                <Label className="text-xs">{sh.shippingCountry}</Label>
                <Select value={shipping.country} onValueChange={(v) => setShipping((s) => ({ ...s, country: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KR">{sh.countryKr}</SelectItem>
                    <SelectItem value="VN">{sh.countryVn}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{sh.shippingName}</Label>
                <Input value={shipping.name} onChange={(e) => setShipping((s) => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{sh.shippingPhone}</Label>
                <Input value={shipping.phone} onChange={(e) => setShipping((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{sh.shippingAddress}</Label>
                <Input value={shipping.address} onChange={(e) => setShipping((s) => ({ ...s, address: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{sh.shippingDetailAddress}</Label>
                <Input value={shipping.detailAddress} onChange={(e) => setShipping((s) => ({ ...s, detailAddress: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{sh.shippingZip}</Label>
                <Input value={shipping.zip} onChange={(e) => setShipping((s) => ({ ...s, zip: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          {user && (
            <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
              {clampedExpToUse > 0 && (
                <p>{sh.priceLabel}: {apToCharge.toLocaleString()} AP + {clampedExpToUse.toLocaleString()} EXP</p>
              )}
              <p>{sh.myApLabel}: {user.points.toLocaleString()} AP</p>
            </div>
          )}

          <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed mb-3">{sh.noReturnsNotice}</p>

          <Button
            className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90 font-semibold h-12"
            disabled={submitting || !product.active}
            onClick={() => void handlePurchase()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Coins className="h-4 w-4 mr-2" />}
            {sh.buyBtn} — {apToCharge.toLocaleString()} AP{clampedExpToUse > 0 ? ` + ${clampedExpToUse.toLocaleString()} EXP` : ""}
          </Button>
        </div>
      </div>

      {product.description && (
        <Card className="mt-8">
          <CardContent className="p-6">
            <h2 className="font-bold text-lg mb-4">{sh.detailTitle}</h2>
            <div
              className="text-sm leading-relaxed [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_p]:mb-2"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
