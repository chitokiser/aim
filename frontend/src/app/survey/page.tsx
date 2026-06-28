"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { CheckCircle, ChevronRight, ClipboardList } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface WidgetConfig {
  appId: string;
  secureHash: string;
  userId: string;
}

export default function SurveyPage() {
  const { t } = useLanguage();
  const s = t.survey;
  const { user, token } = useAuthStore();

  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void fetch(`${API}/api/cpx/widget-config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: WidgetConfig) => setConfig(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const iframeUrl = config
    ? `https://offers.cpx-research.com/index.php?app_id=${config.appId}&ext_user_id=${config.userId}&secure_hash=${config.secureHash}`
    : null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-md">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">{s.pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{s.pageSubtitle}</p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="mb-8 rounded-2xl border bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-5">
        <h2 className="font-bold text-sm text-green-800 dark:text-green-300 mb-3">{s.howTitle}</h2>
        <ol className="space-y-2">
          {[s.how1, s.how2, s.how3].map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronRight className="h-3.5 w-3.5" />
          <span>{s.earning} <strong>50,000</strong> {s.earningUnit}</span>
        </div>
      </div>

      {/* Survey widget or login prompt */}
      {loading ? (
        <div className="flex items-center justify-center h-96 text-muted-foreground text-sm">
          {s.loadingWidget}
        </div>
      ) : !user || !token ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <p className="text-muted-foreground">{s.loginRequired}</p>
          <a
            href="/auth"
            className={buttonVariants({ variant: "default" }) + " bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"}
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
            title="CPX Research Surveys"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          {s.noSurveys}
        </div>
      )}
    </div>
  );
}
