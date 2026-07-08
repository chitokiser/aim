"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "";

type ViewState = "loading" | "no-source" | "need-login" | "ready" | "already-spun";

interface SpinResult {
  exp: number;
  level: number;
  leveledUp: boolean;
}

function RouletteContent() {
  const searchParams = useSearchParams();
  const src = searchParams.get("src");
  const { token } = useAuthStore();
  const { t } = useLanguage();
  const r = t.rouletteEvent;

  const [view, setView] = useState<ViewState>("loading");
  const [pastExp, setPastExp] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);

  const authHeader = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token],
  );

  useEffect(() => {
    if (!src) {
      setView("no-source");
      return;
    }
    if (!token) {
      setView("need-login");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/roulette/status?code=${encodeURIComponent(src)}`, {
          headers: authHeader(),
        });
        if (cancelled) return;
        if (!res.ok) {
          setView("no-source");
          return;
        }
        const data: { eventLabel: string; alreadySpun: boolean; exp?: number } = await res.json();
        if (data.alreadySpun) {
          setPastExp(data.exp ?? null);
          setView("already-spun");
        } else {
          setView("ready");
        }
      } catch {
        if (!cancelled) setView("no-source");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, token, authHeader]);

  const handleSpin = async () => {
    if (!src || spinning) return;
    setSpinning(true);
    try {
      const res = await fetch(`${API}/api/roulette/spin`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ code: src }),
      });
      if (!res.ok) {
        setSpinning(false);
        if (res.status === 409) {
          setView("already-spun");
        } else {
          toast.error(r.errorGeneric);
        }
        return;
      }
      const data: SpinResult = await res.json();
      const extraTurns = 5 * 360;
      const landingOffset = Math.floor(Math.random() * 360);
      setRotation((prev) => prev + extraTurns + landingOffset);
      setTimeout(() => {
        setResult(data);
        setPastExp(data.exp);
        setSpinning(false);
      }, 3200);
    } catch {
      toast.error(r.errorGeneric);
      setSpinning(false);
    }
  };

  const telegramDeepLink = src ? `https://t.me/${BOT_USERNAME}?start=roulette_${src}` : "#";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-violet-950 via-purple-900 to-fuchsia-900 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-white/10 bg-white/5 backdrop-blur-sm text-white">
        <CardContent className="flex flex-col items-center gap-6 py-8 text-center">
          <Image
            src="/images/aimbot.png"
            alt="TIGU bot mascot"
            width={96}
            height={96}
            className="rounded-full ring-4 ring-fuchsia-400/50"
          />
          <div>
            <h1 className="text-2xl font-bold">{r.heroTitle}</h1>
            <p className="mt-1 text-sm text-white/70">{r.heroSubtitle}</p>
          </div>

          {view === "loading" && (
            <p className="text-sm text-white/60">{r.loadingStatus}</p>
          )}

          {view === "no-source" && (
            <>
              <p className="text-sm text-white/70">{r.noSourceDesc}</p>
              <a href="/" className={cn(buttonVariants({ variant: "secondary" }))}>
                {r.backHome}
              </a>
            </>
          )}

          {view === "need-login" && (
            <>
              <p className="text-sm text-white/70">{r.heroDesc}</p>
              <a
                href={telegramDeepLink}
                className={cn(buttonVariants({ size: "lg" }), "bg-fuchsia-500 hover:bg-fuchsia-400 text-white")}
              >
                {r.openInTelegram}
              </a>
            </>
          )}

          {(view === "ready" || (view === "already-spun" && spinning)) && (
            <div className="flex flex-col items-center gap-6">
              <div className="relative h-64 w-64">
                <div
                  className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 -translate-y-1"
                  style={{
                    borderLeft: "10px solid transparent",
                    borderRight: "10px solid transparent",
                    borderTop: "16px solid #facc15",
                  }}
                />
                <div
                  className="h-full w-full rounded-full border-4 border-white/20 shadow-[0_0_40px_rgba(217,70,239,0.4)]"
                  style={{
                    background:
                      "repeating-conic-gradient(#7c3aed 0deg 45deg, #db2777 45deg 90deg)",
                    transform: `rotate(${rotation}deg)`,
                    transition: spinning ? "transform 3.2s cubic-bezier(0.17,0.67,0.12,0.99)" : undefined,
                  }}
                />
                <div className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-sm font-bold text-fuchsia-700 shadow-lg">
                  TIGU
                </div>
              </div>
              <Button
                size="lg"
                disabled={spinning}
                onClick={handleSpin}
                className="bg-fuchsia-500 hover:bg-fuchsia-400 text-white px-10"
              >
                {spinning ? r.spinning : r.spinBtn}
              </Button>
            </div>
          )}

          {result && (
            <div className="rounded-lg bg-white/10 px-6 py-4">
              <p className="text-lg font-semibold text-fuchsia-200">{r.resultTitle}</p>
              <p className="mt-1 text-3xl font-bold">
                {r.resultWon} {result.exp.toLocaleString()} {r.resultExpUnit}
              </p>
              {result.leveledUp && (
                <p className="mt-1 text-sm text-yellow-300">
                  {r.resultLeveledUp.replace("{n}", String(result.level))}
                </p>
              )}
            </div>
          )}

          {view === "already-spun" && !spinning && !result && (
            <>
              <p className="text-sm font-medium text-white/90">{r.alreadySpunTitle}</p>
              {pastExp !== null && (
                <p className="text-sm text-white/70">
                  {r.alreadySpunDesc.replace("{n}", pastExp.toLocaleString())}
                </p>
              )}
              <a href="/" className={cn(buttonVariants({ variant: "secondary" }))}>
                {r.backHome}
              </a>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function RouletteEventPage() {
  return (
    <Suspense>
      <RouletteContent />
    </Suspense>
  );
}
