import type { Metadata } from "next";
import AuctionDetailClient from "./AuctionDetailClient";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "https://ai119-bot-production.up.railway.app"}/api`;

export async function generateStaticParams() {
  try {
    const res = await fetch(`${API}/auction`, { cache: "no-store" });
    if (!res.ok) return [{ id: "_" }];
    const auctions: { id: string }[] = await res.json();
    const ids = auctions.map((a) => ({ id: String(a.id) }));
    return ids.length > 0 ? ids : [{ id: "_" }];
  } catch {
    return [{ id: "_" }];
  }
}

interface AuctionSeo {
  title: string;
  description?: string;
  thumbnailUrl?: string;
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(`${API}/auction/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error("not found");
    const auction: AuctionSeo = await res.json();

    const title = `${auction.title} | AI119 Auction`;
    const description = (auction.description || `Bid on "${auction.title}" — a digital asset auction on AI119.`).slice(0, 160);
    const image = auction.thumbnailUrl || "/images/aimlogo.png";
    const url = `https://ai119.netlify.app/auction/${id}`;

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: { title, description, url, siteName: "AI119", type: "website", images: [{ url: image }] },
      twitter: { card: "summary_large_image", title, description, images: [image] },
      robots: { index: true, follow: true },
    };
  } catch {
    return { title: "Auction | AI119" };
  }
}

export default async function AuctionDetailPage({ params }: Props) {
  const { id } = await params;
  return <AuctionDetailClient id={id} />;
}
