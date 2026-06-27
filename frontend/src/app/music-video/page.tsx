"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Film, Download, Loader2, Coins, Upload, CheckCircle2, ImagePlus, X,
  ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import Link from "next/link";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://ai119-bot-production.up.railway.app";

const MV_COST_AP = 50;
const MV_COST_P = 50;
const POLL_INTERVAL_MS = 4000;

type Step = "idle" | "step1" | "step2" | "step3" | "done";
type Mood = "natural" | "dreamy" | "cinematic" | "warm" | "cool" | "dark" | "ethereal";
type PanSpeed = "slow" | "normal" | "fast";

export default function MusicVideoPage() {
  const { t } = useLanguage();
  const mv = t.musicVideo;
  const { user, token, setUser } = useAuthStore();

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [currency, setCurrency] = useState<"ap" | "p">("p");
  const [ratio, setRatio] = useState<"16:9" | "9:16">("16:9");
  const [showEffects, setShowEffects] = useState(false);
  const [mood, setMood] = useState<Mood>("natural");
  const [glowIntensity, setGlowIntensity] = useState(0);
  const [vignette, setVignette] = useState(false);
  const [panSpeed, setPanSpeed] = useState<PanSpeed>("normal");
  const [step, setStep] = useState<Step>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [hasThumbnail, setHasThumbnail] = useState(false);
  const [jobIdRef, setJobIdRef] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);
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

  const downloadVideo = useCallback(async (jobId: string) => {
    const res = await fetch(`${API}/api/music-video/download/${jobId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(blob));
    setStep("done");
    toast.success(mv.toastSuccess);
    await refreshBalance();
  }, [token, videoUrl, mv.toastSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const pollStatus = useCallback((jobId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/music-video/status/${jobId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;

        const data = await res.json() as { status: string; step: number; hasThumbnail?: boolean; error?: string };

        if (data.step === 1) setStep("step1");
        else if (data.step === 2) setStep("step2");
        else if (data.step === 3) setStep("step3");

        if (data.status === "done") {
          stopPolling();
          if (data.hasThumbnail) setHasThumbnail(true);
          await downloadVideo(jobId);
        } else if (data.status === "error") {
          stopPolling();
          setStep("idle");
          toast.error(data.error ?? mv.toastError);
        }
      } catch {
        // network blip — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [token, downloadVideo, mv.toastError]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      setAudioFile(file);
      setAudioPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    const merged = [...imageFiles, ...selected].slice(0, 12);
    if (imageFiles.length + selected.length > 12) {
      toast.error(mv.imagesTooMany);
    }
    const previews = merged.map((f) => URL.createObjectURL(f));
    imagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setImageFiles(merged);
    setImagePreviews(previews);
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
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

    stopPolling();
    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null); }
    setHasThumbnail(false);
    setJobIdRef(null);
    setStep("step1");

    try {
      const formData = new FormData();
      formData.append("audio", audioFile);
      formData.append("text", text);
      if (title.trim()) formData.append("title", title.trim());
      formData.append("ratio", ratio);
      formData.append("currency", currency);
      formData.append("mood", mood);
      formData.append("glowIntensity", String(glowIntensity));
      formData.append("vignette", String(vignette));
      formData.append("panSpeed", panSpeed);
      imageFiles.forEach((img) => formData.append("images", img));

      const res = await fetch(`${API}/api/music-video/generate`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? `Error ${res.status}`);
      }

      const { jobId } = await res.json() as { jobId: string };
      setJobIdRef(jobId);
      pollStatus(jobId);
    } catch (e) {
      stopPolling();
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

  const handleThumbnailDownload = async () => {
    if (!jobIdRef) return;
    try {
      const res = await fetch(`${API}/api/music-video/thumbnail/${jobIdRef}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "thumbnail.jpg";
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
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
        {/* Audio Upload */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">{mv.audioLabel}</Label>
          <p className="text-xs text-muted-foreground">{mv.audioHint}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,.mp3,audio/wav,.wav,audio/x-wav"
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
          {audioPreviewUrl && (
            <audio
              src={audioPreviewUrl}
              controls
              autoPlay
              className="w-full mt-2"
            />
          )}
        </div>

        {/* YouTube Title */}
        <div className="space-y-2">
          <Label className="text-base font-semibold flex items-center gap-2">
            {mv.titleLabel}
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
              YouTube
            </span>
          </Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={mv.titlePlaceholder}
            maxLength={80}
            className="font-medium"
          />
          <p className="text-xs text-muted-foreground">{mv.titleHint}</p>
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">{mv.ratioLabel}</Label>
          <div className="flex gap-3">
            <button
              onClick={() => setRatio("16:9")}
              className={cn(
                "flex-1 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                ratio === "16:9"
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                  : "border-border hover:border-violet-300"
              )}
            >
              <p className="text-sm font-semibold">⬛ {mv.ratio16_9}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{mv.ratioHint16_9}</p>
            </button>
            <button
              onClick={() => setRatio("9:16")}
              className={cn(
                "flex-1 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                ratio === "9:16"
                  ? "border-pink-500 bg-pink-50 dark:bg-pink-950/30"
                  : "border-border hover:border-pink-300"
              )}
            >
              <p className="text-sm font-semibold">📱 {mv.ratio9_16}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{mv.ratioHint9_16}</p>
            </button>
          </div>
        </div>

        {/* Panel Background Images */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">{mv.imagesLabel}</Label>
          <p className="text-xs text-muted-foreground">{mv.imagesHint}</p>
          <input
            ref={imagesInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImagesChange}
            className="hidden"
          />
          <button
            onClick={() => imagesInputRef.current?.click()}
            disabled={imageFiles.length >= 12}
            className={cn(
              "w-full rounded-lg border-2 border-dashed px-4 py-5 transition-colors flex items-center justify-center gap-2",
              imageFiles.length >= 12
                ? "border-border opacity-50 cursor-not-allowed"
                : "border-border hover:border-violet-300 hover:bg-muted/30"
            )}
          >
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {imageFiles.length > 0
                ? `${imageFiles.length} ${mv.imagesSelected}`
                : `+ ${mv.imagesLabel}`}
            </span>
            <span className="text-xs text-muted-foreground ml-1">({imageFiles.length}/12)</span>
          </button>
          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {imagePreviews.map((src, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden aspect-square border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`panel ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                  <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] text-white bg-black/40 py-0.5">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
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

        {/* Visual Effects */}
        <div className="rounded-xl border overflow-hidden">
          <button
            onClick={() => setShowEffects(!showEffects)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-50/80 to-pink-50/80 dark:from-violet-950/30 dark:to-pink-950/30 hover:opacity-90 transition-opacity"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-violet-500" />
              {mv.effectsTitle}
            </span>
            {showEffects
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </button>

          {showEffects && (
            <div className="px-4 py-4 space-y-5 border-t">
              {/* Mood presets */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{mv.moodLabel}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { key: "natural",   emoji: "🌿" },
                      { key: "dreamy",    emoji: "🌸" },
                      { key: "cinematic", emoji: "🎬" },
                      { key: "warm",      emoji: "🌅" },
                      { key: "cool",      emoji: "❄️" },
                      { key: "dark",      emoji: "🌑" },
                      { key: "ethereal",  emoji: "✨" },
                    ] as { key: Mood; emoji: string }[]
                  ).map(({ key, emoji }) => {
                    const label = mv[`mood${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof mv] as string;
                    return (
                      <button
                        key={key}
                        onClick={() => setMood(key)}
                        className={cn(
                          "rounded-lg border-2 px-2 py-2.5 text-xs font-medium flex flex-col items-center gap-1 transition-colors",
                          mood === key
                            ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300"
                            : "border-border hover:border-violet-300"
                        )}
                      >
                        <span className="text-lg">{emoji}</span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Glow intensity */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">{mv.glowLabel}</Label>
                  <span className="text-xs text-muted-foreground font-mono">{glowIntensity}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={glowIntensity}
                  onChange={(e) => setGlowIntensity(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
              </div>

              {/* Vignette + Pan speed row */}
              <div className="flex flex-wrap gap-4">
                {/* Vignette toggle */}
                <div className="flex items-center gap-2">
                  <button
                    role="switch"
                    aria-checked={vignette}
                    onClick={() => setVignette(!vignette)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                      vignette ? "bg-violet-500" : "bg-muted-foreground/30"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                      vignette ? "translate-x-4" : "translate-x-0.5"
                    )} />
                  </button>
                  <Label className="text-sm cursor-pointer" onClick={() => setVignette(!vignette)}>
                    {mv.vignetteLabel}
                  </Label>
                </div>
              </div>

              {/* Pan speed */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{mv.panSpeedLabel}</Label>
                <div className="flex gap-2">
                  {(["slow", "normal", "fast"] as PanSpeed[]).map((s) => {
                    const label = mv[`pan${s.charAt(0).toUpperCase() + s.slice(1)}` as keyof typeof mv] as string;
                    return (
                      <button
                        key={s}
                        onClick={() => setPanSpeed(s)}
                        className={cn(
                          "flex-1 rounded-lg border-2 py-2 text-sm font-medium transition-colors",
                          panSpeed === s
                            ? "border-pink-500 bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300"
                            : "border-border hover:border-pink-300"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
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
                <div key={s} className={cn("flex items-center gap-3 text-sm",
                  isDone ? "text-muted-foreground" : isActive ? "text-foreground font-medium" : "text-muted-foreground/40"
                )}>
                  <div className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
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
            <div className="flex gap-3">
              <Button
                onClick={handleDownload}
                variant="outline"
                className="flex-1 h-11 border-pink-300 dark:border-pink-700 text-pink-700 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-pink-950/30"
              >
                <Download className="h-4 w-4 mr-2" />
                {mv.downloadBtn}
              </Button>
              {hasThumbnail && (
                <Button
                  onClick={handleThumbnailDownload}
                  variant="outline"
                  className="flex-1 h-11 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {mv.thumbnailBtn}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
