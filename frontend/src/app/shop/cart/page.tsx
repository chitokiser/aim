"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import { useCartStore, type CartItem } from "@/lib/cart-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Coins, Loader2, Minus, Package, PackageCheck, Plus, ShoppingCart, Sparkles, Trash2, TriangleAlert,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
// 10% of the margin is reserved as mandatory AP to fund the mentor bonus —
// must match MENTOR_FUND_RATIO in backend/src/cj-shop/cj-shop.service.ts.
const MENTOR_FUND_RATIO = 0.1;

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
  cjProductId?: string;
  nameKo: string;
  images: string[];
  apPrice: number;
  supplyApPrice?: number;
  active: boolean;
  variants?: ProductVariant[];
}

interface SavedAddress {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  detailAddress?: string;
  zip: string;
  country?: string;
  isDefault?: boolean;
}

interface ResolvedLine {
  item: CartItem;
  product: CjProduct;
  variant: ProductVariant | null;
  apPrice: number;
  maxExpPayable: number;
}

const emptyShipping = { name: "", phone: "", address: "", detailAddress: "", zip: "", country: "KR" };

export default function CartPage() {
  const { t } = useLanguage();
  const sh = t.shop;
  const router = useRouter();
  const { user, token } = useAuthStore();
  const { items, removeItem, setQuantity, clear } = useCartStore();

  const [products, setProducts] = useState<Record<string, CjProduct>>({});
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new");
  const [shipping, setShipping] = useState(emptyShipping);
  const [saveThisAddress, setSaveThisAddress] = useState(true);
  const [addressLabel, setAddressLabel] = useState("");
  const [spendableExp, setSpendableExp] = useState(0);
  const [expToUse, setExpToUse] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const uniqueIds = Array.from(new Set(items.map((i) => i.productId)));
    Promise.all(
      uniqueIds.map((id) =>
        fetch(`${API}/api/cj-shop/products/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    )
      .then((results: (CjProduct | null)[]) => {
        const map: Record<string, CjProduct> = {};
        uniqueIds.forEach((id, i) => {
          if (results[i]) map[id] = results[i] as CjProduct;
        });
        setProducts(map);
      })
      .finally(() => setLoading(false));
  }, [items]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/cj-shop/my-exp`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { exp?: number } | null) => setSpendableExp(data?.exp ?? 0))
      .catch(() => setSpendableExp(0));
  }, [token]);

  const loadAddresses = useCallback(() => {
    if (!token) return;
    fetch(`${API}/api/cj-shop/addresses`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SavedAddress[]) => {
        const list = Array.isArray(data) ? data : [];
        setAddresses(list);
        const def = list.find((a) => a.isDefault) ?? list[0];
        if (def) {
          setSelectedAddressId(def.id);
          setShipping({
            name: def.name,
            phone: def.phone,
            address: def.address,
            detailAddress: def.detailAddress ?? "",
            zip: def.zip,
            country: def.country ?? "KR",
          });
        }
      })
      .catch(() => setAddresses([]));
  }, [token]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const resolvedLines: ResolvedLine[] = useMemo(() => {
    return items
      .map((item) => {
        const product = products[item.productId];
        if (!product) return null;
        const variant = product.variants?.find((v) => v.vid === item.variantVid) ?? product.variants?.[0] ?? null;
        const apPrice = variant?.apPrice ?? product.apPrice;
        const supplyApPrice = variant?.supplyApPrice ?? product.supplyApPrice ?? apPrice;
        const maxExpPayable = Math.floor(Math.max(0, apPrice - supplyApPrice) * item.quantity * (1 - MENTOR_FUND_RATIO));
        return { item, product, variant, apPrice, maxExpPayable };
      })
      .filter((l): l is ResolvedLine => l !== null);
  }, [items, products]);

  const totalAp = resolvedLines.reduce((sum, l) => sum + l.apPrice * l.item.quantity, 0);
  const totalMaxExpPayable = resolvedLines.reduce((sum, l) => sum + l.maxExpPayable, 0);
  const expCap = Math.min(totalMaxExpPayable, spendableExp);
  const clampedExpToUse = Math.min(expToUse, expCap);
  const apToCharge = totalAp - clampedExpToUse;

  // Groups lines by the underlying CJ supplier product — CJ dropships each
  // listing from its own warehouse, so only lines sharing the same listing
  // (different color/size options of the same product) are likely to ship
  // together; separate listings are very likely separate parcels.
  const groups = useMemo(() => {
    const map = new Map<string, ResolvedLine[]>();
    for (const line of resolvedLines) {
      const key = line.product.cjProductId || line.product.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(line);
    }
    return Array.from(map.values());
  }, [resolvedLines]);

  function allocateExp(): number[] {
    let remaining = clampedExpToUse;
    return resolvedLines.map((l) => {
      const use = Math.min(remaining, l.maxExpPayable);
      remaining -= use;
      return use;
    });
  }

  const handleSelectAddress = (id: string) => {
    setSelectedAddressId(id);
    if (id === "new") {
      setShipping(emptyShipping);
      return;
    }
    const found = addresses.find((a) => a.id === id);
    if (found) {
      setShipping({
        name: found.name,
        phone: found.phone,
        address: found.address,
        detailAddress: found.detailAddress ?? "",
        zip: found.zip,
        country: found.country ?? "KR",
      });
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!token) return;
    await fetch(`${API}/api/cj-shop/addresses/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    loadAddresses();
  };

  const handleCheckout = async () => {
    if (!user || !token) {
      router.push("/auth");
      return;
    }
    if (!shipping.name.trim() || !shipping.phone.trim() || !shipping.address.trim() || !shipping.zip.trim()) {
      toast.error(sh.fillShippingInfo);
      return;
    }
    if (!confirm(sh.confirmPurchase)) return;

    setSubmitting(true);
    try {
      if (selectedAddressId === "new" && saveThisAddress) {
        await fetch(`${API}/api/cj-shop/addresses`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...shipping, label: addressLabel || shipping.name }),
        }).catch(() => {});
      }

      const expAllocations = allocateExp();
      const body = {
        items: resolvedLines.map((l, i) => ({
          productId: l.product.id,
          quantity: l.item.quantity,
          selectedVid: l.variant?.vid ?? undefined,
          expToUse: expAllocations[i],
        })),
        shipping,
      };
      const res = await fetch(`${API}/api/cj-shop/orders/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(err.message ?? "Error");
        return;
      }
      toast.success(sh.purchaseSuccess);
      clear();
      router.push("/profile?tab=cjOrders");
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-2xl">
        <ShoppingCart className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground mb-4">{sh.cartEmpty}</p>
        <Link href="/shop" className={buttonVariants({ variant: "outline" })}>
          {sh.backToShop}
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        {sh.backToShop}
      </Link>

      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <ShoppingCart className="h-6 w-6 text-violet-500" />
        {sh.cartTitle}
      </h1>

      {loading ? (
        <div className="space-y-3 mb-8">
          {items.map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-4">
            <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{sh.bulkShippingDisclaimer}</p>
          </div>

          <div className="space-y-4 mb-8">
            {groups.map((group, gi) => (
              <Card key={gi} className="overflow-hidden">
                {group.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900 px-4 py-2">
                    <PackageCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">{sh.sameProductGroupHint}</p>
                  </div>
                )}
                <CardContent className="p-4 space-y-4">
                  {group.map((line) => (
                    <div key={`${line.item.productId}-${line.item.variantVid ?? "default"}`} className="flex items-center gap-3">
                      <div className="h-16 w-16 shrink-0 rounded-lg bg-muted overflow-hidden">
                        {line.product.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={line.product.images[0]} alt={line.product.nameKo} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold line-clamp-1">{line.product.nameKo}</p>
                        {line.variant?.label && <p className="text-xs text-muted-foreground">{line.variant.label}</p>}
                        <Badge className="mt-1 bg-gradient-to-r from-violet-600 to-cyan-500 text-white border-0 gap-1 text-[11px]">
                          <Coins className="h-3 w-3" />
                          {line.apPrice.toLocaleString()} AP
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => setQuantity(line.item.productId, line.item.variantVid, line.item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-semibold">{line.item.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => setQuantity(line.item.productId, line.item.variantVid, line.item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(line.item.productId, line.item.variantVid)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
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

              {addresses.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{sh.selectSavedAddress}</Label>
                  <Select value={selectedAddressId} onValueChange={handleSelectAddress}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {addresses.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label} — {a.address}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">{sh.useNewAddress}</SelectItem>
                    </SelectContent>
                  </Select>
                  {addresses.length > 0 && selectedAddressId !== "new" && (
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-destructive underline"
                      onClick={() => handleDeleteAddress(selectedAddressId)}
                    >
                      {sh.deleteAddress}
                    </button>
                  )}
                </div>
              )}

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

              {selectedAddressId === "new" && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="save-address"
                    checked={saveThisAddress}
                    onChange={(e) => setSaveThisAddress(e.target.checked)}
                    className="h-4 w-4 accent-violet-500"
                  />
                  <Label htmlFor="save-address" className="text-xs font-normal cursor-pointer">
                    {sh.saveThisAddress}
                  </Label>
                  {saveThisAddress && (
                    <Input
                      value={addressLabel}
                      onChange={(e) => setAddressLabel(e.target.value)}
                      placeholder={sh.addressLabel}
                      className="h-7 text-xs max-w-[140px] ml-2"
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardContent className="p-5 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{sh.cartItemCount}</span>
                <span className="font-medium">{resolvedLines.reduce((s, l) => s + l.item.quantity, 0)}</span>
              </div>
              {clampedExpToUse > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{sh.priceLabel}</span>
                  <span>{apToCharge.toLocaleString()} AP + {clampedExpToUse.toLocaleString()} EXP</span>
                </div>
              )}
              <div className="flex items-center justify-between font-bold text-base pt-1 border-t mt-1">
                <span>{sh.cartTotal}</span>
                <span className="text-violet-600 dark:text-violet-400">{apToCharge.toLocaleString()} AP</span>
              </div>
              {user && <p className="text-xs text-muted-foreground pt-1">{sh.myApLabel}: {user.points.toLocaleString()} AP</p>}
            </CardContent>
          </Card>

          <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed mb-3">{sh.noReturnsNotice}</p>

          <Button
            className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90 font-semibold h-12"
            disabled={submitting}
            onClick={() => void handleCheckout()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Coins className="h-4 w-4 mr-2" />}
            {sh.checkoutBulk} — {apToCharge.toLocaleString()} AP{clampedExpToUse > 0 ? ` + ${clampedExpToUse.toLocaleString()} EXP` : ""}
          </Button>
        </>
      )}
    </div>
  );
}
