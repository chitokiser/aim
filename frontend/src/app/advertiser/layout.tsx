import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Advertiser Dashboard — Create Campaigns on AI119",
  description:
    "Launch advertiser campaigns on AI119. Set missions for members — SNS promotion, AI content creation, engagement tasks. Pay with AimPoints (AP) and reach thousands of active creators.",
  keywords: [
    "advertiser dashboard",
    "create ad campaign",
    "AI119 advertiser",
    "SNS marketing platform",
    "AimPoint campaigns",
    "광고주 대시보드",
    "미션 등록",
    "influencer marketing",
  ],
  openGraph: {
    title: "Advertiser Dashboard — Create Campaigns on AI119",
    description:
      "Create missions for thousands of AI119 members. Pay with AP and get SNS promotion, AI content, and more.",
    url: "https://ai119.netlify.app/advertiser",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Advertiser Dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Advertiser Dashboard — Create Campaigns on AI119",
    description:
      "Launch campaigns on AI119 and reach thousands of active creators. Pay with AimPoints.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/advertiser",
  },
  robots: { index: true, follow: true },
};

export default function AdvertiserLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
