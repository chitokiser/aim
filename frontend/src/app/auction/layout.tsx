import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Digital Asset Auction — AI119",
  description:
    "Bid on digital assets with AimPoints (AP) on AI119. Live auctions for Telegram bots, AI-generated content, digital collectibles, and more. Win and earn TON crypto.",
  keywords: [
    "digital asset auction",
    "AI119 auction",
    "bid with AP",
    "Telegram bot auction",
    "digital collectibles",
    "earn TON auction",
    "디지털 자산 경매",
    "AimPoint auction",
  ],
  openGraph: {
    title: "Digital Asset Auction — AI119",
    description:
      "Live auctions for Telegram bots, AI content, and digital assets. Bid with AimPoints and win TON crypto rewards.",
    url: "https://ai119.netlify.app/auction",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Digital Asset Auction" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Digital Asset Auction — AI119",
    description:
      "Live auctions for Telegram bots, AI content, and digital assets. Bid with AP and win TON.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/auction",
  },
  robots: { index: true, follow: true },
};

export default function AuctionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
