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

type Props = { params: Promise<{ id: string }> };

export default async function AuctionDetailPage({ params }: Props) {
  const { id } = await params;
  return <AuctionDetailClient id={id} />;
}
