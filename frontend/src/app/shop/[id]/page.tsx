import type { Metadata } from "next";
import ShopDetailClient from "./ShopDetailClient";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "https://ai119-bot-production.up.railway.app"}/api`;

interface CjProductSeo {
  nameKo: string;
  images?: string[];
  hashtags?: string[];
  apPrice?: number;
}

export async function generateStaticParams() {
  // Always include the "_" fallback shell so Netlify's _redirects rule
  // (/shop/* -> /shop/_.html) has a real file to serve for product IDs
  // registered after this build (static export can't know about them yet).
  try {
    const res = await fetch(`${API}/cj-shop/products`, { cache: "no-store" });
    if (!res.ok) return [{ id: "_" }];
    const products: { id: string }[] = await res.json();
    const ids = products.map((p) => ({ id: String(p.id) }));
    return [...ids, { id: "_" }];
  } catch {
    return [{ id: "_" }];
  }
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(`${API}/cj-shop/products/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error("not found");
    const product: CjProductSeo = await res.json();

    const hashtags = product.hashtags ?? [];
    const title = `${product.nameKo} | AI119 Shop`;
    const description = `${product.nameKo} — buy with AP or EXP points on AI119.${
      hashtags.length ? ` ${hashtags.map((h) => `#${h}`).join(" ")}` : ""
    }`.slice(0, 160);
    const image = product.images?.[0] ?? "/images/aimlogo.png";
    const url = `https://ai119.netlify.app/shop/${id}`;

    return {
      title,
      description,
      keywords: [...hashtags, "AI119", "AI119 shop"],
      alternates: { canonical: url },
      openGraph: { title, description, url, siteName: "AI119", type: "website", images: [{ url: image }] },
      twitter: { card: "summary_large_image", title, description, images: [image] },
      robots: { index: true, follow: true },
    };
  } catch {
    return { title: "Product | AI119 Shop" };
  }
}

export default async function ShopDetailPage({ params }: Props) {
  const { id } = await params;
  return <ShopDetailClient id={id} />;
}
