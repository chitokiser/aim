import type { Metadata, Viewport } from "next";
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
  title: "AI119 — Content Marketing & AI Creator Rewards",
  description: "Complete real advertiser marketing campaigns, trade AI-generated content, and bid in digital asset auctions to earn reward points redeemable for TON.",
  metadataBase: new URL("https://ai119.netlify.app"),
  icons: {
    icon: "/images/favicon.png",
    apple: "/images/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    title: "AI119",
    statusBarStyle: "black-translucent",
  },
  verification: {
    google: "iSwGv7PBrGFOxh8LIKrKNegCUYW32fXo8EdbQby2Cg8",
    other: {
      "offerwall-verification": "c3c3afb250efdd9c",
      "impact-site-verification": "60ec0825-0376-47d9-8e04-54fcbf6338f8",
    },
  },
  openGraph: {
    title: "AI119 — Content Marketing & AI Creator Rewards",
    description: "Complete real advertiser marketing campaigns, trade AI-generated content, and bid in digital asset auctions to earn reward points redeemable for TON.",
    url: "https://ai119.netlify.app",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI119 — Content Marketing & AI Creator Rewards",
    description: "Complete real advertiser marketing campaigns, trade AI creations, and bid in digital asset auctions to earn reward points redeemable for TON.",
    images: ["/images/aimlogo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8673715186885112"
          crossOrigin="anonymous"
        />
      </head>
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
