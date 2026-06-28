import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offerwall — AI119",
  description:
    "Complete app installs, sign-ups, and tasks to earn AimPoints instantly on AI119.",
};

export default function OfferwallLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
