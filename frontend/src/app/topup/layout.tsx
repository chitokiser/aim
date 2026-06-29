import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AP Top-Up — Add AimPoints on AI119",
  description:
    "Top up your AimPoints (AP) balance on AI119. Pay with TON, USDT, or Telegram Stars. 10,000 AP = 1 USD. Use AP to run advertiser campaigns, bid in auctions, and more.",
  keywords: [
    "AP top-up",
    "AimPoint top-up",
    "buy AP",
    "buy AimPoints",
    "TON payment",
    "USDT payment",
    "Telegram Stars",
    "AI119 충전",
    "포인트 충전",
  ],
  openGraph: {
    title: "AP Top-Up — Add AimPoints on AI119",
    description:
      "Top up AimPoints (AP) with TON, USDT, or Telegram Stars. 10,000 AP = 1 USD.",
    url: "https://ai119.netlify.app/topup",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 AP Top-Up" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AP Top-Up — Add AimPoints on AI119",
    description:
      "Top up AimPoints with TON, USDT, or Telegram Stars. 10,000 AP = 1 USD.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/topup",
  },
  robots: { index: true, follow: true },
};

export default function TopupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
