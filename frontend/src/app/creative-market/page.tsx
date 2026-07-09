"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Video, Image as ImageIcon, Music, FileQuestion, ExternalLink, Loader2,
  Plus, Trash2, Coins, ShoppingBag, Heart, MessageCircle, Pencil, Sparkles, ArrowLeft,
  Crown, Maximize2,
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
  buyerName?: string | null;
  soldAt: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

function ContentTypeIcon({ type, className }: { type: string; className?: string }) {
  const found = CONTENT_TYPES.find((c) => c.value === type);
  const Icon = found?.icon ?? FileQuestion;
  return <Icon className={className ?? `h-5 w-5 ${found?.color ?? "text-muted-foreground"}`} />;
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 512" className={className} fill="currentColor" aria-hidden="true">
      <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z" />
    </svg>
  );
}

function shareListingToFacebook(listing: Listing) {
  const shareUrl = `https://ai119.netlify.app/creative-market?listing=${listing.id}`;
  const quote = `${listing.title} — ${listing.price.toLocaleString()} AP | AI119 Creative Market`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(quote)}`;
  window.open(fbUrl, "facebook-share-dialog", "width=626,height=436,noopener,noreferrer");
}

interface ListingCardProps {
  listing: Listing;
  onBuy?: () => void;
  onDelete?: () => void;
  onUpdated?: (updated: Listing) => void;
  isOwner?: boolean;
  isAdmin?: boolean;
  likedByMe?: boolean;
  token?: string | null;
  userId?: string;
  initialOpen?: boolean;
  t: Record<string, string>;
}

function ListingCard({
  listing: initialListing,
  onBuy,
  onDelete,
  onUpdated,
  isOwner,
  isAdmin,
  likedByMe: initialLikedByMe = false,
  token,
  userId,
  initialOpen = false,
  t,
}: ListingCardProps) {
  const [listing, setListing] = useState(initialListing);
  const [liked, setLiked] = useState(initialLikedByMe);
  const [likeCount, setLikeCount] = useState(initialListing.likeCount ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    contentType: initialListing.contentType,
    title: initialListing.title,
    description: initialListing.description,
    link: initialListing.link,
    thumbnailUrl: initialListing.thumbnailUrl,
    price: String(initialListing.price),
    tags: (initialListing.tags ?? []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(initialOpen);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const commentInputRef = useRef<HTMLInputElement>(null);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    setLiked(initialLikedByMe);
  }, [initialLikedByMe]);

  useEffect(() => {
    setListing(initialListing);
    setLikeCount(initialListing.likeCount ?? 0);
  }, [initialListing]);

  // Re-fetches the current user so any EXP just awarded (like/comment) shows up immediately.
  const refreshMe = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data) setUser(data);
      }
    } catch { /* ignore */ }
  };

  // Likes are one-directional: once liked, clicking again is a no-op.
  const handleLike = async () => {
    if (!token) { toast.error(t.loginRequired); return; }
    if (liked) return;
    setLiked(true);
    setLikeCount((c) => c + 1);
    try {
      const res = await fetch(`${API}/api/creative-listings/${listing.id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { liked: boolean; likeCount: number };
        setLiked(data.liked);
        setLikeCount(data.likeCount);
        void refreshMe();
      } else {
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      }
    } catch {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    }
  };

  const loadComments = async () => {
    try {
      const res = await fetch(`${API}/api/creative-listings/${listing.id}/comments`);
      if (res.ok) {
        setComments(await res.json() as Comment[]);
        setCommentsLoaded(true);
      }
    } catch { /* silent */ }
  };

  const toggleComments = async () => {
    if (!showComments && !commentsLoaded) await loadComments();
    setShowComments((v) => !v);
    if (!showComments) setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const handleAddComment = async () => {
    if (!token || !commentText.trim()) return;
    setAddingComment(true);
    try {
      const res = await fetch(`${API}/api/creative-listings/${listing.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: commentText.trim() }),
      });
      if (res.ok) {
        setCommentText("");
        setListing((l) => ({ ...l, commentCount: (l.commentCount ?? 0) + 1 }));
        toast.success(t.commentAdded);
        await loadComments();
        void refreshMe();
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast.error(err.message ?? "Error");
      }
    } finally {
      setAddingComment(false);
    }
  };

  const startEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!token || !editingCommentText.trim()) return;
    try {
      const res = await fetch(`${API}/api/creative-listings/${listing.id}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: editingCommentText.trim() }),
      });
      if (res.ok) {
        setComments((c) => c.map((x) => x.id === commentId ? { ...x, text: editingCommentText.trim() } : x));
        cancelEditComment();
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast.error(err.message ?? "Error");
      }
    } catch { /* silent */ }
  };

  // Moderation-only removal (listing owner / admin) — regular commenters can only edit their own comment.
  const handleDeleteComment = async (commentId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/creative-listings/${listing.id}/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setComments((c) => c.filter((x) => x.id !== commentId));
        setListing((l) => ({ ...l, commentCount: Math.max(0, (l.commentCount ?? 0) - 1) }));
      }
    } catch { /* silent */ }
  };

  const handleEdit = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/creative-listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          contentType: editForm.contentType,
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          link: editForm.link.trim(),
          thumbnailUrl: editForm.thumbnailUrl.trim(),
          tags: editForm.tags.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean),
          price: Number(editForm.price),
        }),
      });
      if (res.ok) {
        toast.success(t.editSuccess);
        const updated: Listing = {
          ...listing,
          contentType: editForm.contentType as ContentType,
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          link: editForm.link.trim(),
          thumbnailUrl: editForm.thumbnailUrl.trim(),
          tags: editForm.tags.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean),
          price: Number(editForm.price),
        };
        setListing(updated);
        setEditMode(false);
        onUpdated?.(updated);
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast.error(err.message ?? "Error");
      }
    } finally {
      setSaving(false);
    }
  };

  const openEdit = () => {
    setEditForm({
      contentType: listing.contentType,
      title: listing.title,
      description: listing.description,
      link: listing.link,
      thumbnailUrl: listing.thumbnailUrl,
      price: String(listing.price),
      tags: (listing.tags ?? []).join(", "),
    });
    setEditMode(true);
  };

  const sold = listing.status === "sold";
  const canEdit = (isOwner || isAdmin) && !sold;
  // NFT-style ownership: the original registrant is the owner until the listing sells,
  // at which point the buyer becomes the displayed owner.
  const ownerName = sold ? (listing.buyerName || listing.sellerName) : listing.sellerName;

  if (editMode) {
    return (
      <Card className="border-violet-300 dark:border-violet-700">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-bold text-sm">{t.editTitle}</h3>

          <Select value={editForm.contentType} onValueChange={(v) => setEditForm((p) => ({ ...p, contentType: v as ContentType }))}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPES.map((ct) => (
                <SelectItem key={ct.value} value={ct.value}>{ct.value}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            className="h-8 text-sm"
            value={editForm.title}
            onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
            placeholder={t.fieldTitle}
          />
          <Textarea
            rows={2}
            className="text-sm"
            value={editForm.description}
            onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
            placeholder={t.fieldDesc}
          />
          <Input
            className="h-8 text-sm"
            value={editForm.link}
            onChange={(e) => setEditForm((p) => ({ ...p, link: e.target.value }))}
            placeholder={t.fieldLink}
          />
          <Input
            className="h-8 text-sm"
            value={editForm.thumbnailUrl}
            onChange={(e) => setEditForm((p) => ({ ...p, thumbnailUrl: e.target.value }))}
            placeholder={t.fieldThumbnail}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              className="h-8 text-sm"
              type="number"
              min={1}
              value={editForm.price}
              onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
              placeholder={t.fieldPrice}
            />
            <Input
              className="h-8 text-sm"
              value={editForm.tags}
              onChange={(e) => setEditForm((p) => ({ ...p, tags: e.target.value }))}
              placeholder={t.fieldTags}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleEdit} disabled={saving}
              className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.saveBtn}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>
              {t.cancelBtn}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={sold ? "opacity-70" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="flex items-start gap-3 flex-1 min-w-0 text-left cursor-pointer"
          >
            <div className="mt-0.5 w-14 h-14 rounded-lg bg-muted shrink-0 overflow-hidden flex items-center justify-center">
              {listing.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.thumbnailUrl} alt={listing.title} className="w-full h-full object-cover" />
              ) : (
                <ContentTypeIcon type={listing.contentType} />
              )}
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
                <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                  <Crown className="h-3.5 w-3.5" />
                  {t.ownerLabel}: {ownerName}
                </span>
                <span className="flex items-center gap-1 font-semibold text-violet-600">
                  <Coins className="h-3.5 w-3.5" />
                  {listing.price.toLocaleString()} AP
                </span>
                {listing.tags?.length > 0 && (
                  <span className="font-mono text-violet-500">{listing.tags.map((x) => `#${x}`).join(" ")}</span>
                )}
              </div>
            </div>
          </button>
          <div className="flex flex-col gap-1 shrink-0">
            {listing.link && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setDetailOpen(true)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t.viewBtn}
              </Button>
            )}
            {!isOwner && !sold && onBuy && (
              <Button size="sm" onClick={onBuy}
                className="gap-1 bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90">
                <ShoppingBag className="h-3.5 w-3.5" />
                {t.buyBtn}
              </Button>
            )}
            {(isOwner || isAdmin) && !sold && onDelete && (
              <Button size="sm" variant="ghost" onClick={onDelete}
                className="gap-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">
                <Trash2 className="h-3.5 w-3.5" />
                {t.deleteBtn}
              </Button>
            )}
          </div>
        </div>

        {/* Footer: likes, comments, edit */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 text-sm text-muted-foreground">
          <button
            onClick={handleLike}
            disabled={liked}
            className={`flex items-center gap-1 transition-colors ${liked ? "text-red-500 cursor-default" : "hover:text-red-400"}`}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
            <span>{likeCount}</span>
          </button>
          <button
            onClick={toggleComments}
            className={`flex items-center gap-1 transition-colors hover:text-foreground ${showComments ? "text-violet-500" : ""}`}
          >
            <MessageCircle className="h-4 w-4" />
            <span>{listing.commentCount ?? 0}</span>
          </button>
          <button
            onClick={() => shareListingToFacebook(listing)}
            title={t.shareFacebook}
            className="flex items-center gap-1 transition-colors hover:text-[#1877F2]"
          >
            <FacebookIcon className="h-4 w-4" />
          </button>
          {canEdit && (
            <button
              onClick={openEdit}
              className="flex items-center gap-1 transition-colors hover:text-foreground ml-auto"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t.editBtn}
            </button>
          )}
        </div>

        {/* Comments panel */}
        {showComments && (
          <div className="mt-3 space-y-2">
            {!commentsLoaded ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">{t.noComments}</p>
            ) : (
              comments.map((c) => (
                editingCommentId === c.id ? (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <Input
                      className="h-8 text-sm flex-1"
                      value={editingCommentText}
                      onChange={(e) => setEditingCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); void handleSaveEditComment(c.id); }
                        if (e.key === "Escape") cancelEditComment();
                      }}
                      autoFocus
                    />
                    <Button size="sm" className="shrink-0" onClick={() => void handleSaveEditComment(c.id)}>
                      {t.saveBtn}
                    </Button>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={cancelEditComment}>
                      {t.cancelBtn}
                    </Button>
                  </div>
                ) : (
                  <div key={c.id} className="flex items-start gap-2 text-sm">
                    <span className="font-semibold shrink-0 text-foreground/80">{c.userName}</span>
                    <span className="flex-1 text-foreground/70 break-all">{c.text}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    {userId === c.userId && (
                      <button
                        onClick={() => startEditComment(c)}
                        className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {userId !== c.userId && (isOwner || isAdmin) && (
                      <button
                        onClick={() => void handleDeleteComment(c.id)}
                        className="text-red-400 hover:text-red-600 shrink-0 mt-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )
              ))
            )}
            {token && (
              <div className="flex gap-2 mt-2 pt-2 border-t border-border/30">
                <Input
                  ref={commentInputRef}
                  className="h-8 text-sm"
                  placeholder={t.commentPlaceholder}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleAddComment();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={addingComment || !commentText.trim()}
                  className="shrink-0 bg-violet-600 text-white hover:bg-violet-700"
                >
                  {addingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.commentAddBtn}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {listing.title}
              {sold && (
                <Badge className="bg-muted-foreground text-white text-xs">{t.soldLabel}</Badge>
              )}
              <Badge variant="secondary" className="text-xs capitalize">{listing.contentType}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="w-full aspect-video rounded-lg bg-muted overflow-hidden flex items-center justify-center relative">
              {listing.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.thumbnailUrl} alt={listing.title} className="w-full h-full object-cover" />
              ) : (
                <ContentTypeIcon type={listing.contentType} className="h-10 w-10 text-muted-foreground" />
              )}
              {listing.thumbnailUrl && (
                <a
                  href={listing.thumbnailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: "sm", variant: "secondary", className: "absolute bottom-2 right-2 gap-1 shadow" })}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  {t.viewOriginalBtn}
                </a>
              )}
            </div>
            {listing.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                <Crown className="h-4 w-4" />
                {t.ownerLabel}: {ownerName}
              </span>
              {sold && listing.buyerName && (
                <span className="text-xs text-muted-foreground">({t.seller}: {listing.sellerName})</span>
              )}
              <span className="flex items-center gap-1 font-semibold text-violet-600">
                <Coins className="h-4 w-4" />
                {listing.price.toLocaleString()} AP
              </span>
            </div>
            {listing.tags?.length > 0 && (
              <div className="font-mono text-sm text-violet-500">{listing.tags.map((x) => `#${x}`).join(" ")}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)} className="gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t.backBtn}
            </Button>
            <Button
              variant="outline"
              onClick={() => shareListingToFacebook(listing)}
              className="gap-1.5 text-[#1877F2] border-[#1877F2]/30 hover:bg-[#1877F2]/10"
            >
              <FacebookIcon className="h-3.5 w-3.5" />
              {t.shareFacebook}
            </Button>
            {listing.link && (
              <a
                href={listing.link}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "sm", className: "gap-1 bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90" })}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t.viewBtn}
              </a>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtu\.be\/)([\w-]{11})/,
  ];
  for (const re of patterns) {
    const match = url.match(re);
    if (match) return match[1];
  }
  return null;
}

