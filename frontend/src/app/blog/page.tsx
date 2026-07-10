"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, Eye, Heart, MessageCircle, Search, Flame } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { WEBZINE_CATEGORIES, webzineCategoryLabel } from "@/lib/webzine-categories";
import { TrendingKeywordsWidget } from "@/components/trending-keywords-widget";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const DAY_MS = 24 * 60 * 60 * 1000;

// Sub-groups within the "classics" (고전읽기) category — surfaced as a filter
// row of tag badges rather than a real sub-category field, since every post
// (chaptered series or single-work article) already shares a consistent
// group tag (see backend/src/scripts/seed-classics-works.ts and the
// 손자병법/삼십육계 series scripts, which are retagged into "동양고전").
const CLASSICS_SERIES: { tag: string; ko: string; en: string; vi: string }[] = [
  { tag: "철학", ko: "철학", en: "Philosophy", vi: "Triết học" },
  { tag: "문학", ko: "문학", en: "Literature", vi: "Văn học" },
  { tag: "동양고전", ko: "동양고전", en: "Eastern Classics", vi: "Kinh điển phương Đông" },
  { tag: "역사·정치·경제", ko: "역사·정치·경제", en: "History, Politics & Economics", vi: "Lịch sử, Chính trị & Kinh tế" },
  { tag: "자기계발·처세", ko: "자기계발·처세", en: "Self-Improvement & Wisdom", vi: "Tự hoàn thiện & Xử thế" },
];

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string | null;
  tags: string[];
  category: string;
  views: number;
  likes: number;
  commentCount: number;
  createdAt: string;
}

