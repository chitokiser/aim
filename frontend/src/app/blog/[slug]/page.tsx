import type { Metadata } from "next";
import BlogDetailClient from "./BlogDetailClient";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "https://ai119-bot-production.up.railway.app"}/api`;

interface BlogPostSeo {
  title: string;
  excerpt: string;
  coverImage: string | null;
  tags: string[];
}

export async function generateStaticParams() {
  // Always include the "_" fallback shell so Netlify's _redirects rule
  // (/blog/* -> /blog/_.html) has a real file to serve for posts published
  // after this build (static export can't know about them yet).
  try {
    const res = await fetch(`${API}/blog/posts`, { cache: "no-store" });
    if (!res.ok) return [{ slug: "_" }];
    const posts: { slug: string }[] = await res.json();
    const slugs = posts.map((p) => ({ slug: String(p.slug) }));
    return [...slugs, { slug: "_" }];
  } catch {
    return [{ slug: "_" }];
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API}/blog/posts/${slug}`, { cache: "no-store" });
    if (!res.ok) throw new Error("not found");
    const post: BlogPostSeo = await res.json();

    const title = `${post.title} | AI119 Blog`;
    const description = post.excerpt.slice(0, 160);
    const image = post.coverImage ?? "/images/aimlogo.png";
    const url = `https://ai119.netlify.app/blog/${slug}`;

    return {
      title,
      description,
      keywords: [...(post.tags ?? []), "AI119", "AI119 blog"],
      alternates: { canonical: url },
      openGraph: { title, description, url, siteName: "AI119", type: "article", images: [{ url: image }] },
      twitter: { card: "summary_large_image", title, description, images: [image] },
      robots: { index: true, follow: true },
    };
  } catch {
    return { title: "Post | AI119 Blog" };
  }
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params;
  return <BlogDetailClient slug={slug} />;
}