// Loads a direct video URL off-screen and grabs a random frame as a JPEG data URL.
// Only works for directly-playable video files with CORS enabled — silently
// resolves to null for page URLs (Instagram/TikTok/Facebook) or CORS-blocked sources.
function captureVideoRandomFrame(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 8000);

    // Pick a random point in the video rather than always the first frame,
    // which is frequently a black/blank or unrepresentative frame.
    video.addEventListener("loadedmetadata", () => {
      const duration = video.duration;
      const seekTime = Number.isFinite(duration) && duration > 0.5
        ? 0.1 + Math.random() * (duration - 0.2)
        : 0.1;
      video.currentTime = seekTime;
    });

    video.addEventListener("seeked", () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        const maxWidth = 480;
        const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
        canvas.width = Math.round((video.videoWidth || maxWidth) * scale);
        canvas.height = Math.round((video.videoHeight || 270) * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { cleanup(); resolve(null); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        cleanup();
        resolve(dataUrl);
      } catch {
        // Tainted canvas (CORS) or decode failure — no thumbnail, user can add one manually.
        cleanup();
        resolve(null);
      }
    });

    video.addEventListener("error", () => {
      clearTimeout(timeout);
      cleanup();
      resolve(null);
    });
  });
}

function CreativeMarketPageContent() {
  const { user, token } = useAuthStore();
  const { t } = useLanguage();
  const cm = t.creativeMarket;
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("listing");

  const [activeType, setActiveType] = useState<string>("all");
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [myPurchases, setMyPurchases] = useState<Listing[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    contentType: "video", title: "", description: "", link: "", thumbnailUrl: "", price: "", tags: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [thumbGenerating, setThumbGenerating] = useState(false);

  // Auto-fills the thumbnail from a random frame of the video — YouTube links get the
  // official thumbnail image instantly; direct video file URLs are captured via canvas.
  // Never overwrites a thumbnail the user already provided.
  const maybeAutoThumbnail = useCallback(async (link: string, contentType: string, currentThumb: string) => {
    if (contentType !== "video" || !link.trim() || currentThumb.trim()) return;

    const ytId = extractYouTubeId(link.trim());
    if (ytId) {
      setForm((p) => (p.thumbnailUrl.trim() ? p : { ...p, thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }));
      return;
    }

    setThumbGenerating(true);
    try {
      const dataUrl = await captureVideoRandomFrame(link.trim());
      if (dataUrl) {
        setForm((p) => (p.thumbnailUrl.trim() ? p : { ...p, thumbnailUrl: dataUrl }));
      }
    } finally {
      setThumbGenerating(false);
    }
  }, []);

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

  const loadMyLikes = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/creative-listings/my-likes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const ids = await res.json() as string[];
        setLikedIds(new Set(ids));
      }
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => { void loadListings(activeType); }, [loadListings, activeType]);
  useEffect(() => { if (token) void loadMyLikes(); }, [loadMyLikes, token]);

  const handleUpdatedInBrowse = (updated: Listing) => {
    setListings((prev) => prev.map((l) => l.id === updated.id ? updated : l));
  };

  const handleUpdatedInMine = (updated: Listing) => {
    setMyListings((prev) => prev.map((l) => l.id === updated.id ? updated : l));
  };

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

  const cmT = cm as unknown as Record<string, string>;

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-black mb-1">{cm.title}</h1>
        <p className="text-muted-foreground">{cm.subtitle}</p>
      </div>

      <Card className="mb-8 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2 font-bold text-sm text-violet-700 dark:text-violet-300">
            <Sparkles className="h-4 w-4" />
            {cm.rewardsTitle}
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>{cm.rewardsRegister}</li>
            <li>{cm.rewardsCommentReceived}</li>
            <li>{cm.rewardsCommentGiven}</li>
            <li>{cm.rewardsLikeReceived}</li>
            <li>{cm.rewardsLikeGiven}</li>
          </ul>
        </CardContent>
      </Card>

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
                  isAdmin={user?.isAdmin}
                  likedByMe={likedIds.has(l.id)}
                  token={token}
                  userId={user?.id}
                  initialOpen={l.id === deepLinkId}
                  onBuy={() => void handleBuy(l.id)}
                  onDelete={() => void handleDelete(l.id)}
                  onUpdated={handleUpdatedInBrowse}
                  t={cmT}
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
                    <Select
                      value={form.contentType}
                      onValueChange={(v) => {
                        setForm((p) => ({ ...p, contentType: v }));
                        void maybeAutoThumbnail(form.link, v, form.thumbnailUrl);
                      }}
                    >
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
                      onBlur={(e) => void maybeAutoThumbnail(e.target.value, form.contentType, form.thumbnailUrl)}
                      required
                    />
                    {form.contentType === "video" && (
                      <p className="text-xs text-muted-foreground">{cm.thumbAutoNote}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>{cm.fieldThumbnail}</Label>
                    <Input
                      placeholder="https://..."
                      value={form.thumbnailUrl}
                      onChange={(e) => setForm((p) => ({ ...p, thumbnailUrl: e.target.value }))}
                    />
                    {thumbGenerating && (
                      <p className="text-xs text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {cm.thumbAutoGenerating}
                      </p>
                    )}
                    {form.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.thumbnailUrl}
                        alt={cm.fieldThumbnail}
                        className="h-20 w-32 object-cover rounded-lg border mt-1"
                      />
                    )}
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
                    isAdmin={user.isAdmin}
                    likedByMe={likedIds.has(l.id)}
                    token={token}
                    userId={user.id}
                    onDelete={() => void handleDelete(l.id)}
                    onUpdated={handleUpdatedInMine}
                    t={cmT}
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
                        <div className="mt-0.5 w-14 h-14 rounded-lg bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                          {l.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.thumbnailUrl} alt={l.title} className="w-full h-full object-cover" />
                          ) : (
                            <ContentTypeIcon type={l.contentType} />
                          )}
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

export default function CreativeMarketPage() {
  return (
    <Suspense>
      <CreativeMarketPageContent />
    </Suspense>
  );
}
