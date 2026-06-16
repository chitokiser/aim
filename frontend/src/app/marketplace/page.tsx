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
  Bot, Smartphone, Users, Radio, ExternalLink, Loader2, Star,
  Plus, Trash2, Megaphone, Search, X,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const CATEGORIES = [
  { value: "bot",     icon: Bot,        color: "text-violet-500" },
  { value: "miniapp", icon: Smartphone, color: "text-cyan-500"   },
  { value: "group",   icon: Users,      color: "text-green-500"  },
  { value: "channel", icon: Radio,      color: "text-amber-500"  },
] as const;

type Category = typeof CATEGORIES[number]["value"];

interface Listing {
  id: string;
  userId: string;
  displayName: string;
  category: Category;
  title: string;
  description: string;
  link: string;
  logoUrl?: string;
  tags: string[];
  members: number | null;
  isFeatured: boolean;
  createdAt: string;
}

const BANNER_COST = 10000;

function CategoryIcon({ cat, className }: { cat: string; className?: string }) {
  const found = CATEGORIES.find((c) => c.value === cat);
  const Icon = found?.icon ?? Users;
  return <Icon className={className ?? `h-5 w-5 ${found?.color ?? "text-muted-foreground"}`} />;
}

function FeaturedBannerCard({
  listing,
  t,
}: {
  listing: Listing;
  t: Record<string, string>;
}) {
  const href = listing.link.startsWith("http")
    ? listing.link
    : `https://t.me/${listing.link.replace(/^@/, "")}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 w-64 sm:w-72 snap-start rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-4 hover:shadow-lg transition-shadow group block"
    >
      <div className="flex items-start gap-3 mb-3">
        {listing.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.logoUrl}
            alt={listing.title}
            className="w-11 h-11 rounded-xl object-cover shrink-0 border border-amber-200"
          />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <CategoryIcon cat={listing.category} className="h-5 w-5 text-amber-600" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight line-clamp-1 group-hover:text-amber-600 transition-colors">
            {listing.title}
          </p>
          <Badge variant="secondary" className="text-xs capitalize mt-1">{listing.category}</Badge>
        </div>
      </div>

      {listing.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
          {listing.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {listing.members != null && (
            <p className="text-xs text-muted-foreground">
              {listing.members.toLocaleString()} {t.members}
            </p>
          )}
          {listing.tags?.length > 0 && (
            <p className="text-xs font-mono text-violet-500 truncate">
              {listing.tags.slice(0, 2).map((x) => `#${x}`).join(" ")}
            </p>
          )}
        </div>
        <span className={buttonVariants({ size: "sm", variant: "outline", className: "shrink-0 text-xs border-amber-400 text-amber-700 hover:bg-amber-50 gap-1" })}>
          {t.visitBtn}
          <ExternalLink className="h-3 w-3" />
        </span>
      </div>
    </a>
  );
}

