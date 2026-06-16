"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Video, Image as ImageIcon, Music, FileQuestion, ExternalLink, Loader2,
  Plus, Trash2, Coins, ShoppingBag,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const CONTENT_TYPES = [
  { value: "video", icon: Video,        color: "text-violet-500" },
  { value: "image", icon: ImageIcon,    color: "text-cyan-500"   },
  { value: "audio", icon: Music,        color: "text-amber-500"  },
  { value: "other", icon: FileQuestion, color: "text-green-500"  },
] as const;

type ContentType = typeof CONTENT_TYPES[number]["value"];

interface Listing {
  id: string;
  sellerId: string;
  sellerName: string;
  contentType: ContentType;
  title: string;
  description: string;
  link: string;
  thumbnailUrl: string;
  price: number;
  tags: string[];
  status: "active" | "sold" | "deleted";
  buyerId: string | null;
  soldAt: string | null;
  createdAt: string;
}

function ContentTypeIcon({ type, className }: { type: string; className?: string }) {
  const found = CONTENT_TYPES.find((c) => c.value === type);
  const Icon = found?.icon ?? FileQuestion;
  return <Icon className={className ?? `h-5 w-5 ${found?.color ?? "text-muted-foreground"}`} />;
}

function ListingCard({
  listing,
  onBuy,
  onDelete,
  isOwner,
  t,
}: {
  listing: Listing;
  onBuy?: () => void;
  onDelete?: () => void;
  isOwner?: boolean;
  t: Record<string, string>;
}) {
  const sold = listing.status === "sold";
  return (
    <Card className={sold ? "opacity-70" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-lg bg-muted shrink-0">
            <ContentTypeIcon type={listing.contentType} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold leading-tight">{listing.title}</h3>
              {sold && (
                <Badge className="bg-muted-foreground text-white text-xs">{t.soldLabel}</Badge>
              )}
              <Badge variant="secondary" className="text-xs capitalize">{listing.contentType}</Badge>
            </div>
            {listing.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{listing.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">{listing.sellerName}</span>
              <span className="flex items-center gap-1 font-semibold text-violet-600">
                <Coins className="h-3.5 w-3.5" />
                {listing.price.toLocaleString()} AP
              </span>
              {listing.tags?.length > 0 && (
                <span className="font-mono text-violet-500">{listing.tags.map((x) => `#${x}`).join(" ")}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            {listing.link && (
              <a
                href={listing.link}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "sm", variant: "outline", className: "gap-1" })}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t.viewBtn}
              </a>
            )}
            {!isOwner && !sold && onBuy && (
              <Button size="sm" onClick={onBuy}
                className="gap-1 bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90">
                <ShoppingBag className="h-3.5 w-3.5" />
                {t.buyBtn}
              </Button>
            )}
            {isOwner && !sold && onDelete && (
              <Button size="sm" variant="ghost" onClick={onDelete}
                className="gap-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">
                <Trash2 className="h-3.5 w-3.5" />
                {t.deleteBtn}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CreativeMarketPage() {
  const { user, token } = useAuthStore();
  const { t } = useLanguage();
  const cm = t.creativeMarket;

  const [activeType, setActiveType] = useState<string>("all");
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [myPurchases, setMyPurchases] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    contentType: "video", title: "", description: "", link: "", thumbnailUrl: "", price: "", tags: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const loadListings = useCallback(async (type?: string) => {
    setLoading(true);
    try {
      const url = type && type !== "all"
        ? `${API}/api/creative-listings?contentType=${type}`
        : `${API}/api/creative-listings`;
      const res = await fetch(url);
      if (res.ok) setListings(await res.json() as Listing[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMine = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/creative-listings/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMyListings(await res.json() as Listing[]);
    } catch { /* silent */ }
  }, [token]);

  const loadPurchases = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/creative-listings/purchases`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMyPurchases(await res.json() as Listing[]);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => { void loadListings(activeType); }, [loadListings, activeType]);

  const handleSell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) { toast.error(cm.loginRequired); return; }
    if (!form.title.trim() || !form.link.trim() || !form.price) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/creative-listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          contentType: form.contentType,
          title: form.title.trim(),
          description: form.description.trim(),
          link: form.link.trim(),
          thumbnailUrl: form.thumbnailUrl.trim(),
          price: Number(form.price),
          tags: form.tags.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast.error(err.message ?? "Error");
        return;
      }
      toast.success(cm.submitSuccess);
      setForm({ contentType: "video", title: "", description: "", link: "", thumbnailUrl: "", price: "", tags: "" });
      void loadListings(activeType);
      void loadMine();
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuy = async (id: string) => {
    if (!user || !token) { toast.error(cm.loginRequired); return; }
    if (!confirm(cm.buyConfirm)) return;
    try {
      const res = await fetch(`${API}/api/creative-listings/${id}/purchase`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast.error(err.message ?? "Error");
        return;
      }
      toast.success(cm.buySuccess);
      void loadListings(activeType);
      void loadPurchases();
    } catch { toast.error("Network error"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this listing?")) return;
    try {
      await fetch(`${API}/api/creative-listings/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(cm.deleteSuccess);
      void loadListings(activeType);
      void loadMine();
    } catch { toast.error("Network error"); }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-1">{cm.title}</h1>
        <p className="text-muted-foreground">{cm.subtitle}</p>
      </div>

      <Tabs defaultValue="browse">
        <TabsList className="mb-6">
          <TabsTrigger value="browse">{cm.tabBrowse}</TabsTrigger>
          <TabsTrigger value="sell">
            <Plus className="h-3.5 w-3.5 mr-1" />
            {cm.tabSell}
          </TabsTrigger>
          {user && (
            <TabsTrigger value="mine" onClick={loadMine}>{cm.tabMine}</TabsTrigger>
          )}
          {user && (
            <TabsTrigger value="purchases" onClick={loadPurchases}>{cm.tabPurchases}</TabsTrigger>
          )}
        </TabsList>

        {/* Browse */}
        <TabsContent value="browse">
          <div className="flex flex-wrap gap-2 mb-5">
            {[{ value: "all", label: cm.catAll }, { value: "video", label: cm.catVideo },
              { value: "image", label: cm.catImage }, { value: "audio", label: cm.catAudio },
              { value: "other", label: cm.catOther }].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setActiveType(value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeType === value
                    ? "bg-violet-600 text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : listings.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-16">{cm.noListings}</p>
          ) : (
            <div className="space-y-3">
              {listings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  isOwner={user?.id === l.sellerId}
                  onBuy={() => void handleBuy(l.id)}
                  onDelete={() => void handleDelete(l.id)}
                  t={cm as unknown as Record<string, string>}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Sell */}
        <TabsContent value="sell">
          <Card>
            <CardContent className="p-6">
              {!user ? (
                <p className="text-center text-muted-foreground py-8">{cm.loginRequired}</p>
              ) : (
                <form onSubmit={handleSell} className="space-y-4">
                  <h2 className="font-bold text-lg">{cm.formTitle}</h2>

                  <div className="space-y-1.5">
                    <Label>{cm.fieldContentType}</Label>
                    <Select value={form.contentType} onValueChange={(v) => setForm((p) => ({ ...p, contentType: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">{cm.catVideo}</SelectItem>
                        <SelectItem value="image">{cm.catImage}</SelectItem>
                        <SelectItem value="audio">{cm.catAudio}</SelectItem>
                        <SelectItem value="other">{cm.catOther}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{cm.fieldTitle}</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{cm.fieldDesc}</Label>
                    <Textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{cm.fieldLink}</Label>
                    <Input
                      placeholder="https://..."
                      value={form.link}
                      onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{cm.fieldThumbnail}</Label>
                    <Input
                      placeholder="https://..."
                      value={form.thumbnailUrl}
                      onChange={(e) => setForm((p) => ({ ...p, thumbnailUrl: e.target.value }))}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>{cm.fieldPrice}</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.price}
                        onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{cm.fieldTags}</Label>
                      <Input
                        placeholder="ai, travel, vlog"
                        value={form.tags}
                        onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{cm.submitting}</>
                    ) : cm.submitBtn}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Listings */}
        {user && (
          <TabsContent value="mine">
            {myListings.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-16">{cm.noListings}</p>
            ) : (
              <div className="space-y-3">
                {myListings.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    isOwner
                    onDelete={() => void handleDelete(l.id)}
                    t={cm as unknown as Record<string, string>}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* My Purchases */}
        {user && (
          <TabsContent value="purchases">
            {myPurchases.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-16">{cm.noListings}</p>
            ) : (
              <div className="space-y-3">
                {myPurchases.map((l) => (
                  <Card key={l.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-2 rounded-lg bg-muted shrink-0">
                          <ContentTypeIcon type={l.contentType} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold leading-tight mb-1">{l.title}</h3>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>{cm.seller}: {l.sellerName}</span>
                            <span className="flex items-center gap-1 font-semibold text-violet-600">
                              <Coins className="h-3.5 w-3.5" />
                              {l.price.toLocaleString()} AP
                            </span>
                            {l.soldAt && <span>{cm.soldOn}: {new Date(l.soldAt).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        {l.link && (
                          <a
                            href={l.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonVariants({ size: "sm", variant: "outline", className: "gap-1 shrink-0" })}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {cm.viewBtn}
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
