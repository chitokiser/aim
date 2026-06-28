"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Coins, ArrowLeft, TrendingUp, TrendingDown,
  Gift, Zap, Users, ArrowRightLeft,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type TxType =
  | "admin_charge"
  | "post_reward"
  | "mission_reward"
  | "mission_settlement"
  | "mission_refund"
  | "referral_bonus"
  | "mentor_bonus"
  | "mentor_settlement"
  | "withdrawal"
  | string;

interface Transaction {
  id: string;
  amount: number;
  type: TxType;
  description: string;
  createdAt: string;
  missionId?: string | null;
  postId?: string | null;
}

function txIcon(type: TxType) {
  if (type === "withdrawal") return TrendingDown;
  if (type === "referral_bonus") return Users;
  if (type.includes("mentor")) return Users;
  if (type.includes("mission")) return Zap;
  if (type === "post_reward") return Gift;
  if (type === "admin_charge") return Coins;
  return ArrowRightLeft;
}

export default function PointsHistoryPage() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const { t } = useLanguage();
  const ad = t.admin;

  const [txList, setTxList] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push("/auth"); return; }
  }, [user, router]);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/points/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json() as Transaction[];
        setTxList(data);
      } catch {
        toast.error("포인트 내역을 불러오지 못했습니다");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [token]);

  if (!user) return null;

  const txTypeLabel = (type: TxType): string => {
    const map: Record<string, string> = {
      admin_charge: ad.txTypeAdminCharge,
      post_reward: ad.txTypePostReward,
      mission_reward: ad.txTypeMissionReward,
      mission_settlement: ad.txTypeMissionSettlement,
      mission_refund: ad.txTypeMissionRefund,
      referral_bonus: ad.txTypeReferralBonus,
      mentor_bonus: ad.txTypeMentorBonus,
      mentor_settlement: ad.txTypeMentorBonus,
      withdrawal: ad.txTypeWithdrawal,
    };
    return map[type] ?? type;
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const totalEarned = txList.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalSpent = txList.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Back */}
      <Link
        href="/profile"
        className={buttonVariants({ variant: "ghost", size: "sm" }) + " mb-4 -ml-2"}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t.nav.myProfile}
      </Link>

      <h1 className="text-2xl font-black mb-6">{ad.historyTitle}</h1>

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Coins className="h-5 w-5 text-violet-500 mx-auto mb-1" />
            <div className="text-xl font-black text-violet-600 dark:text-violet-400">
              {user.points.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">AP</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <div className="text-xl font-black text-green-600 dark:text-green-400">
              +{totalEarned.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">AP earned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <div className="text-xl font-black text-amber-600 dark:text-amber-400">
              {(user.freePoints ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">P</div>
          </CardContent>
        </Card>
      </div>

      {/* AP Transaction list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4 text-violet-500" />
            AP {ad.historyTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-40 rounded bg-muted" />
                    <div className="h-3 w-24 rounded bg-muted" />
                  </div>
                  <div className="h-4 w-20 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : txList.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Coins className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>{ad.historyEmpty}</p>
            </div>
          ) : (
            <div className="divide-y">
              {txList.map((tx) => {
                const Icon = txIcon(tx.type);
                const isPositive = tx.amount > 0;
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      isPositive
                        ? "bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400"
                        : "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description || txTypeLabel(tx.type)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {txTypeLabel(tx.type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</span>
                      </div>
                    </div>
                    <span className={`font-bold text-sm shrink-0 ${
                      isPositive ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
                    }`}>
                      {isPositive ? "+" : ""}{tx.amount.toLocaleString()} AP
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* P info box */}
      <Card className="mt-4">
        <CardContent className="p-4 flex items-start gap-3">
          <Zap className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">P 포인트 ({(user.freePoints ?? 0).toLocaleString()} P)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              P는 AI 기능 (TTS, 음악 생성, 뮤직비디오) 이용 시 소모되는 무료 포인트입니다.
              거래 내역은 기록되지 않으며 잔액만 표시됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary row */}
      {txList.length > 0 && (
        <div className="mt-4 flex justify-between text-xs text-muted-foreground px-1">
          <span>총 {txList.length}건</span>
          <span>출금 합계: -{totalSpent.toLocaleString()} AP</span>
        </div>
      )}
    </div>
  );
}
