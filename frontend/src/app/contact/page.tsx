"use client";

import Link from "next/link";
import { ArrowLeft, Mail, Send } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function ContactPage() {
  const { t } = useLanguage();
  const l = t.legal;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          {l.backHome}
        </Link>

        <h1 className="text-2xl font-bold mb-1">{l.contactTitle}</h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{l.contactSubtitle}</p>

        <div className="space-y-4">
          <a
            href="mailto:daguri75@gmail.com"
            className="flex items-center gap-4 rounded-xl border p-5 hover:border-violet-400 hover:shadow-sm transition-all"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/40">
              <Mail className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{l.contactEmailLabel}</p>
              <p className="font-semibold">daguri75@gmail.com</p>
            </div>
          </a>

          <a
            href="https://t.me/ai119link"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-xl border p-5 hover:border-emerald-400 hover:shadow-sm transition-all"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/40">
              <Send className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{l.contactCommunityLabel}</p>
              <p className="font-semibold">t.me/ai119link</p>
              <p className="text-xs text-muted-foreground mt-0.5">{l.contactCommunityDesc}</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
