import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creative Market — Buy & Sell AI Content on AI119",
  description:
    "Buy and sell AI-generated content on AI119 Creative Market. AI images, music, videos, and creative works — transact with AimPoints (AP) and earn TON crypto.",
  keywords: [
    "AI creative market",
    "buy AI content",
    "sell AI images",
    "AI generated music",
    "AI119 creative market",
    "AI content marketplace",
    "크리에이티브 마켓",
    "AI 창작물 판매",
  ],
  openGraph: {
    title: "Creative Market — Buy & Sell AI Content on AI119",
    description:
      "Marketplace for AI-generated images, music, and videos. Buy and sell with AimPoints, earn TON crypto.",
    url: "https://ai119.netlify.app/creative-market",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Creative Market" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Creative Market — Buy & Sell AI Content on AI119",
    description:
      "AI-generated images, music, and videos marketplace. Transact with AP and earn TON.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/creative-market",
  },
  robots: { index: true, follow: true },
};

export default function CreativeMarketLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
