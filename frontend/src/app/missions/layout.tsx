import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Advertiser Missions — Earn AP on AI119",
  description:
    "Browse and complete advertiser missions on AI119. Earn AimPoints (AP) through SNS promotion, AI content creation, and engagement tasks — withdraw rewards as TON crypto.",
  keywords: [
    "advertiser missions",
    "earn AP",
    "earn TON",
    "SNS promotion missions",
    "AI content missions",
    "AimPoint rewards",
    "AI119 missions",
    "텔레그램 미션",
    "광고주 미션",
  ],
  openGraph: {
    title: "Advertiser Missions — Earn AP on AI119",
    description:
      "Complete advertiser missions and earn AimPoints (AP) redeemable as TON crypto. SNS promotion, AI content, and more.",
    url: "https://ai119.netlify.app/missions",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Missions" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Advertiser Missions — Earn AP on AI119",
    description:
      "Complete advertiser missions and earn AP rewards redeemable as TON crypto.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/missions",
  },
  robots: { index: true, follow: true },
};

export default function MissionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
