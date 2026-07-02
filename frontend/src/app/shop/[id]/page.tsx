import ShopDetailClient from "./ShopDetailClient";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "https://ai119-bot-production.up.railway.app"}/api`;

export async function generateStaticParams() {
  try {
    const res = await fetch(`${API}/cj-shop/products`, { cache: "no-store" });
    if (!res.ok) return [{ id: "_" }];
    const products: { id: string }[] = await res.json();
    const ids = products.map((p) => ({ id: String(p.id) }));
    return ids.length > 0 ? ids : [{ id: "_" }];
  } catch {
    return [{ id: "_" }];
  }
}

type Props = { params: Promise<{ id: string }> };

export default async function ShopDetailPage({ params }: Props) {
  const { id } = await params;
  return <ShopDetailClient id={id} />;
}