function RankedList({ posts, emptyLabel }: { posts: BlogPost[]; emptyLabel: string }) {
  if (posts.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ol className="grid gap-2 sm:grid-cols-2">
      {posts.map((post, i) => (
        <li key={post.id}>
          <Link
            href={`/blog/${post.slug}`}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            <span className={cn("w-5 shrink-0 text-center font-black", i < 3 ? "text-emerald-500" : "text-muted-foreground")}>
              {i + 1}
            </span>
            <span className="line-clamp-1 flex-1">{post.title}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function BlogPageContent() {
  const { t, lang } = useLanguage();
  const b = t.blog;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tag = searchParams.get("tag");
    setTagFilter(tag ?? "");
  }, [searchParams]);

  useEffect(() => {
    fetch(`${API}/api/blog/posts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BlogPost[]) => setPosts(data))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const usedCategories = useMemo(() => {
    const slugs = new Set(posts.map((p) => p.category || "general"));
    return WEBZINE_CATEGORIES.filter((c) => slugs.has(c.slug));
  }, [posts]);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return posts
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.tags?.some((tag) => tag.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [posts, searchQuery]);

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (category) result = result.filter((p) => (p.category || "general") === category);
    if (tagFilter) result = result.filter((p) => p.tags?.includes(tagFilter));
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.tags?.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [posts, category, tagFilter, searchQuery]);

  const rankings = useMemo(() => {
    const now = Date.now();
    const today = posts.filter((p) => now - new Date(p.createdAt).getTime() < DAY_MS);
    const week = posts.filter((p) => now - new Date(p.createdAt).getTime() < 7 * DAY_MS);
    const byViews = (list: BlogPost[]) => [...list].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    const byLikes = (list: BlogPost[]) => [...list].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    const byComments = (list: BlogPost[]) => [...list].sort((a, b) => (b.commentCount ?? 0) - (a.commentCount ?? 0));
    return {
      today: byViews(today).slice(0, 6),
      week: byViews(week).slice(0, 6),
      views: byViews(posts).slice(0, 6),
      likes: byLikes(posts).slice(0, 6),
      comments: byComments(posts).filter((p) => (p.commentCount ?? 0) > 0).slice(0, 6),
    };
  }, [posts]);

  const clearTagFilter = () => {
    setTagFilter("");
    router.replace("/blog");
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black mb-1">{b.title}</h1>
        <p className="text-muted-foreground">{b.subtitle}</p>
      </div>

      {/* Search with live autocomplete */}
      <div ref={searchBoxRef} className="relative mx-auto mb-6 max-w-lg">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder={b.searchPlaceholder}
            className="pl-9"
          />
        </div>
        {searchFocused && searchMatches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border bg-background shadow-lg">
            {searchMatches.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="block truncate px-4 py-2 text-sm hover:bg-muted"
                onClick={() => setSearchFocused(false)}
              >
                {post.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      <TrendingKeywordsWidget />

      {/* Popular content rankings */}
      {posts.length > 0 && (
        <div className="mb-8 rounded-xl border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Flame className="h-4 w-4 text-orange-500" />
            {b.popularTitle}
          </div>
          <Tabs defaultValue="today">
            <TabsList className="mb-3">
              <TabsTrigger value="today">{b.rankToday}</TabsTrigger>
              <TabsTrigger value="week">{b.rankWeek}</TabsTrigger>
              <TabsTrigger value="views">{b.rankViews}</TabsTrigger>
              <TabsTrigger value="likes">{b.rankLikes}</TabsTrigger>
              <TabsTrigger value="comments">{b.rankComments}</TabsTrigger>
            </TabsList>
            <TabsContent value="today"><RankedList posts={rankings.today} emptyLabel={b.noPosts} /></TabsContent>
            <TabsContent value="week"><RankedList posts={rankings.week} emptyLabel={b.noPosts} /></TabsContent>
            <TabsContent value="views"><RankedList posts={rankings.views} emptyLabel={b.noPosts} /></TabsContent>
            <TabsContent value="likes"><RankedList posts={rankings.likes} emptyLabel={b.noPosts} /></TabsContent>
            <TabsContent value="comments"><RankedList posts={rankings.comments} emptyLabel={b.noPosts} /></TabsContent>
          </Tabs>
        </div>
      )}

      {tagFilter && (
        <div className="mb-6 flex items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">{b.filteredByTag}</span>
          <Badge variant="secondary">#{tagFilter}</Badge>
          <button onClick={clearTagFilter} className="text-muted-foreground underline hover:text-foreground">
            {b.clearFilter}
          </button>
        </div>
      )}

      {usedCategories.length > 0 && (
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setCategory("")}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              category === "" ? "bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            {b.categoryAll}
          </button>
          {usedCategories.map((c) => (
            <button
              key={c.slug}
              onClick={() => setCategory(c.slug)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                category === c.slug ? "bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {c[lang]}
            </button>
          ))}
        </div>
      )}

      {category === "classics" && (
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {CLASSICS_SERIES.map((s) => (
            <button
              key={s.tag}
              onClick={() => router.push(`/blog?tag=${encodeURIComponent(s.tag)}`)}
              className={cn(
                "rounded-full border border-dashed px-3 py-1 text-xs transition-colors",
                tagFilter === s.tag ? "bg-violet-600 text-white border-violet-600" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {s[lang]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <FileText className="h-8 w-8" />
          <p>{b.noPosts}</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`}>
              <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
                {post.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="h-40 w-full object-cover"
                  />
                )}
                <CardContent className="p-4">
                  <Badge variant="outline" className="mb-2 text-xs">
                    {webzineCategoryLabel(post.category || "general", lang)}
                  </Badge>
                  <h2 className="mb-1.5 line-clamp-2 font-semibold">{post.title}</h2>
                  <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {post.tags?.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {b.postedOn} {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-3 w-3" /> {post.views ?? 0}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Heart className="h-3 w-3" /> {post.likes ?? 0}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MessageCircle className="h-3 w-3" /> {post.commentCount ?? 0}
                      </span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BlogPage() {
  return (
    <Suspense>
      <BlogPageContent />
    </Suspense>
  );
}
