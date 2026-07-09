"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, FileText, Eye, Heart } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { WEBZINE_CATEGORIES, webzineCategoryLabel } from "@/lib/webzine-categories";
import { TrendingKeywordsWidget } from "@/components/trending-keywords-widget";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  createdAt: string;
}

export default function BlogPage() {
  const { t, lang } = useLanguage();
  const b = t.blog;
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("");

  useEffect(() => {
    fetch(`${API}/api/blog/posts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BlogPost[]) => setPosts(data))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const usedCategories = useMemo(() => {
    const slugs = new Set(posts.map((p) => p.category || "general"));
    return WEBZINE_CATEGORIES.filter((c) => slugs.has(c.slug));
  }, [posts]);

  const filteredPosts = category ? posts.filter((p) => (p.category || "general") === category) : posts;

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black mb-1">{b.title}</h1>
        <p className="text-muted-foreground">{b.subtitle}</p>
      </div>

      <TrendingKeywordsWidget />

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
