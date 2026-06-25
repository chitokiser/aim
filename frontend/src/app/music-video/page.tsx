"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Film, Download, Loader2, Coins, Lock, Upload, CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import Link from "next/link";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://ai119-bot-production.up.railway.app";

const MV_COST_AP = 1000;
const MV_COST_P = 10000;

type Step = "idle" | "step1" | "step2" | "step3" | "done";

export default function MusicVideoPage() {
  const { t } = useLanguage();
  const mv = t.musicVideo;
  const { user, token, setUser } = useAuthStore();

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [currency, setCurrency] = useState<"ap" | "p">("p");
  const [step, setStep] = useState<Step>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGenerating = step !== "idle" && step !== "done";

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAudioFile(file);
  };

  const handleGenerate = async () => {
    if (!audioFile) { toast.error(mv.toastNoFile); return; }
    if (!text.trim()) { toast.error(mv.toastNoText); return; }

    if (currency === "ap" && (user?.points ?? 0) < MV_COST_AP) {
      toast.error(mv.toastInsufficientAp);
      return;
    }
    if (currency === "p" && (user?.freePoints ?? 0) < MV_COST_P) {
      toast.error(mv.toastInsufficientP);
      return;
    }

    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null); }

    setStep("step1");

    try {
      const formData = new FormData();
      formData.append("audio", audioFile);
      formData.append("text", text);
      formData.append("currency", currency);

      // Simulate step progression during the long request
      const stepTimer1 = setTimeout(() => setStep("step2"), 8000);
      const stepTimer2 = setTimeout(() => setStep("step3"), 25000);

      const res = await fetch(`${API}/api/music-video/generate`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? `Error ${res.status}`);
      }

      const blob = await res.blob();
      setVideoUrl(URL.createObjectURL(blob));
      setStep("done");
      toast.success(mv.toastSuccess);
      await refreshBalance();
    } catch (e) {
      setStep("idle");
      toast.error(e instanceof Error ? e.message : mv.toastError);
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "music-video.mp4";
    a.click();
  };

  const stepLabels: Record<Exclude<Step, "idle" | "done">, string> = {
    step1: mv.step1,
    step2: mv.step2,
    step3: mv.step3,
  };

  if (!user) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-20 flex flex-col items-center text-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-violet-600 shadow-lg">
          <Film className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-black">{mv.title}</h1>
        <p className="text-muted-foreground max-w-sm">{mv.loginRequired}</p>
        <Link href="/auth">
          <Button className="bg-gradient-to-r from-pink-600 to-violet-500 text-white hover:opacity-90 px-8">
            {mv.goToLogin}
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-violet-600 shadow">
            <Film className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">{mv.title}</h1>
            <p className="text-sm text-muted-foreground">{mv.subtitle}</p>
          </div>
        </div>
        <p className="text-muted-foreground mt-1">{mv.desc}</p>
      </div>

      {/* Currency selector */}
      <div className="rounded-xl border bg-gradient-to-r from-pink-50/60 to-violet-50/60 dark:from-pink-950/20 dark:to-violet-950/20 p-4 mb-6 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Coins className="h-4 w-4 text-pink-600" />
          {mv.costTitle}
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
            <p className="text-sm font-semibold">{mv.currencyP}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{mv.costP}</p>
            <p className="text-xs font-mono text-violet-700 dark:text-violet-400 mt-1">
              {mv.balanceP}: {(user.freePoints ?? 0).toLocaleString()} P
            </p>
          </button>
          <button
            onClick={() => setCurrency("ap")}
            className={cn(
              "flex-1 min-w-[160px] rounded-lg border-2 px-4 py-3 text-left transition-colors",
              currency === "ap"
                ? "border-pink-500 bg-pink-50 dark:bg-pink-950/30"
                : "border-border hover:border-pink-300"
            )}
          >
            <p className="text-sm font-semibold">{mv.currencyAp}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{mv.costAp}</p>
            <p className="text-xs font-mono text-pink-700 dark:text-pink-400 mt-1">
              {mv.balanceAp}: {(user.points ?? 0).toLocaleString()} AP
            </p>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* MP3 Upload */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">{mv.audioLabel}</Label>
          <p className="text-xs text-muted-foreground">{mv.audioHint}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,.mp3"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "w-full rounded-lg border-2 border-dashed px-4 py-8 transition-colors flex flex-col items-center gap-2",
              audioFile
                ? "border-pink-400 bg-pink-50/50 dark:bg-pink-950/20"
                : "border-border hover:border-pink-300 hover:bg-muted/30"
            )}
          >
            {audioFile ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-pink-500" />
                <span className="text-sm font-medium text-pink-700 dark:text-pink-400">
                  {mv.audioSelected}: {audioFile.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Click to select MP3</span>
              </>
            )}
          </button>
        </div>

        {/* Text / Lyrics */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">{mv.textLabel}</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mv.textPlaceholder}
            rows={8}
            className="resize-none font-medium"
          />
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !audioFile || !text.trim()}
          className="w-full h-12 text-base bg-gradient-to-r from-pink-600 to-violet-500 text-white hover:opacity-90 shadow-md"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {mv.generatingBtn}
            </>
          ) : (
            <>
              <Film className="h-5 w-5 mr-2" />
              {mv.generateBtn}
              <span className="ml-2 text-xs opacity-80">
                ({currency === "ap" ? `${MV_COST_AP.toLocaleString()} AP` : `${MV_COST_P.toLocaleString()} P`})
              </span>
            </>
          )}
        </Button>

        {/* Progress steps */}
        {isGenerating && (
          <div className="rounded-xl border bg-muted/30 p-5 space-y-3">
            {(["step1", "step2", "step3"] as const).map((s, idx) => {
              const stepNum = idx + 1;
              const currentStepNum = step === "step1" ? 1 : step === "step2" ? 2 : 3;
              const isDone = stepNum < currentStepNum;
              const isActive = stepNum === currentStepNum;
              return (
                <div key={s} className={cn("flex items-center gap-3 text-sm", isDone ? "text-muted-foreground" : isActive ? "text-foreground font-medium" : "text-muted-foreground/40")}>
                  <div className={cn("h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    isDone ? "bg-green-500 text-white" : isActive ? "bg-pink-500 text-white animate-pulse" : "bg-muted text-muted-foreground"
                  )}>
                    {isDone ? "✓" : stepNum}
                  </div>
                  {stepLabels[s]}
                </div>
              );
            })}
          </div>
        )}

        {/* Result */}
        {step === "done" && videoUrl && (
          <div className="rounded-xl border bg-gradient-to-r from-pink-50 to-violet-50 dark:from-pink-950/20 dark:to-violet-950/20 p-5 space-y-4">
            <p className="text-sm font-semibold text-pink-700 dark:text-pink-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {mv.resultTitle}
            </p>
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg"
              style={{ maxHeight: 360 }}
            />
            <Button
              onClick={handleDownload}
              variant="outline"
              className="w-full h-11 border-pink-300 dark:border-pink-700 text-pink-700 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-pink-950/30"
            >
              <Download className="h-4 w-4 mr-2" />
              {mv.downloadBtn}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
