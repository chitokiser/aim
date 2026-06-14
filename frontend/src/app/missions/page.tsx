"use client";

import { useState } from "react";
import { MissionCard } from "@/components/mission-card";
import {
  AdvertiserListModal,
  MissionDetailSheet,
  SubmitLinksModal,
  type MissionFlowData,
} from "@/components/mission-join-flow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";
import { Search, SlidersHorizontal } from "lucide-react";

const MISSIONS = [
  {
    id: "1",
    title: "AI Brand CF Video",
    description: "Create a 30-second CF video using AI tools and upload to Instagram or TikTok.",
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
    title: "Blog AI Product Review",
    description: "Write an AI tool review on your blog and share the link. Min 500 characters.",
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
    description: "Create a CM song using AI music tools and upload as YouTube Shorts or Reels.",
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
  {
    id: "4",
    title: "YouTube 구독 미션",
    description: "광고주의 유튜브 채널을 방문해 구독, 좋아요, 댓글 1회 완료 시 봇 자동 심사 후 AP 보상. 1계정 1회 참여.",
    reward: 10000,
    remainingBudget: 5000000,
    totalBudget: 10000000,
    endDate: new Date("2026-08-01"),
    requiredTags: ["#AIM", "#YTSubscribe"],
    participantCount: 1203,
    missionType: "youtube_sub" as const,
    status: "active" as const,
    advertiserName: "VideoAds",
  },
  {
    id: "5",
    title: "SNS 배너 광고 미션",
    description: "내 블로그/SNS에 광고주 배너를 만들어 게시. 유저 외 장치에서 링크 클릭 시 건당 자동 AP 보상. 예산 소진 시 종료.",
    reward: 5000,
    remainingBudget: 600000,
    totalBudget: 2000000,
    endDate: new Date("2026-07-20"),
    requiredTags: ["#AIM", "#SNSAd"],
    participantCount: 445,
    missionType: "sns_banner" as const,
    status: "active" as const,
    advertiserName: "BannerCo",
  },
  {
    id: "6",
    title: "텔레그램 광고주 서비스 가입",
    description: "광고주 추천 링크를 통해 텔레그램 그룹방 또는 채널에 가입 시 즉시 AP 보상. 예산 소진 시 종료.",
    reward: 15000,
    remainingBudget: 300000,
    totalBudget: 1500000,
    endDate: new Date("2026-06-25"),
    requiredTags: ["#AIM", "#TGJoin"],
    participantCount: 892,
    missionType: "telegram_join" as const,
    status: "active" as const,
    advertiserName: "TelegramAds",
  },
  {
    id: "7",
    title: "⚡ 스페샬! Jumpdao 그룹방 가입",
    description: "GameHub 접속 → 사냥해서 GP 토큰 모으기 → 묘목 1개 심기 → Jumpdao_bot과 소통 후 검수 → AP 자동 보상!",
    reward: 100000,
    remainingBudget: 8000000,
    totalBudget: 10000000,
    endDate: new Date("2026-09-01"),
    requiredTags: ["#AIM", "#Jumpdao", "#GameHub"],
    participantCount: 56,
    missionType: "jumpdao" as const,
    status: "active" as const,
    advertiserName: "Jumpdao",
  },
];

export default function MissionsPage() {
  const { t } = useLanguage();
  const m = t.missions;

  const [joinMission, setJoinMission] = useState<MissionFlowData | null>(null);
  const [detailMission, setDetailMission] = useState<MissionFlowData | null>(null);
  const [submitMission, setSubmitMission] = useState<MissionFlowData | null>(null);

  const FILTERS = [
    { label: m.filterAll, value: "all" },
    { label: m.filterCF, value: "cf_video" },
    { label: m.filterBlog, value: "blog_post" },
    { label: m.filterCM, value: "cm_song" },
    { label: m.filterYoutubeSub, value: "youtube_sub" },
    { label: m.filterSnsBanner, value: "sns_banner" },
    { label: m.filterTelegramJoin, value: "telegram_join" },
    { label: m.filterJumpdao, value: "jumpdao" },
  ];

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = MISSIONS.filter((ms) => {
    const matchSearch =
      ms.title.toLowerCase().includes(search.toLowerCase()) ||
      ms.description.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || ms.missionType === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-2">{m.title}</h1>
        <p className="text-muted-foreground">{m.subtitle}</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={m.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Type Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {FILTERS.map(({ label, value }) => (
          <Badge
            key={value}
            variant={filter === value ? "default" : "outline"}
            className="cursor-pointer px-3 py-1.5 text-sm"
            onClick={() => setFilter(value)}
          >
            {label}
          </Badge>
        ))}
      </div>

      {/* Mission Grid */}
      {filtered.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((mission) => (
            <MissionCard key={mission.id} mission={mission} onJoin={setJoinMission} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <svg className="h-12 w-12 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <circle cx="12" cy="12" r="6" strokeWidth="2" />
            <circle cx="12" cy="12" r="2" strokeWidth="2" />
          </svg>
          <p className="text-lg font-medium">{m.noResults}</p>
          <p className="text-sm mt-1">{m.noResultsHint}</p>
        </div>
      )}

      {/* Mission Join Flow */}
      <AdvertiserListModal
        mission={joinMission}
        open={!!joinMission}
        onClose={() => setJoinMission(null)}
        onViewDetail={(adv) => {
          setJoinMission(null);
          setDetailMission(adv);
        }}
        onSubmitWork={(adv) => {
          setJoinMission(null);
          setSubmitMission(adv);
        }}
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
    </div>
  );
}
