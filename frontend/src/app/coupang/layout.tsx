import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TrendPick — Curated Product Videos on AI119",
  description:
    "Browse TrendPick on AI119: curated short-form product videos and trending picks, with quick links to buy. Discover what's popular right now.",
  keywords: [
    "TrendPick",
    "트렌드픽",
    "product videos",
    "trending products",
    "AI119 trendpick",
    "쇼핑 영상",
    "인기 상품",
  ],
  openGraph: {
    title: "TrendPick — Curated Product Videos on AI119",
    description:
      "Curated short-form product videos and trending picks, with quick links to buy.",
    url: "https://ai119.netlify.app/coupang",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 TrendPick" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TrendPick — Curated Product Videos on AI119",
    description: "Curated short-form product videos and trending picks.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/coupang",
  },
  robots: { index: true, follow: true },
};

export default function CoupangLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
