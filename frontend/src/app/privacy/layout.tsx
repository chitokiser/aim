import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — AI119",
  description:
    "Read the AI119 Privacy Policy: what information we collect, how we use it, and your rights regarding your personal data.",
  keywords: ["AI119 privacy policy", "개인정보처리방침", "chính sách bảo mật"],
  openGraph: {
    title: "Privacy Policy — AI119",
    description: "How AI119 collects, uses, and protects your personal data.",
    url: "https://ai119.netlify.app/privacy",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy — AI119",
    description: "How AI119 collects, uses, and protects your personal data.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/privacy",
  },
  robots: { index: true, follow: true },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
