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
  MessageCircle, AlertCircle, RefreshCw, ArrowLeftRight,
} from "lucide-react";

const BOT_USERNAME  = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";
const TON_WALLET    = process.env.NEXT_PUBLIC_TON_WALLET ?? "";
const USDT_WALLET   = process.env.NEXT_PUBLIC_USDT_WALLET ?? "";

const AP_PER_USD = 10_000;

const STARS_PRESETS = [
  { stars:   50, ap:   5_000, usd: 0.5 },
  { stars:  100, ap:  10_000, usd: 1 },
  { stars:  200, ap:  20_000, usd: 2 },
  { stars:  500, ap:  50_000, usd: 5 },
  { stars: 1000, ap: 100_000, usd: 10 },
];

type Tab = "stars" | "ton" | "usdt";

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
  const { user } = useAuthStore();
  const [tab, setTab]               = useState<Tab>("stars");
  const [copiedAddress, setCopied]  = useState(false);

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

  const tabs: { id: Tab; label: string }[] = [
    { id: "stars", label: tt.tabStars },
    { id: "ton",   label: tt.tabTON },
    { id: "usdt",  label: tt.tabUSDT },
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
            onClick={() => setTab(id)}
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
          tt={tt}
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

          <WalletCard
            address={USDT_WALLET}
            label={tt.walletAddress}
            noWalletMsg={tt.noWallet}
            copied={copiedAddress}
            copyLabel={tt.copy}
            onCopy={copy}
          />

          <AfterSendGuide tt={tt} botUsername={BOT_USERNAME} telegramId={user?.telegramId} />
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

      {/* After-send guide */}
      <AfterSendGuide tt={tt} botUsername={botUsername} telegramId={telegramId} />
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

function AfterSendGuide({
  tt, botUsername, telegramId,
}: {
  tt: Record<string, string>;
  botUsername: string;
  telegramId?: string | number | null;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <p className="text-sm font-medium">{tt.afterSend}</p>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {[tt.txHash, tt.sendAmount, tt.yourTelegramId].map((step, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 text-xs font-bold">
              {i + 1}
            </span>
            {step}
            {i === 2 && telegramId && (
              <code className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{telegramId}</code>
            )}
          </li>
        ))}
      </ul>
      {botUsername && (
        <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer" className="flex w-full">
          <Button
            variant="outline"
            className="w-full gap-2 border-violet-300 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20"
          >
            <MessageCircle className="h-4 w-4" />
            {tt.contactAdmin}
          </Button>
        </a>
      )}
    </div>
  );
}
