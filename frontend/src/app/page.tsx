"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MissionCard } from "@/components/mission-card";
import {
  AdvertiserListModal,
  MissionDetailSheet,
  SubmitLinksModal,
  type MissionFlowData,
} from "@/components/mission-join-flow";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import {
  Coins,
  Target,
  Zap,
  ArrowRight,
  Bot,
  Star,
  Store,
  Sparkles,
  Gavel,
  Megaphone,
  ChevronRight,
  ClipboardList,
  Gift,
  TrendingUp,
  UserPlus,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type RawMission = Record<string, unknown>;

type CardMissionType = "cf_video" | "blog_post" | "sns_post" | "cm_song" | "review" | "signup" | "youtube_sub" | "sns_banner" | "telegram_join" | "follow_join" | "jumpdao" | "survey";

function toCardMission(m: RawMission) {
  return {
    id: String(m.id ?? ""),
    title: String(m.title ?? ""),
    description: String(m.description ?? ""),
    reward: Number(m.reward ?? 0),
    remainingBudget: Number(m.remainingBudget ?? m.totalBudget ?? 0),
    totalBudget: Number(m.totalBudget ?? 0),
    requiredTags: (m.requiredTags as string[]) ?? [],
    participantCount: Number(m.participantCount ?? 0),
    missionType: String(m.missionType ?? "cf_video") as CardMissionType,
    status: String(m.status ?? "active") as "active" | "ended" | "pending",
    advertiserName: String(m.advertiserName ?? ""),
    targetUrl: m.targetUrl ? String(m.targetUrl) : undefined,
  };
}

export default function HomePage() {
  const { t } = useLanguage();
  const h = t.home;
  const { user } = useAuthStore();
  const ctaHref = user ? "/missions" : "/auth";

  const [joinMission, setJoinMission] = useState<MissionFlowData | null>(null);
  const [detailMission, setDetailMission] = useState<MissionFlowData | null>(null);
  const [submitMission, setSubmitMission] = useState<MissionFlowData | null>(null);

  const [activeMissions, setActiveMissions] = useState<RawMission[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(true);

  const loadActiveMissions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/missions`);
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as RawMission[];
      const sorted = [...data].sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
      );
      setActiveMissions(sorted.slice(0, 3));
    } catch {
      setActiveMissions([]);
    } finally {
      setMissionsLoading(false);
    }
  }, []);

  useEffect(() => { void loadActiveMissions(); }, [loadActiveMissions]);

  const STATS = [
    { label: h.statsAuctions, value: "128+", icon: Gavel },
    { label: h.statsBots, value: "4,200+", icon: Bot },
    { label: h.statsMissionsCount, value: "89,200+", icon: Target },
    { label: h.statsCreatives, value: "12,400+", icon: Sparkles },
  ];

  const MAIN_PILLARS = [
    {
      href: "/missions",
      icon: Megaphone,
      gradient: "from-cyan-500 to-blue-600",
      bg: "from-cyan-50 to-blue-50 dark:from-cyan-950/20 dark:to-blue-950/20",
      border: "border-cyan-200 dark:border-cyan-800",
      accentText: "text-cyan-600 dark:text-cyan-400",
      title: h.service3Title,
      desc: h.service3Desc,
    },
    {
      href: "/creative-market",
      icon: Sparkles,
      gradient: "from-violet-500 to-pink-600",
      bg: "from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20",
      border: "border-violet-200 dark:border-violet-800",
      accentText: "text-violet-600 dark:text-violet-400",
      title: h.service4Title,
      desc: h.service4Desc,
    },
    {
      href: "/auction",
      icon: Gavel,
      gradient: "from-amber-500 to-orange-600",
      bg: "from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20",
      border: "border-amber-200 dark:border-amber-800",
      accentText: "text-amber-600 dark:text-amber-400",
      title: h.service1Title,
      desc: h.service1Desc,
    },
  ];

  const HOW_IT_WORKS = [
    { step: "01", title: h.step1Title, desc: h.step1Desc, icon: Bot, color: "from-violet-500 to-purple-600" },
    { step: "02", title: h.step2Title, desc: h.step2Desc, icon: Store, color: "from-cyan-500 to-blue-600" },
    { step: "03", title: h.step3Title, desc: h.step3Desc, icon: Zap, color: "from-amber-500 to-orange-600" },
    { step: "04", title: h.step4Title, desc: h.step4Desc, icon: Coins, color: "from-emerald-500 to-teal-600" },
  ];

  const POINT_ITEMS = [
    { action: h.pointPost, points: "+1,000 AP", color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/20" },
    { action: h.pointLike, points: "+500 AP", color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-950/20" },
    { action: h.pointComment, points: "+500 AP", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
    { action: h.pointMission, points: h.pointMissionValue, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
    { action: h.pointReferral, points: "+2,000 AP", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    { action: h.pointExchange, points: "10,000 AP = 1 USD", color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/20" },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 text-white">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-violet-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-6 bg-violet-500/20 text-violet-300 border-violet-500/30 text-sm px-4 py-1.5">
              <Star className="h-3 w-3 mr-1.5" />
              {h.badge}
            </Badge>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black mb-5 leading-tight">
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">{h.heroKw1}</span>
              <span className="text-slate-500 mx-2 md:mx-3">·</span>
              <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">{h.heroKw2}</span>
              <span className="text-slate-500 mx-2 md:mx-3">·</span>
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">{h.heroKw3}</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-300 mb-3 leading-relaxed font-medium">
              {h.platformDesc}
            </p>
            <p className="text-sm text-slate-400 mb-10">{h.heroNote}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={ctaHref}>
                <Button size="lg" className="bg-gradient-to-r from-violet-600 to-cyan-500 hover:opacity-90 text-white font-bold px-8 h-14 text-lg rounded-full shadow-lg shadow-violet-500/25">
                  {h.heroCTA}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/missions">
                <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 h-14 text-lg rounded-full px-8">
                  {h.heroExplore}
                  <ChevronRight className="ml-1 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b bg-muted/30 py-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ label, value, icon: Icon }) => (
              <div key={label} className="text-center">
                <div className="flex justify-center mb-2">
                  <Icon className="h-6 w-6 text-violet-500" />
                </div>
                <div className="text-2xl md:text-3xl font-black text-foreground">{value}</div>
                <div className="text-sm text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 Core Revenue Channels */}
      <section className="py-20 container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-violet-500/10 text-violet-600 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30 px-4 py-1.5">
            <Target className="h-3.5 w-3.5 mr-1.5" />
            TON Coin
          </Badge>
          <h2 className="text-3xl md:text-4xl font-black mb-3">{h.servicesTitle}</h2>
          <p className="text-muted-foreground text-lg">{h.heroSubtitle}</p>
        </div>

        {/* 3 main pillars */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-6">
          {MAIN_PILLARS.map(({ href, icon: Icon, gradient, bg, border, title, desc }) => (
            <Link key={href} href={href} className="group">
              <Card className={`h-full border ${border} bg-gradient-to-br ${bg} hover:shadow-xl transition-all duration-200 group-hover:scale-[1.02]`}>
                <CardContent className="p-6">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-md`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-lg leading-tight">{title}</h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-1 ml-2" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* 4th service — bot marketplace, secondary */}
        <div className="max-w-5xl mx-auto">
          <Link href="/marketplace" className="group">
            <Card className="border border-slate-200 dark:border-slate-700 bg-muted/30 hover:bg-muted/60 transition-all">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow shrink-0">
                  <Store className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{h.service2Title}</h3>
                  <p className="text-xs text-muted-foreground truncate">{h.service2Desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* AP Earning Methods */}
      <section className="py-20 bg-gradient-to-br from-emerald-950 via-slate-900 to-cyan-950 text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-4 py-1.5">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              {h.earnTitle}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-3">{h.earnSubtitle}</h2>
          </div>

          {/* 3 earning method cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto mb-10">
            {[
              { icon: Megaphone, gradient: "from-cyan-500 to-blue-600", title: h.earnM1Title, desc: h.earnM1Desc, value: h.earnM1Value },
              { icon: ClipboardList, gradient: "from-violet-500 to-purple-600", title: h.earnM2Title, desc: h.earnM2Desc, value: h.earnM2Value },
              { icon: Gift, gradient: "from-pink-500 to-rose-600", title: h.earnM3Title, desc: h.earnM3Desc, value: h.earnM3Value },
            ].map(({ icon: Icon, gradient, title, desc, value }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5 hover:bg-white/10 transition-colors">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-base mb-1">{title}</h3>
                <p className="text-sm text-slate-400 mb-3">{desc}</p>
                <span className="inline-block bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full">{value}</span>
              </div>
            ))}
          </div>

          {/* Estimated earnings banner */}
          <div className="max-w-3xl mx-auto rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <p className="text-slate-400 text-sm mb-1">{h.earnEstDesc}</p>
            <p className="text-4xl font-black text-emerald-400 mb-1">{h.earnEstValue}</p>
            <p className="text-xl font-bold text-emerald-300 mb-3">{h.earnEstUsd}</p>
            <p className="text-xs text-slate-500">{h.earnEstNote}</p>
            <Link href={ctaHref} className="inline-flex items-center gap-2 mt-5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-7 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 transition-opacity">
              {h.heroCTA}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Advertiser Quick Link */}
      <section className="border-b bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 py-5">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-md">
                <Megaphone className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm text-amber-900 dark:text-amber-200">{h.advertiserQuickBtn}</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">{h.advertiserQuickDesc}</p>
              </div>
            </div>
            <Link
              href="/advertiser"
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow hover:opacity-90 transition-opacity"
            >
              {h.advertiserQuickBtn}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black mb-4">{h.howTitle}</h2>
            <p className="text-muted-foreground text-lg">{h.howSubtitle}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map(({ step, title, desc, icon: Icon, color }) => (
              <Card key={step} className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${color}`} />
                <CardHeader className="pb-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-4xl font-black text-muted-foreground/20">{step}</span>
                  <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Active Missions */}
      <section className="py-16 container mx-auto px-4">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-black mb-2">{h.activeMissionsTitle}</h2>
            <p className="text-muted-foreground">{h.activeMissionsSubtitle}</p>
          </div>
          <Link href="/missions">
            <Button variant="outline" className="hidden sm:flex items-center gap-2">
              {h.viewAll}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        {missionsLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-72 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : activeMissions.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{h.noActiveMissions}</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeMissions.map((raw) => {
              const mission = toCardMission(raw);
              return <MissionCard key={mission.id} mission={mission} onJoin={setJoinMission} />;
            })}
          </div>
        )}
      </section>

      {/* AP Reward System */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black mb-4">{h.pointsTitle}</h2>
            <p className="text-muted-foreground text-lg">{h.pointsSubtitle}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {POINT_ITEMS.map(({ action, points, color, bg }) => (
              <div key={action} className={`flex items-center justify-between p-4 rounded-xl ${bg}`}>
                <span className="font-medium">{action}</span>
                <span className={`font-bold ${color}`}>{points}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Referral / Invite Friends */}
      <section className="py-20 bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-950/20 dark:to-cyan-950/20 border-y border-emerald-100 dark:border-emerald-900/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex-shrink-0 w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <UserPlus className="h-12 w-12 text-white" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <Badge className="mb-3 bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 px-4 py-1">
                10% Passive Income
              </Badge>
              <h2 className="text-2xl md:text-3xl font-black mb-3">{h.referralTitle}</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">{h.referralDesc}</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold mb-6">{h.referralNote}</p>
              <Link href={user ? "/profile" : "/auth"}>
                <Button className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-90 text-white font-bold px-7 h-12 rounded-full shadow-md shadow-emerald-500/20">
                  <UserPlus className="mr-2 h-4 w-4" />
                  {h.referralCTA}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-violet-600 to-cyan-500 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-4">{h.ctaTitle}</h2>
          <p className="text-white/80 text-lg mb-8">{h.ctaSubtitle}</p>
          <Link href="/auth">
            <Button size="lg" className="bg-white text-violet-700 hover:bg-white/90 font-bold px-8 h-14 text-lg rounded-full shadow-lg">
              {h.ctaBtn}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Mission Join Flow */}
      <AdvertiserListModal
        mission={joinMission}
        open={!!joinMission}
        onClose={() => setJoinMission(null)}
        onViewDetail={(adv) => { setJoinMission(null); setDetailMission(adv); }}
        onSubmitWork={(adv) => { setJoinMission(null); setSubmitMission(adv); }}
      />
      <MissionDetailSheet
        mission={detailMission}
        open={!!detailMission}
        onClose={() => setDetailMission(null)}
        onSubmit={() => {
          if (detailMission) setSubmitMission(detailMission);
          setDetailMission(null);
        }}
      />
      <SubmitLinksModal
        mission={submitMission}
        open={!!submitMission}
        onClose={() => setSubmitMission(null)}
      />

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500">
                <span className="text-xs font-black text-white">AI119</span>
              </div>
              <span className="font-bold text-sm">AI119</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 AI119. 10,000 AP = 1 USD · TON Network</p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <a href="https://t.me/ai119link" target="_blank" rel="noopener noreferrer" className="hover:text-foreground font-medium text-emerald-600 dark:text-emerald-400">
                💬 {h.communityLink}
              </a>
              <Link href="/about" className="hover:text-foreground">{t.footer.about}</Link>
              <Link href="/privacy" className="hover:text-foreground">{h.privacy}</Link>
              <Link href="/terms" className="hover:text-foreground">{h.terms}</Link>
              <Link href="/contact" className="hover:text-foreground">{t.footer.contactUs}</Link>
              <Link href="/advertiser" className="hover:text-foreground">{h.advertiserLink}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
