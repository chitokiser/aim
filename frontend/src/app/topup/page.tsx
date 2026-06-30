"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Zap, Copy, Check, ExternalLink, Star, Coins,
  MessageCircle, AlertCircle, RefreshCw, ArrowLeftRight, Hash, CreditCard, CheckCircle,
} from "lucide-react";

const BOT_USERNAME  = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";
const TON_WALLET    = process.env.NEXT_PUBLIC_TON_WALLET ?? "";
const USDT_WALLET   = process.env.NEXT_PUBLIC_USDT_WALLET ?? "";
const API           = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const AP_PER_USD = 10_000;

const STARS_PRESETS = [
  { stars:   50, ap:   5_000, usd: 0.5 },
  { stars:  100, ap:  10_000, usd: 1 },
  { stars:  200, ap:  20_000, usd: 2 },
  { stars:  500, ap:  50_000, usd: 5 },
  { stars: 1000, ap: 100_000, usd: 10 },
];

type Tab = "stars" | "ton" | "usdt" | "card";

interface PwPackage { id: string; ap: number; usd: number; label: string; bonus: string; }

// ─── Live TON price ────────────────────────────────────────────────────────────
async function fetchTonUsdPrice(): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd",
    { next: { revalidate: 0 } },
  );
  if (!res.ok) throw new Error("price fetch failed");
  const data = await res.json() as { "the-open-network": { usd: number } };
  return data["the-open-network"].usd;
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function TopUpPage() {
  const { t } = useLanguage();
  const tt = t.topup;
  const { user, token } = useAuthStore();
  const [tab, setTab]               = useState<Tab>("stars");
  const [copiedAddress, setCopied]  = useState(false);

  // Card payment (Paymentwall) state
  const [pwPackages, setPwPackages]     = useState<PwPackage[] | null>(null);
  const [pwWidgetUrl, setPwWidgetUrl]   = useState<string | null>(null);
  const [pwSelectedPkg, setPwSelectedPkg] = useState<PwPackage | null>(null);
  const [pwLoading, setPwLoading]       = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(tt.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  const starsDeeplink = (stars: number) =>
    BOT_USERNAME ? `https://t.me/${BOT_USERNAME}?start=topup_${stars}` : null;

  const handleTabChange = (value: Tab) => {
    setTab(value);
    if (value === "card" && pwPackages === null) {
      void fetch(`${API}/api/paymentwall/packages`)
        .then((r) => r.json())
        .then((data: PwPackage[]) => setPwPackages(data))
        .catch(() => setPwPackages([]));
    }
  };

  const handleCardSelectPackage = (pkg: PwPackage) => {
    if (!token) return;
    setPwSelectedPkg(pkg);
    setPwWidgetUrl(null);
    setPwLoading(true);
    void fetch(`${API}/api/paymentwall/widget-url?packageId=${pkg.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { url: string }) => { setPwWidgetUrl(data.url); setPwLoading(false); })
      .catch(() => setPwLoading(false));
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "stars", label: tt.tabStars },
    { id: "ton",   label: tt.tabTON },
    { id: "usdt",  label: tt.tabUSDT },
    { id: "card",  label: tt.tabCard },
  ];

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black">{tt.title}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{tt.subtitle}</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-muted-foreground">{tt.currentBalance}:</span>
            <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-200 dark:border-violet-800 px-3 py-1">
              <Coins className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-bold text-violet-700 dark:text-violet-400">
                {user.points.toLocaleString()} AP
              </span>
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground border border-dashed rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          {tt.rateNote}
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted mb-6">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex-1 rounded-lg py-2 px-3 text-sm font-semibold transition-all ${
              tab === id
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* === STARS TAB === */}
      {tab === "stars" && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
              <h2 className="font-bold text-lg">{tt.starsTitle}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{tt.starsDesc}</p>
            <Badge variant="secondary" className="text-xs">{tt.starsNote}</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STARS_PRESETS.map(({ stars, ap, usd }) => {
              const link = starsDeeplink(stars);
              return (
                <div
                  key={stars}
                  className="rounded-xl border bg-card p-4 flex flex-col gap-3 hover:border-violet-400 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                      <span className="text-lg font-black">{stars.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">Stars</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">≈ ${usd}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Coins className="h-4 w-4 text-violet-500" />
                    <span className="font-bold text-violet-600 dark:text-violet-400">
                      {ap.toLocaleString()} AP
                    </span>
                  </div>
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer">
                      <Button
                        size="sm"
                        className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        {tt.starsBtn}
                      </Button>
                    </a>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => toast.error("Bot username not configured")}
                    >
                      {tt.starsBtn}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {BOT_USERNAME && (
            <p className="text-center text-xs text-muted-foreground">
              Opens{" "}
              <a
                href={`https://t.me/${BOT_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-violet-600"
              >
                @{BOT_USERNAME}
              </a>{" "}
              · Use /topup to see all options
            </p>
          )}
        </div>
      )}

      {/* === TON TAB === */}
      {tab === "ton" && (
        <TonTab
          tt={tt as unknown as Record<string, string>}
          wallet={TON_WALLET}
          copied={copiedAddress}
          onCopy={copy}
          botUsername={BOT_USERNAME}
          telegramId={user?.telegramId}
        />
      )}

      {/* === USDT TAB === */}
      {tab === "usdt" && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-bold text-lg mb-1">{tt.usdtTitle}</h2>
            <p className="text-sm text-muted-foreground mb-1">{tt.usdtDesc}</p>
            <Badge variant="secondary" className="text-xs">{tt.usdtNote}</Badge>
          </div>

          <UsdtAutoGuide tt={tt as unknown as Record<string, string>} botUsername={BOT_USERNAME} />

          <WalletCard
            address={USDT_WALLET}
            label={tt.walletAddress}
            noWalletMsg={tt.noWallet}
            copied={copiedAddress}
            copyLabel={tt.copy}
            onCopy={copy}
          />
        </div>
      )}

      {/* === CARD TAB === */}
      {tab === "card" && (
        <div className="space-y-6">
          {/* Info banner */}
          <div className="rounded-2xl border bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-indigo-800 dark:text-indigo-300">{tt.card.howTitle}</h2>
                <p className="text-xs text-muted-foreground">{tt.card.howSubtitle}</p>
              </div>
            </div>
            <ol className="space-y-1.5">
              {[tt.card.how1, tt.card.how2, tt.card.how3].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-indigo-700 dark:text-indigo-400">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {!user || !token ? (
            <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
              <p className="text-muted-foreground">{tt.card.loginRequired}</p>
              <Link href="/auth">
                <Button className="bg-gradient-to-r from-indigo-600 to-violet-500 text-white hover:opacity-90">
                  {tt.loginBtn}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Package selection */}
              {!pwWidgetUrl && (
                <>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{tt.card.selectPackage}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(pwPackages ?? []).map((pkg) => (
                      <button
                        key={pkg.id}
                        onClick={() => handleCardSelectPackage(pkg)}
                        disabled={pwLoading && pwSelectedPkg?.id === pkg.id}
                        className={[
                          "relative flex flex-col items-start gap-1 rounded-2xl border p-5 text-left transition-all shadow-sm",
                          "hover:border-indigo-400 hover:shadow-indigo-100 dark:hover:shadow-indigo-900/20",
                          pwLoading && pwSelectedPkg?.id === pkg.id ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                        ].join(" ")}
                      >
                        {pkg.bonus && (
                          <span className="absolute top-3 right-3 text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full">
                            {pkg.bonus}
                          </span>
                        )}
                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                          {pkg.ap.toLocaleString()} AP
                        </span>
                        <span className="text-sm text-muted-foreground font-medium">${pkg.usd.toFixed(2)} USD</span>
                        {pwLoading && pwSelectedPkg?.id === pkg.id && (
                          <span className="text-xs text-indigo-500 mt-1">{tt.card.loading}</span>
                        )}
                      </button>
                    ))}
                    {pwPackages !== null && pwPackages.length === 0 && (
                      <p className="col-span-2 text-center text-muted-foreground text-sm py-8">{tt.card.noPackages}</p>
                    )}
                  </div>
                </>
              )}

              {/* Paymentwall iframe */}
              {pwWidgetUrl && pwSelectedPkg && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {pwSelectedPkg.ap.toLocaleString()} AP — ${pwSelectedPkg.usd.toFixed(2)}
                    </p>
                    <button
                      onClick={() => { setPwWidgetUrl(null); setPwSelectedPkg(null); }}
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      {tt.card.changePackage}
                    </button>
                  </div>
                  <div className="rounded-2xl overflow-hidden border shadow-sm">
                    <iframe
                      src={pwWidgetUrl}
                      className="w-full"
                      style={{ height: "600px", border: "none" }}
                      title="Paymentwall"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{tt.card.secureNotice}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Login prompt */}
      {!user && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 p-5 text-center">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-3">
            {tt.loginRequired}
          </p>
          <Link href="/auth">
            <Button className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90">
              {tt.loginBtn}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── TON Tab ──────────────────────────────────────────────────────────────────
function TonTab({
  tt, wallet, copied, onCopy, botUsername, telegramId,
}: {
  tt: Record<string, string>;
  wallet: string;
  copied: boolean;
  onCopy: (s: string) => void;
  botUsername: string;
  telegramId?: string | number | null;
}) {
  const [tonPrice, setTonPrice]   = useState<number | null>(null);
  const [priceErr, setPriceErr]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [tonInput, setTonInput]   = useState("");
  const [apInput, setApInput]     = useState("");
  const [lastChanged, setLast]    = useState<"ton" | "ap">("ton");

  const apPerTon = tonPrice ? tonPrice * AP_PER_USD : null;

  const loadPrice = useCallback(async () => {
    setLoading(true);
    setPriceErr(false);
    try {
      const price = await fetchTonUsdPrice();
      setTonPrice(price);
    } catch {
      setPriceErr(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPrice(); }, [loadPrice]);

  // Sync fields when price loads
  useEffect(() => {
    if (!apPerTon) return;
    if (lastChanged === "ton" && tonInput) {
      const ap = parseFloat(tonInput) * apPerTon;
      setApInput(isNaN(ap) ? "" : Math.round(ap).toLocaleString());
    }
  }, [apPerTon, tonInput, lastChanged]);

  const handleTonChange = (val: string) => {
    setTonInput(val);
    setLast("ton");
    if (!apPerTon || val === "") { setApInput(""); return; }
    const n = parseFloat(val);
    setApInput(isNaN(n) ? "" : Math.round(n * apPerTon).toLocaleString());
  };

  const handleApChange = (val: string) => {
    const raw = val.replace(/,/g, "");
    setApInput(raw);
    setLast("ap");
    if (!apPerTon || raw === "") { setTonInput(""); return; }
    const n = parseFloat(raw);
    setTonInput(isNaN(n) ? "" : (n / apPerTon).toFixed(4));
  };

  const apResult  = lastChanged === "ton" ? apInput : "";
  const tonResult = lastChanged === "ap"  ? tonInput : "";

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold text-lg mb-1">{tt.tonTitle}</h2>
        <p className="text-sm text-muted-foreground mb-2">{tt.tonDesc}</p>
        <Badge variant="secondary" className="text-xs">{tt.tonNote}</Badge>
      </div>

      {/* Live rate badge */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">💎</span>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {tt.tonLiveRate}
            </p>
            {loading ? (
              <p className="text-sm text-muted-foreground animate-pulse">{tt.tonFetching}</p>
            ) : priceErr ? (
              <p className="text-sm text-destructive">{tt.tonPriceError}</p>
            ) : tonPrice ? (
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black">
                  ${tonPrice.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">/ TON</span>
                </span>
                <span className="text-xs text-violet-600 font-semibold">
                  = {apPerTon ? Math.round(apPerTon).toLocaleString() : "—"} AP
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <button
          onClick={loadPrice}
          disabled={loading}
          className="rounded-lg border p-2 hover:bg-accent transition-colors disabled:opacity-50"
          title={tt.tonRefresh}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Converter */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ArrowLeftRight className="h-4 w-4 text-violet-500" />
          <h3 className="font-bold text-sm">{tt.tonConverter}</h3>
        </div>

        <div className="space-y-3">
          {/* TON input */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              {tt.tonEnterTon}
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">💎</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tonInput}
                  onChange={(e) => handleTonChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border bg-muted pl-9 pr-14 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">TON</span>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* AP input */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              {tt.tonEnterAp}
            </label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-500" />
              <input
                type="text"
                inputMode="numeric"
                value={apInput}
                onChange={(e) => handleApChange(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border bg-muted pl-9 pr-12 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-violet-600">AP</span>
            </div>
          </div>
        </div>

        {/* Result summary */}
        {apPerTon && (tonInput || apInput) && (
          <div className="mt-4 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 p-3">
            {lastChanged === "ton" && tonInput && (
              <p className="text-sm">
                <span className="font-semibold">💎 {parseFloat(tonInput).toLocaleString()} TON</span>
                <span className="text-muted-foreground mx-2">→</span>
                <span className="font-black text-violet-600">
                  {Math.round(parseFloat(tonInput) * apPerTon).toLocaleString()} AP
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  ≈ ${(parseFloat(tonInput) * (tonPrice ?? 0)).toFixed(2)} USD
                </span>
              </p>
            )}
            {lastChanged === "ap" && apInput && (
              <p className="text-sm">
                <span className="font-semibold">
                  {parseFloat(apInput.replace(/,/g, "")).toLocaleString()} AP
                </span>
                <span className="text-muted-foreground mx-2">→</span>
                <span className="font-black text-violet-600">
                  💎 {tonInput} TON
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  ≈ ${(parseFloat(tonInput || "0") * (tonPrice ?? 0)).toFixed(2)} USD
                </span>
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{tt.tonSendExact}</p>
          </div>
        )}

        {!apPerTon && (
          <p className="mt-3 text-xs text-muted-foreground text-center">{tt.tonMinimum}</p>
        )}
      </div>

      {/* Wallet */}
      <WalletCard
        address={wallet}
        label={tt.walletAddress}
        noWalletMsg={tt.noWallet}
        copied={copied}
        copyLabel={tt.copy}
        onCopy={onCopy}
      />

      {/* Telegram ID comment instruction */}
      <TonCommentGuide tt={tt} telegramId={telegramId} onCopy={onCopy} />
    </div>
  );
}

// ─── TON Comment Guide ────────────────────────────────────────────────────────
function TonCommentGuide({
  tt, telegramId, onCopy,
}: {
  tt: Record<string, string>;
  telegramId?: string | number | null;
  onCopy: (s: string) => void;
}) {
  const [copiedId, setCopiedId] = useState(false);

  const copyId = async () => {
    if (!telegramId) return;
    try {
      await navigator.clipboard.writeText(String(telegramId));
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Hash className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
          {tt.tonCommentTitle}
        </p>
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
        {tt.tonCommentHint}
      </p>
      {telegramId ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-700 px-3 py-2">
            <span className="text-xs text-muted-foreground">{tt.yourTelegramId}:</span>
            <code className="flex-1 text-sm font-mono font-bold text-amber-800 dark:text-amber-200">
              {telegramId}
            </code>
          </div>
          <button
            onClick={copyId}
            className="shrink-0 flex items-center gap-1 rounded-lg border border-amber-300 dark:border-amber-600 bg-white dark:bg-amber-950/40 px-2.5 py-2 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          >
            {copiedId
              ? <Check className="h-3.5 w-3.5 text-green-500" />
              : <Copy className="h-3.5 w-3.5 text-amber-600" />}
            {tt.copy}
          </button>
        </div>
      ) : (
        <p className="text-xs text-amber-600 italic">{tt.loginRequired}</p>
      )}
      <p className="text-xs text-green-700 dark:text-green-400 font-semibold flex items-center gap-1">
        <Check className="h-3 w-3" />
        {tt.tonAutoNote}
      </p>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function WalletCard({
  address, label, noWalletMsg, copied, copyLabel, onCopy,
}: {
  address: string;
  label: string;
  noWalletMsg: string;
  copied: boolean;
  copyLabel: string;
  onCopy: (text: string) => void;
}) {
  if (!address) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        <AlertCircle className="h-5 w-5 mx-auto mb-2 text-amber-500" />
        {noWalletMsg}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {label}
      </p>
      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2.5">
        <span className="flex-1 text-sm font-mono break-all">{address}</span>
        <button
          onClick={() => onCopy(address)}
          className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold bg-background border hover:bg-accent transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copyLabel}
        </button>
      </div>
    </div>
  );
}

// ─── USDT Auto Guide ─────────────────────────────────────────────────────────
function UsdtAutoGuide({
  tt, botUsername,
}: {
  tt: Record<string, string>;
  botUsername: string;
}) {
  return (
    <div className="rounded-xl border-2 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-blue-600 shrink-0" />
        <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
          {tt.usdtRegisterTitle}
        </p>
      </div>
      <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
        {tt.usdtRegisterHint}
      </p>
      <div className="rounded-lg bg-white dark:bg-blue-950/40 border border-blue-200 dark:border-blue-700 px-3 py-2">
        <code className="text-sm font-mono font-bold text-blue-800 dark:text-blue-200">
          /wallet T...yourAddress
        </code>
      </div>
      {botUsername && (
        <a
          href={`https://t.me/${botUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full"
        >
          <Button
            variant="outline"
            className="w-full gap-2 border-blue-300 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {tt.usdtRegisterBtn}
          </Button>
        </a>
      )}
      <p className="text-xs text-green-700 dark:text-green-400 font-semibold flex items-center gap-1">
        <Check className="h-3 w-3" />
        {tt.usdtAutoNote}
      </p>
    </div>
  );
}
