import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About AI119 — AI-Powered Performance Marketing Platform",
  description:
    "AI119 connects advertisers with a global creator community. Complete AI-powered marketing missions, earn AimPoints (AP), and exchange for TON.",
  keywords: ["about AI119", "AI119 소개", "giới thiệu AI119", "performance marketing platform", "AimPoint"],
  openGraph: {
    title: "About AI119",
    description: "How AI119 connects advertisers and creators through verified, AP-rewarded missions.",
    url: "https://ai119.netlify.app/about",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About AI119",
    description: "How AI119 connects advertisers and creators through verified, AP-rewarded missions.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/about",
  },
  robots: { index: true, follow: true },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
