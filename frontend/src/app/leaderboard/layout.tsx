import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Top Earners Leaderboard — AI119",
  description:
    "See the top AP earners on AI119. Rankings updated in real time — compete in advertiser missions, AI content sales, and auctions to climb the leaderboard.",
  keywords: [
    "AI119 leaderboard",
    "top earners",
    "AP rankings",
    "earn TON leaderboard",
    "AimPoint rankings",
    "리더보드",
    "순위",
  ],
  openGraph: {
    title: "Top Earners Leaderboard — AI119",
    description:
      "Real-time rankings of the top AP earners on AI119. Complete missions and climb the leaderboard.",
    url: "https://ai119.netlify.app/leaderboard",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Leaderboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Top Earners Leaderboard — AI119",
    description:
      "Real-time AP rankings. Complete missions and auctions to climb to the top.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/leaderboard",
  },
  robots: { index: true, follow: true },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
