"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import DOMPurify from "isomorphic-dompurify";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, FileText, Heart, Eye, ExternalLink, Trash2, Share2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import { webzineCategoryLabel } from "@/lib/webzine-categories";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Splits article HTML into two halves so a hidden TIGU mascot icon (linking
// to the roulette EXP mini-game) can be rendered as a real React element
// between them, at a position that's stable per-post (hashed from the post
// id) but varies across posts rather than always landing in the same spot.
function splitContentForTreasure(html: string, seed: string): { before: string; after: string } {
  const parts = html.split("</p>");
  if (parts.length < 3) return { before: html, after: "" };
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const min = 1;
  const max = parts.length - 2;
  const index = min + (hash % (max - min + 1));
  return {
    before: parts.slice(0, index + 1).join("</p>") + "</p>",
    after: parts.slice(index + 1).join("</p>"),
  };
}

interface BlogSource {
  title: string;
  url: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  videoUrl: string | null;
  tags: string[];
  category: string;
  keyPoints: string[];
  sources: BlogSource[];
  views: number;
  likes: number;
  treasureCode: string | null;
  createdAt: string;
}

interface BlogComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  category: string;
  tags: string[];
}

export default function BlogDetailClient({ slug }: { slug: string }) {
  const { t, lang } = useLanguage();
  const b = t.blog;
  const { user, token } = useAuthStore();
  // When this page is served from the static-export fallback (slug="_", e.g.
  // via a Netlify _redirects rewrite for a post published after the last
  // build), useParams() only returns the param baked into that shell at
  // build time ("_"), never the real browser URL — reading the pathname
  // directly is the only way to get the actual slug for newly published
  // posts without a redeploy.
  const postSlug =
    typeof window !== "undefined"
      ? decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop() || slug)
      : slug;
  const searchParams = useSearchParams();
  const previewId = searchParams.get("preview");

  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState<RelatedPost[]>([]);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const authHeader = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token],
  );

  useEffect(() => {
    setLoading(true);
    const request =
      previewId && token
        ? fetch(`${API}/api/blog/admin/posts/${previewId}`, { headers: authHeader() })
        : fetch(`${API}/api/blog/posts/${postSlug}`);
    request
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPost(data))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [postSlug, previewId, token, authHeader]);

  useEffect(() => {
    if (!post) return;
    // Ranks by shared-tag count first (series-like grouping, e.g. all the
    // "World's Biggest ___" articles share tags), falling back to same
    // category — a plain category match alone is too broad once a category
    // has hundreds of unrelated articles in it.
    fetch(`${API}/api/blog/posts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RelatedPost[]) => {
        const others = data.filter((p) => p.slug !== post.slug);
        const scored = others.map((p) => {
          const sharedTags = p.tags?.filter((tag) => post.tags?.includes(tag)).length ?? 0;
          const sameCategory = p.category === post.category ? 1 : 0;
          return { post: p, score: sharedTags * 10 + sameCategory };
        });
        const ranked = scored
          .filter((s) => s.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((s) => s.post);
        setRelated(ranked);
      })
      .catch(() => setRelated([]));

    fetch(`${API}/api/blog/posts/${post.slug}/comments`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BlogComment[]) => setComments(data))
      .catch(() => setComments([]));
  }, [post]);

  useEffect(() => {
    if (!post || !token) {
      setLiked(false);
      return;
    }
    fetch(`${API}/api/blog/posts/${post.slug}/like-status`, { headers: authHeader() })
      .then((r) => (r.ok ? r.json() : { liked: false }))
      .then((data: { liked: boolean }) => setLiked(data.liked))
      .catch(() => setLiked(false));
  }, [post, token, authHeader]);

  const shareArticle = async () => {
    if (!post) return;
    const url = `${window.location.origin}/blog/${post.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, url });
      } catch {
        // user cancelled the native share sheet — not an error
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(b.linkCopied);
    } catch {
      toast.error(b.shareFailed);
    }
  };

  const toggleLike = async () => {
    if (!post) return;
    if (!token) {
      toast.error(b.likeLoginRequired);
      return;
    }
    setLikeBusy(true);
    try {
      const res = await fetch(`${API}/api/blog/posts/${post.slug}/like`, {
        method: "POST",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error();
      const data: { liked: boolean; likes: number } = await res.json();
      setLiked(data.liked);
      setPost({ ...post, likes: data.likes });
    } catch {
      // silently ignore — non-critical interaction
    } finally {
      setLikeBusy(false);
    }
  };

  const submitComment = async () => {
    if (!post) return;
    if (!token) {
      toast.error(b.commentLoginRequired);
      return;
    }
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`${API}/api/blog/posts/${post.slug}/comments`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (!res.ok) throw new Error();
      const comment: BlogComment = await res.json();
      setComments([...comments, comment]);
      setCommentText("");
    } catch {
      toast.error(b.commentLoginRequired);
    } finally {
      setSubmittingComment(false);
    }
  };

  const deleteComment = async (id: string) => {
    if (!confirm(b.deleteCommentConfirm)) return;
    try {
      const res = await fetch(`${API}/api/blog/comments/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error();
      setComments(comments.filter((c) => c.id !== id));
    } catch {
      // silently ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-24 text-center">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-xl font-bold">{b.notFoundTitle}</h1>
        <p className="text-sm text-muted-foreground">{b.notFoundDesc}</p>
        <Link href="/blog" className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {b.backToBlog}
        </Link>
      </div>
    );
  }

  return (
    <article className="container mx-auto max-w-3xl px-4 py-10">
      <Link href="/blog" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        {b.backToBlog}
      </Link>

      {previewId && (
        <div className="mb-6 rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
          {b.previewBanner}
        </div>
      )}

      <Badge variant="outline" className="mb-2">
        {webzineCategoryLabel(post.category || "general", lang)}
      </Badge>
      <h1 className="mb-2 text-3xl font-black">{post.title}</h1>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          {b.postedOn} {new Date(post.createdAt).toLocaleDateString()}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" /> {post.views ?? 0} {b.views}
        </span>
        <button
          onClick={toggleLike}
          disabled={likeBusy}
          className={cn(
            "flex items-center gap-1 transition-colors hover:text-foreground",
            liked && "text-red-500 hover:text-red-500",
          )}
        >
          <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} /> {post.likes ?? 0}
        </button>
        <button onClick={shareArticle} className="flex items-center gap-1 transition-colors hover:text-foreground">
          <Share2 className="h-3.5 w-3.5" /> {b.share}
        </button>
      </div>

      {post.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImage}
          alt={post.title}
          referrerPolicy="no-referrer"
          className="mb-6 max-h-96 w-full rounded-lg object-cover"
        />
      )}

      {post.videoUrl && (
        <div className="mb-6 aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            src={post.videoUrl}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={post.title}
          />
        </div>
      )}

      {post.keyPoints?.length > 0 && (
        <div className="mb-6 rounded-lg border bg-muted/40 p-4">
          <h2 className="mb-2 text-sm font-semibold">{b.keyPoints}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {post.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {(() => {
        const { before, after } = splitContentForTreasure(post.content, post.id);
        return (
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(before) }} />
            {post.treasureCode && (
              <Link
                href={`/event/roulette?src=${encodeURIComponent(post.treasureCode)}`}
                aria-label={b.treasureHint}
                title={b.treasureHint}
                className="not-prose my-4 flex justify-center"
              >
                <Image
                  src="/images/aimbot.png"
                  alt="TIGU"
                  width={40}
                  height={40}
                  className="animate-bounce opacity-80 transition-opacity hover:opacity-100"
                />
              </Link>
            )}
            {after && <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(after) }} />}
          </div>
        );
      })()}

      {post.tags?.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-1.5 border-t pt-4">
          <span className="text-sm text-muted-foreground">{b.tags}:</span>
          {post.tags.map((tag) => (
            <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`}>
              <Badge variant="secondary" className="transition-colors hover:bg-foreground hover:text-background">
                {tag}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {post.sources?.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{b.sources}</h2>
          <ul className="space-y-1 text-sm">
            {post.sources.map((source, i) => (
              <li key={i}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-10 border-t pt-6">
          <h2 className="mb-3 text-lg font-bold">{b.relatedPosts}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/blog/${r.slug}`}
                className="rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                {r.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 border-t pt-6">
        <h2 className="mb-3 text-lg font-bold">
          {b.comments} ({comments.length})
        </h2>

        <div className="mb-4 flex flex-col gap-2">
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={token ? b.commentPlaceholder : b.commentLoginRequired}
            disabled={!token}
            rows={2}
          />
          <Button
            size="sm"
            className="self-end"
            disabled={!token || submittingComment || !commentText.trim()}
            onClick={submitComment}
          >
            {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : b.commentSubmit}
          </Button>
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{b.noComments}</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">{c.userName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    {user && (user.id === c.userId || user.isAdmin) && (
                      <button
                        onClick={() => void deleteComment(c.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm">{c.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
