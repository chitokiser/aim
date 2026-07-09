import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Web Magazine — AI119",
  description:
    "Read the latest AI119 news, guides, and updates — how to earn AP, complete missions, and get the most out of the platform.",
  keywords: ["AI119 web magazine", "AI119 웹매거진", "AI119 가이드", "AI119 news"],
  openGraph: {
    title: "AI119 Web Magazine",
    description: "News, guides, and updates from AI119.",
    url: "https://ai119.netlify.app/blog",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Web Magazine" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI119 Web Magazine",
    description: "News, guides, and updates from AI119.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/blog",
  },
  robots: { index: true, follow: true },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
