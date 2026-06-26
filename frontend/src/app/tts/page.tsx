"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Mic, Download, Play, Square, Loader2, Volume2, Coins, Lock } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import Link from "next/link";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://ai119-bot-production.up.railway.app";

const MAX_CHARS = 5000;
const MIN_AP = 50;   // minimum 1 block = 10 seconds
const MIN_P = 500;

const MODELS = [
  { value: "eleven_multilingual_v2", label: "Multilingual v2" },
  { value: "eleven_flash_v2_5", label: "Flash v2.5" },
  { value: "eleven_turbo_v2_5", label: "Turbo v2.5" },
  { value: "eleven_monolingual_v1", label: "Monolingual v1 (EN)" },
];

interface ElevenVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
}

export default function TtsPage() {
  const { t } = useLanguage();
  const tt = t.tts;
  const { user, token, setUser } = useAuthStore();

  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [modelId, setModelId] = useState("eleven_multilingual_v2");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [speed, setSpeed] = useState(1.0);
  const [currency, setCurrency] = useState<"ap" | "p">("p");
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch(`${API}/api/tts/voices`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Failed")))
      .then((data: { voices: ElevenVoice[] }) => {
        setVoices(data.voices ?? []);
        if (data.voices?.length) setVoiceId(data.voices[0].voice_id);
      })
      .catch(() => toast.error(tt.toastVoiceError))
      .finally(() => setLoadingVoices(false));
  }, [tt.toastVoiceError]);

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

  const handleGenerate = async () => {
    if (!text.trim()) { toast.error(tt.toastNoText); return; }
    if (!voiceId) { toast.error(tt.toastNoVoice); return; }
    if (text.length > MAX_CHARS) {
      toast.error(tt.toastOverLimit.replace("{{max}}", MAX_CHARS.toLocaleString()));
      return;
    }
    if (currency === "ap" && (user?.points ?? 0) < MIN_AP) {
      toast.error(tt.toastInsufficientAp);
      return;
    }
    if (currency === "p" && (user?.freePoints ?? 0) < MIN_P) {
      toast.error(tt.toastInsufficientP);
      return;
    }

    setGenerating(true);
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }

    try {
      const res = await fetch(`${API}/api/tts/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, voiceId, modelId, stability, similarityBoost, speed, currency }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? `Error ${res.status}`);
      }

      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
      toast.success(tt.toastSuccess);
      await refreshBalance();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tt.toastGenerateError);
    } finally {
      setGenerating(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current || !audioUrl) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = "tts-output.mp3";
    a.click();
  };

  const charsLeft = MAX_CHARS - text.length;
  const isOverLimit = text.length > MAX_CHARS;

  if (!user) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-20 flex flex-col items-center text-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg">
          <Lock className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-black">{tt.title}</h1>
        <p className="text-muted-foreground max-w-sm">{tt.loginRequired}</p>
        <Link href="/auth">
          <Button className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90 px-8">
            {tt.goToLogin}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow">
            <Mic className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">{tt.title}</h1>
            <p className="text-sm text-muted-foreground">{tt.subtitle}</p>
          </div>
        </div>
        <p className="text-muted-foreground mt-1">{tt.desc}</p>
      </div>

      {/* Currency & Balance Panel */}
      <div className="rounded-xl border bg-gradient-to-r from-violet-50/60 to-cyan-50/60 dark:from-violet-950/20 dark:to-cyan-950/20 p-4 mb-6 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Coins className="h-4 w-4 text-violet-600" />
          {tt.costTitle}
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
            <p className="text-sm font-semibold">{tt.currencyP}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{tt.costP}</p>
            <p className="text-xs font-mono text-violet-700 dark:text-violet-400 mt-1">
              {tt.balanceP}: {(user.freePoints ?? 0).toLocaleString()} P
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
            <p className="text-sm font-semibold">{tt.currencyAp}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{tt.costAp}</p>
            <p className="text-xs font-mono text-cyan-700 dark:text-cyan-400 mt-1">
              {tt.balanceAp}: {(user.points ?? 0).toLocaleString()} AP
            </p>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">{tt.textLabel}</Label>
            <span className={`text-xs font-mono ${isOverLimit ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
              {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tt.textPlaceholder}
            rows={7}
            className={`resize-none font-medium ${isOverLimit ? "border-red-400 focus-visible:ring-red-400" : ""}`}
          />
          {isOverLimit && (
            <p className="text-xs text-red-500">{Math.abs(charsLeft).toLocaleString()} {tt.over}</p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">{tt.voiceLabel}</Label>
            {loadingVoices ? (
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{tt.voiceLoading}</span>
              </div>
            ) : (
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder={tt.voiceLabel} />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {voices.map((v) => (
                    <SelectItem key={v.voice_id} value={v.voice_id}>
                      {v.name}{v.labels?.accent ? ` · ${v.labels.accent}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">{tt.modelLabel}</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            {tt.settingsTitle}
          </p>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{tt.stabilityLabel}</Label>
                <span className="text-xs font-mono text-muted-foreground">{stability.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={stability}
                onChange={(e) => setStability(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
              <p className="text-xs text-muted-foreground">{tt.stabilityHint}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{tt.similarityLabel}</Label>
                <span className="text-xs font-mono text-muted-foreground">{similarityBoost.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={similarityBoost}
                onChange={(e) => setSimilarityBoost(Number(e.target.value))}
                className="w-full accent-cyan-600"
              />
              <p className="text-xs text-muted-foreground">{tt.similarityHint}</p>
            </div>

            <div className="space-y-3 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{tt.speedLabel}</Label>
                <span className="text-xs font-mono text-muted-foreground">{speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.7}
                max={1.2}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <p className="text-xs text-muted-foreground">{tt.speedHint}</p>
              {speed !== 1.0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">⚠ {tt.speedPaidNote}</p>
              )}
            </div>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating || !text.trim() || !voiceId || isOverLimit}
          className="w-full h-12 text-base bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90 shadow-md"
        >
          {generating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {tt.generatingBtn}
            </>
          ) : (
            <>
              <Mic className="h-5 w-5 mr-2" />
              {tt.generateBtn}
              <span className="ml-2 text-xs opacity-80">
                ({currency === "ap" ? "50 AP / 10s" : "500 P / 10s"})
              </span>
            </>
          )}
        </Button>

        {audioUrl && (
          <div className="rounded-xl border bg-gradient-to-r from-violet-50 to-cyan-50 dark:from-violet-950/20 dark:to-cyan-950/20 p-5 space-y-4">
            <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">{tt.resultTitle}</p>

            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setPlaying(false)}
              onPause={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              className="hidden"
            />

            <div className="flex gap-3">
              <Button
                onClick={handlePlayPause}
                variant="outline"
                className="flex-1 h-11 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30"
              >
                {playing ? (
                  <><Square className="h-4 w-4 mr-2" />{tt.pauseBtn}</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" />{tt.playBtn}</>
                )}
              </Button>
              <Button
                onClick={handleDownload}
                variant="outline"
                className="flex-1 h-11 border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/30"
              >
                <Download className="h-4 w-4 mr-2" />
                {tt.downloadBtn}
              </Button>
            </div>

            <audio controls src={audioUrl} className="w-full mt-1" style={{ height: 36 }} />
          </div>
        )}
      </div>
    </div>
  );
}
