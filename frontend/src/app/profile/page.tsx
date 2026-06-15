"use client";

import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Coins, Copy, Trophy, Target, TrendingUp, Users,
  ExternalLink, CheckCircle, XCircle, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

const POINT_HISTORY = [
  { id: "1", type: "mission_reward", desc: "AI CF 영상 미션 완료", amount: 50000, date: "2026-06-14", status: "completed" },
  { id: "2", type: "post_reward", desc: "게시물 등록 보상", amount: 1000, date: "2026-06-13", status: "completed" },
  { id: "3", type: "like_reward", desc: "좋아요 획득 (×5)", amount: 2500, date: "2026-06-13", status: "completed" },
  { id: "4", type: "referral_bonus", desc: "추천인 보너스 (user123)", amount: 2000, date: "2026-06-12", status: "completed" },
  { id: "5", type: "comment_reward", desc: "댓글 획득 (×3)", amount: 1500, date: "2026-06-12", status: "completed" },
  { id: "6", type: "withdrawal", desc: "TON코인 출금 (-50,000 AP)", amount: -50000, date: "2026-06-10", status: "completed" },
];

const MY_POSTS = [
  { id: "1", platform: "Instagram", url: "https://instagram.com/p/example", tags: ["#AIM", "#AIcf"], status: "approved", points: 51000, date: "2026-06-14" },
  { id: "2", platform: "YouTube", url: "https://youtube.com/watch?v=example", tags: ["#AIM", "#AI리뷰"], status: "pending", points: 0, date: "2026-06-13" },
  { id: "3", platform: "Blog", url: "https://blog.example.com/post", tags: ["#AIM", "#AICMsong"], status: "rejected", points: 0, date: "2026-06-11" },
];

export default function ProfilePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    if (!user) router.push("/auth");
  }, [user, router]);

  if (!user) return null;

  const referralUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/auth?ref=${user.referralCode}`;

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

  const withdrawalDetails = [
    [t.profile.exchangeRate, "10,000 AP = 1 USD"],
    [t.profile.minWithdrawal, "50,000 AP (5 USD)"],
    [t.profile.withdrawalMethod, "TON"],
    [t.profile.processingTime, "instant"],
    [t.profile.nonCustodial, "non-custodial"],
  ];

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
          { label: t.profile.referrals, value: "7", icon: Users, color: "text-green-500" },
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
        </TabsList>

        {/* Point History */}
        <TabsContent value="points">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.profile.pointHistoryTab}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {POINT_HISTORY.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${tx.amount > 0 ? "bg-green-500" : "bg-red-500"}`} />
                      <div>
                        <p className="text-sm font-medium">{tx.desc}</p>
                        <p className="text-xs text-muted-foreground">{tx.date}</p>
                      </div>
                    </div>
                    <span className={`font-bold text-sm ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()} AP
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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

              <div className="space-y-3 text-sm">
                {withdrawalDetails.map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>

              <Button
                className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
                disabled={user.points < 50000}
              >
                {user.points < 50000 ? t.profile.insufficientAP : t.profile.withdrawBtn}
              </Button>

              <p className="text-xs text-center text-muted-foreground">{t.profile.botHint}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
