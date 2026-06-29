"use client";

import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Coins, Copy, Trophy, Target, TrendingUp, Users,
  ExternalLink, CheckCircle, XCircle, Loader2, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Mentee {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  points: number;
  joinedAt: string | null;
}

interface WithdrawalDoc {
  id: string;
  apAmount: number;
  usdAmount: number;
  tonWallet: string;
  status: "pending" | "approved" | "rejected";
  txHash: string | null;
  adminNote: string | null;
  requestedAt: string;
  processedAt: string | null;
}

const MY_POSTS = [
  { id: "1", platform: "Instagram", url: "https://instagram.com/p/example", tags: ["#AIM", "#AIcf"], status: "approved", points: 51000, date: "2026-06-14" },
  { id: "2", platform: "YouTube", url: "https://youtube.com/watch?v=example", tags: ["#AIM", "#AI리뷰"], status: "pending", points: 0, date: "2026-06-13" },
  { id: "3", platform: "Blog", url: "https://blog.example.com/post", tags: ["#AIM", "#AICMsong"], status: "rejected", points: 0, date: "2026-06-11" },
];

export default function ProfilePage() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const { t } = useLanguage();
  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [menteesLoaded, setMenteesLoaded] = useState(false);
  const [tonWallet, setTonWallet] = useState("");
  const [apAmount, setApAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawHistory, setWithdrawHistory] = useState<WithdrawalDoc[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const loadMentees = useCallback(async () => {
    if (!token || menteesLoaded) return;
    try {
      const res = await fetch(`${API}/api/users/my-mentees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as Mentee[];
      setMentees(data);
    } catch { /* ignore */ } finally {
      setMenteesLoaded(true);
    }
  }, [token, menteesLoaded]);

  const loadWithdrawHistory = useCallback(async () => {
    if (!token || historyLoaded) return;
    try {
      const res = await fetch(`${API}/api/withdrawals/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as WithdrawalDoc[];
      setWithdrawHistory(data);
    } catch { /* ignore */ } finally {
      setHistoryLoaded(true);
    }
  }, [token, historyLoaded]);

  useEffect(() => {
    if (!user) router.push("/auth");
  }, [user, router]);

  useEffect(() => {
    void loadMentees();
  }, [loadMentees]);

  useEffect(() => {
    void loadWithdrawHistory();
  }, [loadWithdrawHistory]);

  if (!user) return null;

  const handleWithdraw = async () => {
    const ap = parseInt(apAmount, 10);
    if (!tonWallet.trim() || isNaN(ap) || ap < 50000) {
      toast.error(t.profile.insufficientAP);
      return;
    }
    setWithdrawLoading(true);
    try {
      const res = await fetch(`${API}/api/withdrawals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apAmount: ap, tonWallet: tonWallet.trim() }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        toast.error(err.message ?? "Error");
        return;
      }
      toast.success(t.profile.withdrawRequested);
      setApAmount("");
      setHistoryLoaded(false);
    } catch {
      toast.error("Network error");
    } finally {
      setWithdrawLoading(false);
    }
  };

  const referralUrl = user.referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth?ref=${user.referralCode}`
    : "";

  const copyReferral = () => {
    navigator.clipboard.writeText(referralUrl);
    toast.success(t.profile.referralLink);
  };

  const levelInfo = (() => {
    const p = user.points;
    if (p >= 1000000) return { level: "Diamond", next: null, progress: 100, color: "from-cyan-400 to-blue-600" };
    if (p >= 500000) return { level: "Platinum", next: 1000000, progress: (p - 500000) / 5000, color: "from-violet-400 to-purple-600" };
    if (p >= 100000) return { level: "Gold", next: 500000, progress: (p - 100000) / 4000, color: "from-amber-400 to-yellow-600" };
    if (p >= 10000) return { level: "Silver", next: 100000, progress: (p - 10000) / 900, color: "from-slate-400 to-slate-600" };
    return { level: "Bronze", next: 10000, progress: p / 100, color: "from-amber-700 to-amber-900" };
  })();

  const statusConfig = {
    approved: { label: t.admin.approve, icon: CheckCircle, color: "text-green-500" },
    pending: { label: "...", icon: Loader2, color: "text-amber-500" },
    rejected: { label: t.admin.reject, icon: XCircle, color: "text-red-500" },
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      {/* Profile Header */}
      <Card className="mb-6 overflow-hidden">
        <div className={`h-24 bg-gradient-to-r ${levelInfo.color}`} />
        <CardContent className="pt-0 pb-6 px-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
            <Avatar className="h-20 w-20 ring-4 ring-background shadow-xl">
              <AvatarImage src={user.photoUrl ?? undefined} />
              <AvatarFallback className={`bg-gradient-to-br ${levelInfo.color} text-white text-2xl font-black`}>
                {user.firstName?.[0] ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black">{user.firstName} {user.lastName}</h1>
                <Badge className="bg-gradient-to-r from-violet-500 to-cyan-500 text-white border-0">
                  {levelInfo.level}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">@{user.username}</p>
              {user.mentorUsername && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t.profile.mentor}: @{user.mentorUsername}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-violet-600 dark:text-violet-400">
                {user.points.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">AIM Point</div>
              <div className="text-xs text-muted-foreground">
                ≈ {(user.points / 10000).toFixed(2)} USD
              </div>
            </div>
          </div>

          {levelInfo.next && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{levelInfo.level}</span>
                <span>{t.profile.levelProgress.replace("{n}", (levelInfo.next - user.points).toLocaleString())}</span>
              </div>
              <Progress value={levelInfo.progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: t.profile.totalPoints, value: `${user.points.toLocaleString()} AP`, icon: Coins, color: "text-violet-500" },
          { label: t.profile.postCount, value: "3", icon: Target, color: "text-cyan-500" },
          { label: t.profile.ranking, value: "#142", icon: Trophy, color: "text-amber-500" },
          { label: t.profile.referrals, value: String(menteesLoaded ? mentees.length : "…"), icon: Users, color: "text-green-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <Icon className={`h-5 w-5 ${color} mb-2`} />
              <div className="text-lg font-black">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Referral Link */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-500" />
            {t.profile.referralLink}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono truncate">
              {referralUrl}
            </div>
            <Button variant="outline" size="icon" onClick={copyReferral}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t.profile.referralHint}</p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="points">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="points" className="flex-1">{t.profile.pointHistoryTab}</TabsTrigger>
          <TabsTrigger value="posts" className="flex-1">{t.profile.myPostsTab}</TabsTrigger>
          <TabsTrigger value="withdrawal" className="flex-1">{t.profile.withdrawalTab}</TabsTrigger>
          <TabsTrigger value="mentees" className="flex-1">{t.profile.menteesTab}</TabsTrigger>
        </TabsList>

        {/* Point History */}
        <TabsContent value="points">
          <Link href="/profile/points" className="block">
            <Card className="hover:border-violet-400 transition-colors cursor-pointer">
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/40">
                    <Coins className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold">{t.profile.pointHistoryTab}</p>
                    <p className="text-sm text-muted-foreground">AP · P 포인트 내역 전체 보기</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </TabsContent>

        {/* My Posts */}
        <TabsContent value="posts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.profile.myPostsTab}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {MY_POSTS.map((post) => {
                  const statusConf = statusConfig[post.status as keyof typeof statusConfig];
                  const StatusIcon = statusConf.icon;
                  return (
                    <div key={post.id} className="flex items-center gap-3 px-4 py-3">
                      <Badge variant="outline" className="text-xs shrink-0">{post.platform}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1 mb-1">
                          {post.tags.map((tag) => (
                            <span key={tag} className="text-xs font-mono text-muted-foreground">{tag}</span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{post.date}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`flex items-center gap-1 text-xs ${statusConf.color}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          <span>{statusConf.label}</span>
                        </div>
                        {post.points > 0 && (
                          <span className="text-xs font-bold text-violet-600">+{post.points.toLocaleString()} AP</span>
                        )}
                        <a href={post.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mentees */}
        <TabsContent value="mentees">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                {t.profile.menteesTab}
                {menteesLoaded && (
                  <span className="ml-1 text-muted-foreground font-normal text-sm">
                    {mentees.length}{t.profile.menteeCount}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!menteesLoaded ? (
                <div className="flex justify-center py-10">
                  <div className="h-6 w-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                </div>
              ) : mentees.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10 px-4">
                  {t.profile.menteeEmpty}
                </p>
              ) : (
                <div className="divide-y">
                  {mentees.map((mentee) => {
                    const name = [mentee.firstName, mentee.lastName].filter(Boolean).join(" ") || mentee.username || "—";
                    const joinDate = mentee.joinedAt ? new Date(mentee.joinedAt).toLocaleDateString() : null;
                    return (
                      <div key={mentee.id} className="flex items-center gap-3 px-4 py-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={mentee.photoUrl ?? undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-violet-500 to-cyan-500 text-white text-sm font-bold">
                            {(mentee.firstName?.[0] ?? mentee.username?.[0] ?? "?").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{name}</p>
                          {mentee.username && (
                            <p className="text-xs text-muted-foreground">@{mentee.username}</p>
                          )}
                          {joinDate && (
                            <p className="text-xs text-muted-foreground">{t.profile.menteeJoined}: {joinDate}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-violet-600 dark:text-violet-400">
                            {Number(mentee.points).toLocaleString()} AP
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdrawal */}
        <TabsContent value="withdrawal">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-500" />
                {t.profile.withdrawalTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Balance summary */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-violet-50 to-cyan-50 dark:from-violet-950/20 dark:to-cyan-950/20">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-black text-violet-700 dark:text-violet-400">
                      {user.points.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.profile.holdingAP}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-cyan-700 dark:text-cyan-400">
                      {(user.points / 10000).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.profile.withdrawableUSD}</div>
                  </div>
                </div>
              </div>

              {/* Withdrawal form */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t.profile.walletLabel}</label>
                  <input
                    type="text"
                    value={tonWallet}
                    onChange={(e) => setTonWallet(e.target.value)}
                    placeholder={t.profile.walletPlaceholder}
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t.profile.apAmountLabel}</label>
                  <input
                    type="number"
                    value={apAmount}
                    onChange={(e) => setApAmount(e.target.value)}
                    placeholder={t.profile.apAmountPlaceholder}
                    min={50000}
                    max={user.points}
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  {apAmount && !isNaN(parseInt(apAmount)) && (
                    <p className="text-xs text-muted-foreground">
                      ≈ {(parseInt(apAmount) / 10000).toFixed(2)} USD
                    </p>
                  )}
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
                  onClick={() => void handleWithdraw()}
                  disabled={withdrawLoading || user.points < 50000}
                >
                  {withdrawLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {user.points < 50000 ? t.profile.insufficientAP : t.profile.requestWithdraw}
                </Button>
              </div>

              {/* Withdrawal history */}
              <div>
                <h3 className="text-sm font-semibold mb-3">{t.profile.withdrawHistory}</h3>
                {!historyLoaded ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : withdrawHistory.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-6">{t.profile.withdrawEmpty}</p>
                ) : (
                  <div className="space-y-3">
                    {withdrawHistory.map((w) => (
                      <div key={w.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold">{w.apAmount.toLocaleString()} AP</span>
                          <Badge
                            className={
                              w.status === "approved"
                                ? "bg-green-500 text-white border-0"
                                : w.status === "rejected"
                                ? "bg-red-500 text-white border-0"
                                : "bg-amber-500 text-white border-0"
                            }
                          >
                            {w.status === "approved"
                              ? t.profile.statusApproved
                              : w.status === "rejected"
                              ? t.profile.statusRejected
                              : t.profile.statusPending}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>{w.tonWallet}</p>
                          <p>{new Date(w.requestedAt).toLocaleDateString()}</p>
                          {w.txHash && (
                            <p>
                              {t.profile.txHash}: {w.txHash}
                            </p>
                          )}
                          {w.adminNote && <p className="text-red-500">{w.adminNote}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-center text-muted-foreground">{t.profile.botHint}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
