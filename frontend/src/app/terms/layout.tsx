import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — AI119",
  description:
    "Read the AI119 Terms of Service: account rules, AP/P points, mission rewards, withdrawals, and platform policies.",
  keywords: ["AI119 terms of service", "이용약관", "điều khoản sử dụng"],
  openGraph: {
    title: "Terms of Service — AI119",
    description: "The rules and policies governing use of the AI119 platform.",
    url: "https://ai119.netlify.app/terms",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service — AI119",
    description: "The rules and policies governing use of the AI119 platform.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/terms",
  },
  robots: { index: true, follow: true },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
