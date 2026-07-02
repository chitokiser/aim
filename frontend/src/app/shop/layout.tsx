import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop — Buy with AP | AI119",
  description:
    "Browse the AI119 shop and buy real products using your AP points. Earn AP through missions, then redeem it for products shipped to your door.",
  keywords: ["AI119 shop", "AI119 쇼핑몰", "AP 포인트 쇼핑", "cửa hàng AI119"],
  openGraph: {
    title: "AI119 Shop",
    description: "Buy real products with AP points earned on AI119.",
    url: "https://ai119.netlify.app/shop",
    siteName: "AI119",
    type: "website",
    images: [{ url: "/images/aimlogo.png", width: 512, height: 512, alt: "AI119" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI119 Shop",
    description: "Buy real products with AP points earned on AI119.",
    images: ["/images/aimlogo.png"],
  },
  alternates: {
    canonical: "https://ai119.netlify.app/shop",
  },
  robots: { index: true, follow: true },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
