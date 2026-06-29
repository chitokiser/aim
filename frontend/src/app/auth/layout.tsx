import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — AI119",
  description:
    "Sign in to AI119 with your Telegram account or Google. Access advertiser missions, the creative market, digital asset auctions, and earn AimPoints (AP).",
  openGraph: {
    title: "Sign In — AI119",
    description:
      "Sign in to AI119 and start earning AimPoints through missions, auctions, and AI content creation.",
    url: "https://ai119.netlify.app/auth",
    siteName: "AI119",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
