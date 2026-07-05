"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Music, Download, Loader2, Coins, CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import Link from "next/link";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://ai119-bot-production.up.railway.app";

const GEN_COST_AP = 50;
const GEN_COST_P = 50;
const POLL_INTERVAL_MS = 4000;

type Step = "idle" | "step1" | "step2" | "done";

interface MurekaResult {
  audioUrls: string[];
  duration?: number;
}

export default function MusicGenPage() {
  const { t } = useLanguage();
  const mg = t.musicGen;
  const { user, token, setUser } = useAuthStore();

  const [lyrics, setLyrics] = useState("");
  const [prompt, setPrompt] = useState("");
  const [currency, setCurrency] = useState<"ap" | "p">("p");
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<MurekaResult | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isGenerating = step !== "idle" && step !== "done";

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const refreshBalance = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as typeof user;
        if (data) setUser(data);
      }
    } catch { /* ignore */ }
  };

  const pollStatus = useCallback((jobId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/music-gen/status/${jobId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.status === 404) {
          // Job no longer exists (e.g. lost across a backend restart) — stop
          // polling instead of hanging on step1/step2 forever with no feedback.
          stopPolling();
          setStep("idle");
          toast.error(mg.toastError);
          return;
        }
        if (!res.ok) return;

        const data = await res.json() as {
          status: string;
          step: number;
          result?: MurekaResult;
          error?: string;
        };

        if (data.step === 1) setStep("step1");
        else if (data.step === 2) setStep("step2");

        if (data.status === "done" && data.result) {
          stopPolling();
          setResult(data.result);
          setStep("done");
          toast.success(mg.toastSuccess);
          await refreshBalance();
        } else if (data.status === "error") {
          stopPolling();
          setStep("idle");
          toast.error(mg.toastRefunded);
          await refreshBalance();
        }
      } catch {
        // network blip — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [token, mg.toastSuccess, mg.toastError]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    if (!lyrics.trim() && !prompt.trim()) {
      toast.error(mg.toastNoInput);
      return;
    }

    if (currency === "ap" && (user?.points ?? 0) < GEN_COST_AP) {
      toast.error(mg.toastInsufficientAp);
      return;
    }
    if (currency === "p" && (user?.freePoints ?? 0) < GEN_COST_P) {
      toast.error(mg.toastInsufficientP);
      return;
    }

    stopPolling();
    setResult(null);
    setStep("step1");

    try {
      const res = await fetch(`${API}/api/music-gen/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lyrics, prompt, currency }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? `Error ${res.status}`);
      }

      const { jobId } = await res.json() as { jobId: string };
      pollStatus(jobId);
    } catch (e) {
      stopPolling();
      setStep("idle");
      toast.error(e instanceof Error ? e.message : mg.toastError);
    }
  };

  const stepLabels: Record<"step1" | "step2", string> = {
    step1: mg.step1,
    step2: mg.step2,
  };

  if (!user) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-20 flex flex-col items-center text-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-600 shadow-lg">
          <Music className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-black">{mg.title}</h1>
        <p className="text-muted-foreground max-w-sm">{mg.loginRequired}</p>
        <Link href="/auth">
          <Button className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90 px-8">
            {mg.goToLogin}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-600 shadow">
            <Music className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">{mg.title}</h1>
            <p className="text-sm text-muted-foreground">{mg.subtitle}</p>
          </div>
        </div>
        <p className="text-muted-foreground mt-1">{mg.desc}</p>
      </div>

      {/* Currency selector */}
      <div className="rounded-xl border bg-gradient-to-r from-violet-50/60 to-cyan-50/60 dark:from-violet-950/20 dark:to-cyan-950/20 p-4 mb-6 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Coins className="h-4 w-4 text-violet-600" />
          {mg.costTitle}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setCurrency("p")}
            className={cn(
              "flex-1 min-w-[160px] rounded-lg border-2 px-4 py-3 text-left transition-colors",
              currency === "p"
                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                : "border-border hover:border-violet-300"
            )}
          >
            <p className="text-sm font-semibold">{mg.currencyP}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{mg.costP}</p>
            <p className="text-xs font-mono text-violet-700 dark:text-violet-400 mt-1">
              {mg.balanceP}: {(user.freePoints ?? 0).toLocaleString()} P
            </p>
          </button>
          <button
            onClick={() => setCurrency("ap")}
            className={cn(
              "flex-1 min-w-[160px] rounded-lg border-2 px-4 py-3 text-left transition-colors",
              currency === "ap"
                ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30"
                : "border-border hover:border-cyan-300"
            )}
          >
            <p className="text-sm font-semibold">{mg.currencyAp}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{mg.costAp}</p>
            <p className="text-xs font-mono text-cyan-700 dark:text-cyan-400 mt-1">
              {mg.balanceAp}: {(user.points ?? 0).toLocaleString()} AP
            </p>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Lyrics */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">{mg.lyricsLabel}</Label>
          <Textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder={mg.lyricsPlaceholder}
            rows={6}
            className="resize-none font-medium"
          />
        </div>

        {/* Style prompt */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">{mg.promptLabel}</Label>
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={mg.promptPlaceholder}
            className="font-medium"
          />
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || (!lyrics.trim() && !prompt.trim())}
          className="w-full h-12 text-base bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90 shadow-md"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {mg.generatingBtn}
            </>
          ) : (
            <>
              <Music className="h-5 w-5 mr-2" />
              {mg.generateBtn}
              <span className="ml-2 text-xs opacity-80">
                ({currency === "ap" ? `${GEN_COST_AP.toLocaleString()} AP` : `${GEN_COST_P.toLocaleString()} P`})
              </span>
            </>
          )}
        </Button>

        {/* Progress steps */}
        {isGenerating && (
          <div className="rounded-xl border bg-muted/30 p-5 space-y-3">
            {(["step1", "step2"] as const).map((s, idx) => {
              const stepNum = idx + 1;
              const currentStepNum = step === "step1" ? 1 : 2;
              const isDone = stepNum < currentStepNum;
              const isActive = stepNum === currentStepNum;
              return (
                <div key={s} className={cn("flex items-center gap-3 text-sm",
                  isDone ? "text-muted-foreground" : isActive ? "text-foreground font-medium" : "text-muted-foreground/40"
                )}>
                  <div className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    isDone ? "bg-green-500 text-white" : isActive ? "bg-violet-500 text-white animate-pulse" : "bg-muted text-muted-foreground"
                  )}>
                    {isDone ? "✓" : stepNum}
                  </div>
                  {stepLabels[s]}
                </div>
              );
            })}
          </div>
        )}

        {/* Results */}
        {step === "done" && result && result.audioUrls.length > 0 && (
          <div className="rounded-xl border bg-gradient-to-r from-violet-50 to-cyan-50 dark:from-violet-950/20 dark:to-cyan-950/20 p-5 space-y-4">
            <p className="text-sm font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {mg.resultTitle}
            </p>
            {result.audioUrls.map((url, i) => (
              <div key={i} className="space-y-2 rounded-lg border bg-background/70 p-3">
                <p className="text-xs font-medium text-muted-foreground">Track {i + 1}</p>
                <audio
                  src={url}
                  controls
                  className="w-full"
                />
                <a
                  href={url}
                  download={`mureka-track-${i + 1}.mp3`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-violet-300 dark:border-violet-700 px-3 py-1.5 text-sm font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  {mg.downloadBtn}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
