"use client";

import { useState } from "react";
import { MissionCard } from "@/components/mission-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal } from "lucide-react";

const MISSIONS = [
  {
    id: "1",
    title: "AI 브랜드 CF 영상 제작",
    description: "AI 도구를 이용해 30초 CF 영상을 제작하고 인스타그램 또는 틱톡에 업로드하세요.",
    reward: 50000,
    remainingBudget: 2500000,
    totalBudget: 5000000,
    endDate: new Date("2026-06-30"),
    requiredTags: ["#AIM", "#AIcf", "#창작"],
    participantCount: 234,
    missionType: "cf_video" as const,
    status: "active" as const,
    advertiserName: "BrandX",
  },
  {
    id: "2",
    title: "블로그 AI 제품 리뷰 작성",
    description: "AI 도구를 사용한 경험을 블로그에 작성하고 공유하세요. 500자 이상 작성 필수.",
    reward: 30000,
    remainingBudget: 1200000,
    totalBudget: 3000000,
    endDate: new Date("2026-07-15"),
    requiredTags: ["#AIM", "#AI리뷰"],
    participantCount: 567,
    missionType: "blog_post" as const,
    status: "active" as const,
    advertiserName: "TechCorp",
  },
  {
    id: "3",
    title: "AI CM송 제작 챌린지",
    description: "AI 음악 생성 도구로 CM송을 만들고 유튜브 숏폼 또는 릴스에 업로드하세요.",
    reward: 80000,
    remainingBudget: 800000,
    totalBudget: 4000000,
    endDate: new Date("2026-07-01"),
    requiredTags: ["#AIM", "#AICMsong", "#챌린지"],
    participantCount: 89,
    missionType: "cm_song" as const,
    status: "active" as const,
    advertiserName: "MusicBrand",
  },
  {
    id: "4",
    title: "SNS 태그 콘텐츠 공유",
    description: "기존 SNS 콘텐츠에 지정 태그를 삽입하고 게시하세요.",
    reward: 10000,
    remainingBudget: 5000000,
    totalBudget: 10000000,
    endDate: new Date("2026-08-01"),
    requiredTags: ["#AIM", "#AIcreator"],
    participantCount: 1203,
    missionType: "sns_post" as const,
    status: "active" as const,
    advertiserName: "AIM Platform",
  },
  {
    id: "5",
    title: "앱스토어 AI 도구 리뷰",
    description: "구글 플레이스토어 또는 앱스토어에서 지정 AI 앱 리뷰를 작성하세요.",
    reward: 20000,
    remainingBudget: 600000,
    totalBudget: 2000000,
    endDate: new Date("2026-07-20"),
    requiredTags: ["#AIM", "#앱리뷰"],
    participantCount: 445,
    missionType: "review" as const,
    status: "active" as const,
    advertiserName: "AppCo",
  },
  {
    id: "6",
    title: "파트너 서비스 가입 미션",
    description: "파트너 링크를 통해 서비스에 가입하고 가입 완료 스크린샷을 제출하세요.",
    reward: 15000,
    remainingBudget: 300000,
    totalBudget: 1500000,
    endDate: new Date("2026-06-25"),
    requiredTags: ["#AIM", "#파트너"],
    participantCount: 892,
    missionType: "signup" as const,
    status: "active" as const,
    advertiserName: "PartnerX",
  },
];

const FILTERS = [
  { label: "전체", value: "all" },
  { label: "CF 영상", value: "cf_video" },
  { label: "블로그", value: "blog_post" },
  { label: "SNS", value: "sns_post" },
  { label: "CM송", value: "cm_song" },
  { label: "리뷰", value: "review" },
  { label: "가입", value: "signup" },
];

export default function MissionsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = MISSIONS.filter((m) => {
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || m.missionType === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-2">미션 센터</h1>
        <p className="text-muted-foreground">AI 창작 미션에 참여하고 포인트를 획득하세요</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="미션 검색..."
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
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">검색 결과가 없습니다</p>
          <p className="text-sm mt-1">다른 키워드로 검색해보세요</p>
        </div>
      )}
    </div>
  );
}

function Target({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <circle cx="12" cy="12" r="6" strokeWidth="2" />
      <circle cx="12" cy="12" r="2" strokeWidth="2" />
    </svg>
  );
}
