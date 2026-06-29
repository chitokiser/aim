import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { TelegramAutoLogin } from "@/components/telegram-auto-login";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI119 — Revenue Platform",
  description: "광고주 미션, AI 창작물 거래, 디지털 자산 거래 등으로 수익을 창출하는 플랫폼. Earn TON coins through advertiser missions, AI content trading & digital asset auctions.",
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
    title: "AI119 — Revenue Platform",
    description: "광고주 미션, AI 창작물 거래, 디지털 자산 거래 등으로 수익을 창출하는 플랫폼. Earn TON coins through advertiser missions, AI content trading & digital asset auctions.",
    url: "https://ai119.netlify.app",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI119 — Revenue Platform",
    description: "광고주 미션, AI 창작물 거래, 디지털 자산 거래 등으로 수익을 창출하는 플랫폼.",
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
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <Suspense>
            <TelegramAutoLogin />
          </Suspense>
          <Navbar />
          <main>{children}</main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
