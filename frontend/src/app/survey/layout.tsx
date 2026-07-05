import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paid Surveys (CPX Research) — AI119",
  description:
    "Complete short online surveys on AI119 through CPX Research and earn AimPoints (AP), redeemable as TON crypto. Region-targeted surveys, instant rewards.",
  keywords: [
    "paid surveys",
    "CPX Research",
    "survey rewards",
    "설문조사 보상",
    "온라인 설문",
    "AI119 survey",
  ],
  openGraph: {
    title: "Paid Surveys (CPX Research) — AI119",
    description:
      "Complete short online surveys and earn AimPoints (AP), redeemable as TON crypto.",
    url: "https://ai119.netlify.app/survey",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119 Surveys" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Paid Surveys (CPX Research) — AI119",
    description: "Complete short online surveys and earn AP, redeemable as TON crypto.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/survey",
  },
  robots: { index: true, follow: true },
};

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
