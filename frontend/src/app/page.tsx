"use client";

import { useState } from "react";
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
} from "lucide-react";

const SAMPLE_MISSIONS = [
  {
    id: "1",
    title: "AI Brand CF Video",
    description: "Create a 30-second CF video using AI tools and upload to SNS.",
    reward: 50000,
    remainingBudget: 2500000,
    totalBudget: 5000000,
    endDate: new Date("2026-06-30"),
    requiredTags: ["#AIM", "#AIcf"],
    participantCount: 234,
    missionType: "cf_video" as const,
    status: "active" as const,
    advertiserName: "BrandX",
  },
  {
    id: "2",
    title: "AI Product Review Blog",
    description: "Write an AI tool review on your blog and share the link.",
    reward: 30000,
    remainingBudget: 1200000,
    totalBudget: 3000000,
    endDate: new Date("2026-07-15"),
    requiredTags: ["#AIM", "#AIReview"],
    participantCount: 567,
    missionType: "blog_post" as const,
    status: "active" as const,
    advertiserName: "TechCorp",
  },
  {
    id: "3",
    title: "AI CM Song Challenge",
    description: "Create a CM song using AI music tools and upload as a short video.",
    reward: 80000,
    remainingBudget: 800000,
    totalBudget: 4000000,
    endDate: new Date("2026-07-01"),
    requiredTags: ["#AIM", "#AICMsong"],
    participantCount: 89,
    missionType: "cm_song" as const,
    status: "active" as const,
    advertiserName: "MusicBrand",
  },
];

export default function HomePage() {
  const { t } = useLanguage();
  const h = t.home;

  const [joinMission, setJoinMission] = useState<MissionFlowData | null>(null);
  const [detailMission, setDetailMission] = useState<MissionFlowData | null>(null);
  const [submitMission, setSubmitMission] = useState<MissionFlowData | null>(null);

  const STATS = [
    { label: h.statsAuctions, value: "128+", icon: Gavel },
    { label: h.statsBots, value: "4,200+", icon: Bot },
    { label: h.statsMissionsCount, value: "89,200+", icon: Target },
    { label: h.statsCreatives, value: "12,400+", icon: Sparkles },
  ];

  const CORE_SERVICES = [
    {
      href: "/auction",
      icon: Gavel,
      gradient: "from-amber-500 to-orange-500",
      bg: "from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20",
      border: "border-amber-200 dark:border-amber-800",
      title: h.service1Title,
      desc: h.service1Desc,
    },
    {
      href: "/marketplace",
      icon: Store,
      gradient: "from-violet-500 to-purple-600",
      bg: "from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20",
      border: "border-violet-200 dark:border-violet-800",
      title: h.service2Title,
      desc: h.service2Desc,
    },
    {
      href: "/missions",
      icon: Megaphone,
      gradient: "from-cyan-500 to-blue-500",
      bg: "from-cyan-50 to-blue-50 dark:from-cyan-950/20 dark:to-blue-950/20",
      border: "border-cyan-200 dark:border-cyan-800",
      title: h.service3Title,
      desc: h.service3Desc,
    },
    {
      href: "/creative-market",
      icon: Sparkles,
      gradient: "from-pink-500 to-rose-500",
      bg: "from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20",
      border: "border-pink-200 dark:border-pink-800",
      title: h.service4Title,
      desc: h.service4Desc,
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
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Auction</span>
              <span className="text-slate-600 mx-2 md:mx-3">·</span>
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Catalog</span>
              <span className="text-slate-600 mx-2 md:mx-3">·</span>
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Mission</span>
              <span className="text-slate-600 mx-2 md:mx-3">·</span>
              <span className="bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">Creative</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-300 mb-3 leading-relaxed font-medium">
              {h.platformDesc}
            </p>
            <p className="text-sm text-slate-400 mb-10">{h.heroNote}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth">
                <Button size="lg" className="bg-gradient-to-r from-violet-600 to-cyan-500 hover:opacity-90 text-white font-bold px-8 h-14 text-lg rounded-full shadow-lg shadow-violet-500/25">
                  {h.heroCTA}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/auction">
                <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 h-14 text-lg rounded-full px-8">
                  {h.heroExplore}
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

      {/* 4 Core Services */}
      <section className="py-20 container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black mb-3">{h.servicesTitle}</h2>
          <p className="text-muted-foreground text-lg">{h.heroSubtitle}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 max-w-5xl mx-auto">
          {CORE_SERVICES.map(({ href, icon: Icon, gradient, bg, border, title, desc }) => (
            <Link key={href} href={href} className="group">
              <Card className={`h-full border ${border} bg-gradient-to-br ${bg} hover:shadow-xl transition-all duration-200 group-hover:scale-[1.02]`}>
                <CardContent className="p-6 flex gap-4">
                  <div className={`shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-lg leading-tight">{title}</h3>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-2" />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SAMPLE_MISSIONS.map((mission) => (
            <MissionCard key={mission.id} mission={mission} onJoin={setJoinMission} />
          ))}
        </div>
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
                <span className="text-xs font-black text-white">AIM</span>
              </div>
              <span className="font-bold text-sm">AI119</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 AIM. 10,000 AP = 1 USD · TON Network</p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground">{h.terms}</Link>
              <Link href="/privacy" className="hover:text-foreground">{h.privacy}</Link>
              <Link href="/advertiser" className="hover:text-foreground">{h.advertiserLink}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
