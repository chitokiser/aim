"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DOMPurify from "isomorphic-dompurify";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileText } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  videoUrl: string | null;
  tags: string[];
  createdAt: string;
}

export default function BlogDetailClient({ slug }: { slug: string }) {
  const { t } = useLanguage();
  const b = t.blog;
  // When this page is served from the static-export fallback (slug="_", e.g.
  // via a Netlify _redirects rewrite for a post published after the last
  // build), useParams() still reflects the real browser URL — prefer it over
  // the build-time prop so newly published posts work without a redeploy.
  const routeParams = useParams();
  const postSlug = (routeParams?.slug as string) || slug;

  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/blog/posts/${postSlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPost(data))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [postSlug]);

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

      <h1 className="mb-2 text-3xl font-black">{post.title}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {b.postedOn} {new Date(post.createdAt).toLocaleDateString()}
      </p>

      {post.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImage}
          alt={post.title}
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

      <div
        className="prose prose-neutral dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
      />

      {post.tags?.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-1.5 border-t pt-4">
          <span className="text-sm text-muted-foreground">{b.tags}:</span>
          {post.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </article>
  );
}
