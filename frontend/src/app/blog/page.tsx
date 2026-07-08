"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, FileText } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string | null;
  tags: string[];
  createdAt: string;
}

export default function BlogPage() {
  const { t } = useLanguage();
  const b = t.blog;
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/blog/posts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BlogPost[]) => setPosts(data))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black mb-1">{b.title}</h1>
        <p className="text-muted-foreground">{b.subtitle}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <FileText className="h-8 w-8" />
          <p>{b.noPosts}</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
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
                  <h2 className="mb-1.5 line-clamp-2 font-semibold">{post.title}</h2>
                  <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {post.tags?.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {b.postedOn} {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