function ListingCard({
  listing,
  onPromote,
  onDelete,
  isOwner,
  t,
}: {
  listing: Listing;
  onPromote?: () => void;
  onDelete?: () => void;
  isOwner?: boolean;
  t: Record<string, string>;
}) {
  return (
    <Card className={listing.isFeatured ? "border-amber-400 bg-amber-50/30 dark:bg-amber-950/10" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-lg bg-muted shrink-0">
            <CategoryIcon cat={listing.category} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold leading-tight">{listing.title}</h3>
              {listing.isFeatured && (
                <Badge className="bg-amber-500 text-white text-xs gap-1">
                  <Star className="h-3 w-3" />
                  {t.featured}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs capitalize">{listing.category}</Badge>
            </div>
            {listing.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{listing.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {listing.members != null && (
                <span>{listing.members.toLocaleString()} {t.members}</span>
              )}
              {listing.tags?.length > 0 && (
                <span className="font-mono text-violet-500">{listing.tags.map((x) => `#${x}`).join(" ")}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            {listing.link && (
              <a
                href={listing.link.startsWith("http") ? listing.link : `https://t.me/${listing.link.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "sm", variant: "outline", className: "gap-1" })}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t.visitBtn}
              </a>
            )}
            {isOwner && !listing.isFeatured && onPromote && (
              <Button size="sm" variant="outline" onClick={onPromote}
                className="gap-1 text-amber-600 border-amber-300 hover:bg-amber-50">
                <Megaphone className="h-3.5 w-3.5" />
                {t.promoteBtn}
              </Button>
            )}
            {isOwner && onDelete && (
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

export default function MarketplacePage() {
  const { user, token } = useAuthStore();
  const { t } = useLanguage();
  const mp = t.marketplace;

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    category: "group", title: "", description: "", link: "", members: "", tags: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const loadListings = useCallback(async (cat?: string) => {
    setLoading(true);
    try {
      const url = cat && cat !== "all"
        ? `${API}/api/listings?category=${cat}`
        : `${API}/api/listings`;
      const res = await fetch(url);
      if (res.ok) setListings(await res.json() as Listing[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMine = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/listings/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMyListings(await res.json() as Listing[]);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => { void loadListings(activeCategory); }, [loadListings, activeCategory]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) { toast.error(mp.loginRequired); return; }
    if (!form.title.trim() || !form.link.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category: form.category,
          title: form.title.trim(),
          description: form.description.trim(),
          link: form.link.trim(),
          members: form.members ? Number(form.members) : null,
          tags: form.tags.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast.error(err.message ?? "Error");
        return;
      }
      toast.success(mp.submitSuccess);
      setForm({ category: "group", title: "", description: "", link: "", members: "", tags: "" });
      void loadListings(activeCategory);
      void loadMine();
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromote = async (id: string) => {
    if (!confirm(mp.promoteConfirm)) return;
    try {
      const res = await fetch(`${API}/api/listings/${id}/promote`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast.error(err.message ?? "Error");
        return;
      }
      toast.success(mp.promoteSuccess);
      void loadListings(activeCategory);
      void loadMine();
    } catch { toast.error("Network error"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this listing?")) return;
    try {
      await fetch(`${API}/api/listings/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(mp.deleteSuccess);
      void loadListings(activeCategory);
      void loadMine();
    } catch { toast.error("Network error"); }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-1">{mp.title}</h1>
        <p className="text-muted-foreground">{mp.subtitle}</p>
      </div>

      <Tabs defaultValue="browse">
        <TabsList className="mb-6">
          <TabsTrigger value="browse">{mp.tabBrowse}</TabsTrigger>
          <TabsTrigger value="register">
            <Plus className="h-3.5 w-3.5 mr-1" />
            {mp.tabRegister}
          </TabsTrigger>
          {user && (
            <TabsTrigger value="mine" onClick={loadMine}>{mp.tabMine}</TabsTrigger>
          )}
        </TabsList>

        {/* Browse */}
        <TabsContent value="browse">
          {/* Featured Banner Zone */}
          {!searchQuery && listings.some((l) => l.isFeatured) && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Megaphone className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  {mp.featuredSponsors}
                </span>
                <span className="text-xs text-muted-foreground">— {mp.promoteCost}</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x scrollbar-none">
                {listings
                  .filter((l) => l.isFeatured)
                  .map((l) => (
                    <FeaturedBannerCard
                      key={l.id}
                      listing={l}
                      t={mp as unknown as Record<string, string>}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={mp.searchPlaceholder}
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-5">
            {[{ value: "all", label: mp.catAll }, { value: "bot", label: mp.catBot },
              { value: "miniapp", label: mp.catMiniapp }, { value: "group", label: mp.catGroup },
              { value: "channel", label: mp.catChannel }].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setActiveCategory(value); setSearchQuery(""); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === value
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
          ) : (() => {
            const q = searchQuery.trim().toLowerCase();
            const filtered = q
              ? listings.filter((l) =>
                  l.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
                  l.title.toLowerCase().includes(q) ||
                  l.description?.toLowerCase().includes(q)
                )
              : listings;

            if (filtered.length === 0) {
              return (
                <p className="text-center text-sm text-muted-foreground py-16">
                  {q ? (
                    <><span className="font-medium text-foreground">&quot;{searchQuery}&quot;</span> — {mp.searchNoResults}</>
                  ) : mp.noListings}
                </p>
              );
            }
            return (
              <div className="space-y-3">
                {q && (
                  <p className="text-xs text-muted-foreground">
                    {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
                  </p>
                )}
                {filtered.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    isOwner={user?.id === l.userId}
                    onPromote={() => void handlePromote(l.id)}
                    onDelete={() => void handleDelete(l.id)}
                    t={mp as unknown as Record<string, string>}
                  />
                ))}
              </div>
            );
          })()}
        </TabsContent>

        {/* Register */}
        <TabsContent value="register">
          <Card>
            <CardContent className="p-6">
              {!user ? (
                <p className="text-center text-muted-foreground py-8">{mp.loginRequired}</p>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <h2 className="font-bold text-lg">{mp.formTitle}</h2>

                  <div className="space-y-1.5">
                    <Label>{mp.fieldCategory}</Label>
                    <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bot">{mp.catBot}</SelectItem>
                        <SelectItem value="miniapp">{mp.catMiniapp}</SelectItem>
                        <SelectItem value="group">{mp.catGroup}</SelectItem>
                        <SelectItem value="channel">{mp.catChannel}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{mp.fieldTitle}</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{mp.fieldDesc}</Label>
                    <Textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{mp.fieldLink}</Label>
                    <Input
                      placeholder="https://t.me/yourgroup"
                      value={form.link}
                      onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>{mp.fieldMembers}</Label>
                      <Input
                        type="number"
                        value={form.members}
                        onChange={(e) => setForm((p) => ({ ...p, members: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{mp.fieldTags}</Label>
                      <Input
                        placeholder="AI, bot, crypto"
                        value={form.tags}
                        onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm">
                    <p className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1">
                      <Megaphone className="h-4 w-4" />
                      {mp.promoteBtn} — {mp.promoteCost}
                    </p>
                    <p className="text-amber-600/80 dark:text-amber-500/80 text-xs">{mp.promoteDesc}</p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{mp.submitting}</>
                    ) : mp.submitBtn}
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
              <p className="text-center text-sm text-muted-foreground py-16">{mp.noListings}</p>
            ) : (
              <div className="space-y-3">
                {myListings.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    isOwner
                    onPromote={() => void handlePromote(l.id)}
                    onDelete={() => void handleDelete(l.id)}
                    t={mp as unknown as Record<string, string>}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
