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
  title: "AI119 — AI Marketing Platform",
  description: "AI 창작물로 수익을 창출하는 마케팅 플랫폼. Create AI content, earn AimPoints, get rewarded.",
  metadataBase: new URL("https://ai119.netlify.app"),
  icons: {
    icon: "/images/favicon.png",
    apple: "/images/favicon.png",
  },
  verification: {
    google: "iSwGv7PBrGFOxh8LIKrKNegCUYW32fXo8EdbQby2Cg8",
  },
  openGraph: {
    title: "AI119 — AI Marketing Platform",
    description: "AI 창작물로 수익을 창출하는 마케팅 플랫폼. Create AI content, earn AimPoints, get rewarded.",
    url: "https://ai119.netlify.app",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI119 — AI Marketing Platform",
    description: "AI 창작물로 수익을 창출하는 마케팅 플랫폼.",
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
