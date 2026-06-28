"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { CheckCircle, ChevronRight, Gift } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface WidgetConfig {
  apiKey: string;
  userId: string;
}

export default function OfferwallPage() {
  const { t } = useLanguage();
  const s = t.offerwall;
  const { user, token } = useAuthStore();

  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void fetch(`${API}/api/offerwall/widget-config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: WidgetConfig) => setConfig(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const iframeUrl = config
    ? `https://offerwall.me/offerwall/${config.apiKey}/${config.userId}`
    : null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-md">
            <Gift className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">{s.pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{s.pageSubtitle}</p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="mb-8 rounded-2xl border bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-5">
        <h2 className="font-bold text-sm text-purple-800 dark:text-purple-300 mb-3">{s.howTitle}</h2>
        <ol className="space-y-2">
          {[s.how1, s.how2, s.how3].map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-purple-700 dark:text-purple-400">
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronRight className="h-3.5 w-3.5" />
          <span>{s.earning}</span>
        </div>
      </div>

      {/* Offerwall widget or login prompt */}
      {loading ? (
        <div className="flex items-center justify-center h-96 text-muted-foreground text-sm">
          {s.loadingWidget}
        </div>
      ) : !user || !token ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <p className="text-muted-foreground">{s.loginRequired}</p>
          <a
            href="/auth"
            className={buttonVariants({ variant: "default" }) + " bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:opacity-90"}
          >
            {s.loginBtn}
          </a>
        </div>
      ) : iframeUrl ? (
        <div className="rounded-2xl overflow-hidden border shadow-sm">
          <iframe
            src={iframeUrl}
            className="w-full"
            style={{ height: "700px", border: "none" }}
            title="Offerwall.me Offers"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          {s.noOffers}
        </div>
      )}
    </div>
  );
}
