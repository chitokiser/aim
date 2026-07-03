import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { TelegramAutoLogin } from "@/components/telegram-auto-login";
import { DailyVisitTracker } from "@/components/daily-visit-tracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI119 — Earn TON Crypto with Missions, AI Content & Auctions",
  description: "Earn TON crypto on AI119: complete advertiser missions, trade AI-generated content, and bid in digital asset auctions. 광고주 미션·AI 창작물·디지털 자산 경매로 수익 창출.",
  metadataBase: new URL("https://ai119.netlify.app"),
  icons: {
    icon: "/images/favicon.png",
    apple: "/images/favicon.png",
  },
  verification: {
    google: "iSwGv7PBrGFOxh8LIKrKNegCUYW32fXo8EdbQby2Cg8",
    other: {
      "offerwall-verification": "c3c3afb250efdd9c",
    },
  },
  openGraph: {
    title: "AI119 — Earn TON Crypto with Missions, AI Content & Auctions",
    description: "Earn TON crypto on AI119: complete advertiser missions, trade AI content, and bid in digital asset auctions. 광고주 미션·AI 창작물·디지털 자산 경매.",
    url: "https://ai119.netlify.app",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI119 — Earn TON Crypto with Missions, AI Content & Auctions",
    description: "Complete advertiser missions, trade AI content, and bid in digital asset auctions to earn TON crypto.",
    images: ["/images/aimlogo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <Suspense>
            <TelegramAutoLogin />
          </Suspense>
          <DailyVisitTracker />
          <Navbar />
          <main>{children}</main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
