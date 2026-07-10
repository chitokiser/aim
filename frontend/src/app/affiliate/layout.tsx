import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Picks — AI119",
  description:
    "Browse curated affiliate deals on AI119 — beauty, fashion, electronics, household and more, all in one place with quick links to each offer.",
  keywords: [
    "affiliate picks",
    "제휴 상품 모음",
    "affiliate deals",
    "AI119 affiliate",
    "curated deals",
  ],
  openGraph: {
    title: "Affiliate Picks — AI119",
    description:
      "Curated affiliate deals across beauty, fashion, electronics, household and more.",
    url: "https://ai119.netlify.app/affiliate",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Affiliate Picks" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Affiliate Picks — AI119",
    description: "Curated affiliate deals across beauty, fashion, electronics, household and more.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/affiliate",
  },
  robots: { index: true, follow: true },
};

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
