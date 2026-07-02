"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function TermsPage() {
  const { t } = useLanguage();
  const l = t.legal;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          {l.backHome}
        </Link>

        <h1 className="text-2xl font-bold mb-1">{l.termsTitle}</h1>
        <p className="text-sm text-muted-foreground mb-8">{l.termsUpdated}</p>

        <div className="space-y-6">
          {l.termsBody.map((section) => (
            <section key={section.h}>
              <h2 className="text-base font-semibold mb-1.5">{section.h}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{section.p}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
