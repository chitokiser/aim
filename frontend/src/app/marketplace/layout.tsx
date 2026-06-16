import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "텔레그램 봇 무료등록 — AI119 Marketplace",
  description:
    "텔레그램 봇, 미니앱, 그룹, 채널을 무료로 등록하고 홍보하세요. Telegram bot & mini app free directory. Register your bot or channel and reach thousands of users.",
  keywords: [
    "텔레그램 봇 등록",
    "텔레그램 봇 무료등록",
    "텔레그램 채널 홍보",
    "텔레그램 그룹 홍보",
    "Telegram bot directory",
    "Telegram mini app",
    "free Telegram bot listing",
    "telegram channel promotion",
    "AI119 marketplace",
  ],
  openGraph: {
    title: "텔레그램 봇·미니앱·그룹·채널 무료등록 — AI119",
    description:
      "텔레그램 봇, 미니앱, 그룹, 채널을 무료로 등록하고 수천 명의 유저에게 홍보하세요. Free Telegram bot & channel directory.",
    url: "https://ai119.netlify.app/marketplace",
    siteName: "AI119",
    type: "website",
    images: [
      {
        url: "/images/aimlogo.png",
        width: 512,
        height: 512,
        alt: "AI119 Telegram Bot Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "텔레그램 봇 무료등록 — AI119 Marketplace",
    description:
      "텔레그램 봇, 미니앱, 그룹, 채널을 무료로 등록하고 홍보하세요.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/marketplace",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
