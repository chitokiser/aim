"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "";
const SPIN_DURATION_MS = 3200;

type ViewState = "loading" | "no-source" | "need-login" | "ready" | "already-spun";

interface SpinResult {
  exp: number;
  level: number;
  leveledUp: boolean;
}

// Matches backend/src/roulette/roulette.service.ts PRIZE_TIERS — display only,
// the actual prize is always determined server-side.
const WHEEL_SEGMENTS = [
  { label: "10-100", color: "#7c3aed" },
  { label: "100-1K", color: "#a855f7" },
  { label: "1K-5K", color: "#c026d3" },
  { label: "5K-10K", color: "#db2777" },
  { label: "10-100", color: "#7c3aed" },
  { label: "100-1K", color: "#a855f7" },
  { label: "1K-5K", color: "#c026d3" },
  { label: "5K-10K", color: "#db2777" },
];
const SEGMENT_ANGLE = 360 / WHEEL_SEGMENTS.length;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeSegment(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 0 0 ${end.x} ${end.y} Z`;
}

type AudioContextWindow = Window & { webkitAudioContext?: typeof AudioContext };

function playTone(ctx: AudioContext, freq: number, duration: number, type: OscillatorType, gain: number) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

// Decelerating wheel sound: a pitch-dropping drone plus clicking ticks that
// slow down over the animation, like a physical wheel losing momentum.
function playSpinSound(ctx: AudioContext, durationSec: number) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(720, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + durationSec);
  gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.15);
  gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + durationSec);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationSec);

  let elapsed = 0;
  for (let i = 0; i < 26; i++) {
    elapsed += 45 + i * 10;
    if (elapsed > durationSec * 1000) break;
    setTimeout(() => playTone(ctx, 640, 0.045, "square", 0.12), elapsed);
  }
}

function playWinSound(ctx: AudioContext) {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    setTimeout(() => playTone(ctx, freq, 0.3, "sine", 0.2), i * 120);
  });
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
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as AudioContextWindow).webkitAudioContext;
      if (AudioContextClass) audioCtxRef.current = new AudioContextClass();
    }
    return audioCtxRef.current;
  }, []);

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
    // Create/resume the AudioContext synchronously within the click gesture —
    // browsers block audio started after an `await` gap without one.
    const ctx = getAudioCtx();
    if (ctx?.state === "suspended") void ctx.resume();
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
      if (ctx) playSpinSound(ctx, SPIN_DURATION_MS / 1000);
      const extraTurns = 5 * 360;
      const landingOffset = Math.floor(Math.random() * 360);
      setRotation((prev) => prev + extraTurns + landingOffset);
      setTimeout(() => {
        setResult(data);
        setPastExp(data.exp);
        setSpinning(false);
        setView("already-spun");
        if (ctx) playWinSound(ctx);
      }, SPIN_DURATION_MS);
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
              <p className="text-xs text-white/50">{r.newMemberNotice}</p>
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
                <svg
                  viewBox="0 0 200 200"
                  className="h-full w-full rounded-full border-4 border-white/20 shadow-[0_0_40px_rgba(217,70,239,0.4)]"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: spinning ? "transform 3.2s cubic-bezier(0.17,0.67,0.12,0.99)" : undefined,
                  }}
                >
                  {WHEEL_SEGMENTS.map((seg, i) => {
                    const startAngle = i * SEGMENT_ANGLE;
                    const endAngle = startAngle + SEGMENT_ANGLE;
                    const midAngle = startAngle + SEGMENT_ANGLE / 2;
                    const textPos = polarToCartesian(100, 100, 65, midAngle);
                    return (
                      <g key={i}>
                        <path
                          d={describeSegment(100, 100, 96, startAngle, endAngle)}
                          fill={seg.color}
                          stroke="#1e1b3a"
                          strokeWidth="1"
                        />
                        <text
                          x={textPos.x}
                          y={textPos.y}
                          fill="white"
                          fontSize="11"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${midAngle}, ${textPos.x}, ${textPos.y})`}
                        >
                          {seg.label}
                        </text>
                      </g>
                    );
                  })}
                  <circle cx="100" cy="100" r="28" fill="white" />
                  <text
                    x="100"
                    y="100"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="15"
                    fontWeight="bold"
                    fill="#a21caf"
                  >
                    TIGU
                  </text>
                </svg>
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

      <Dialog open={!!result} onOpenChange={(open) => { if (!open) setResult(null); }}>
        <DialogContent
          showCloseButton={false}
          className="max-w-xs border-none bg-gradient-to-b from-fuchsia-600 to-violet-700 text-white text-center py-8"
        >
          <DialogTitle className="text-lg font-semibold text-fuchsia-100">
            🎉 {r.resultTitle}
          </DialogTitle>
          {result && (
            <>
              <p className="text-sm text-white/80">{r.resultWon}</p>
              <p className="text-5xl font-black tracking-tight drop-shadow-lg">
                {result.exp.toLocaleString()}
                <span className="ml-1 text-2xl font-bold">{r.resultExpUnit}</span>
              </p>
              {result.leveledUp && (
                <p className="text-sm text-yellow-300">
                  {r.resultLeveledUp.replace("{n}", String(result.level))}
                </p>
              )}
              <Link
                href="/shop"
                onClick={() => setResult(null)}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "mt-2 w-full bg-white text-fuchsia-700 hover:bg-white/90",
                )}
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                {r.shopCta}
              </Link>
            </>
          )}
        </DialogContent>
      </Dialog>
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
