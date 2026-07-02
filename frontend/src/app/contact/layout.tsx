import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us — AI119",
  description:
    "Get in touch with the AI119 team — questions, partnership inquiries, or issue reports. Email us or join our Telegram community.",
  keywords: ["contact AI119", "AI119 문의", "liên hệ AI119"],
  openGraph: {
    title: "Contact Us — AI119",
    description: "Reach the AI119 team by email or Telegram community.",
    url: "https://ai119.netlify.app/contact",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Us — AI119",
    description: "Reach the AI119 team by email or Telegram community.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/contact",
  },
  robots: { index: true, follow: true },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
