import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Music Video Generator — AI119",
  description:
    "Create AI-generated music videos on AI119. Turn your lyrics, photos, or a theme into a full music video — join Section 3 content contests and earn AP rewards.",
  keywords: [
    "AI music video generator",
    "AI 뮤직비디오",
    "AI 음악 영상 생성",
    "music video maker",
    "AI119 music video",
    "AI content creation",
  ],
  openGraph: {
    title: "AI Music Video Generator — AI119",
    description:
      "Turn lyrics, photos, or a theme into a full AI-generated music video on AI119.",
    url: "https://ai119.netlify.app/music-video",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Music Video Generator" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Music Video Generator — AI119",
    description: "Turn lyrics, photos, or a theme into a full AI-generated music video.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/music-video",
  },
  robots: { index: true, follow: true },
};

export default function MusicVideoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
