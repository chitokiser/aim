import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Music Generator — Create Songs on AI119",
  description:
    "Generate original AI music on AI119. Create full songs, background music, and AI-composed tracks using text prompts — powered by Suno AI. Free credits for members.",
  keywords: [
    "AI music generator",
    "generate music with AI",
    "AI song creator",
    "Suno AI music",
    "AI119 music",
    "AI 음악 생성",
    "AI 작곡",
    "text to music",
  ],
  openGraph: {
    title: "AI Music Generator — Create Songs on AI119",
    description:
      "Generate original AI songs from text prompts. Create background music and full tracks with Suno AI on AI119.",
    url: "https://ai119.netlify.app/music-gen",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Music Generator" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Music Generator — Create Songs on AI119",
    description:
      "Generate original AI songs from text prompts. Background music and full tracks.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/music-gen",
  },
  robots: { index: true, follow: true },
};

export default function MusicGenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
