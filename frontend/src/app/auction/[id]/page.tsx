import AuctionDetailClient from "./AuctionDetailClient";

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

export default async function AuctionDetailPage({ params }: Props) {
  const { id } = await params;
  return <AuctionDetailClient id={id} />;
}
