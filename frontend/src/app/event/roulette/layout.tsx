import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TIGU Roulette Event — AI119",
  description:
    "Spin the TIGU roulette wheel and win 10~10,000 EXP for free. Scan the QR code from a TIGU promo video to join.",
  keywords: [
    "TIGU roulette",
    "TIGU bot event",
    "AI119 roulette event",
    "free EXP event",
    "QR code event",
  ],
  openGraph: {
    title: "TIGU Roulette Event — AI119",
    description: "Spin the TIGU roulette wheel and win 10~10,000 EXP for free.",
    url: "https://ai119.netlify.app/event/roulette",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimbot.png", width: 512, height: 512, alt: "TIGU Roulette Event" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TIGU Roulette Event — AI119",
    description: "Spin the TIGU roulette wheel and win 10~10,000 EXP for free.",
    images: ["/images/aimbot.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/event/roulette",
  },
  robots: { index: true, follow: true },
};

export default function RouletteEventLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
