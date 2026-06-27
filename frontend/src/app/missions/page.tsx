"use client";

import { useState, useEffect, useCallback } from "react";
import { MissionCard } from "@/components/mission-card";
import {
  AdvertiserListModal,
  MissionDetailSheet,
  SubmitLinksModal,
  CfAdRequestModal,
  type MissionFlowData,
} from "@/components/mission-join-flow";
import { MissionAdminModal, type MissionFormData } from "@/components/mission-admin-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import { Search, SlidersHorizontal, Film, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type RawMission = Record<string, unknown>;

function fakeParticipants(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return 50 + Math.abs(h) % 251;
}

function toCardMission(m: RawMission) {
  const id = String(m.id ?? "");
  return {
    id,
    title: String(m.title ?? ""),
    description: String(m.description ?? ""),
    reward: Number(m.reward ?? 0),
    remainingBudget: Number(m.remainingBudget ?? m.totalBudget ?? 0),
    totalBudget: Number(m.totalBudget ?? 0),
    requiredTags: (m.requiredTags as string[]) ?? [],
    participantCount: fakeParticipants(id),
    missionType: String(m.missionType ?? "cf_video") as "cf_video" | "blog_post" | "sns_post" | "cm_song" | "review" | "signup" | "youtube_sub" | "sns_banner" | "telegram_join" | "follow_join" | "jumpdao",
    status: String(m.status ?? "active") as "active" | "ended" | "pending",
    advertiserName: String(m.advertiserName ?? ""),
  };
}

function toFormData(m: RawMission): MissionFormData {
  return {
    id: String(m.id ?? ""),
    title: String(m.title ?? ""),
    description: String(m.description ?? ""),
    missionType: String(m.missionType ?? "cf_video"),
    advertiserName: String(m.advertiserName ?? ""),
    reward: Number(m.reward ?? 0),
    totalBudget: Number(m.totalBudget ?? 0),
    remainingBudget: Number(m.remainingBudget ?? m.totalBudget ?? 0),
    requiredTags: (m.requiredTags as string[]) ?? [],
    submitFields: (m.submitFields as string[]) ?? [],
    status: String(m.status ?? "active"),
    participantCount: Number(m.participantCount ?? 0),
  };
}

export default function MissionsPage() {
  const { t } = useLanguage();
  const m = t.missions;
  const { user, token } = useAuthStore();
  const isAdmin = user?.isAdmin === true;

  const [missions, setMissions] = useState<RawMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminModal, setAdminModal] = useState<{ open: boolean; mission?: MissionFormData | null }>({ open: false });

  const [joinMission, setJoinMission] = useState<MissionFlowData | null>(null);
  const [detailMission, setDetailMission] = useState<MissionFlowData | null>(null);
  const [submitMission, setSubmitMission] = useState<MissionFlowData | null>(null);
  const [cfAdOpen, setCfAdOpen] = useState(false);

  const FILTERS = [
    { label: m.filterAll, value: "all" },
    { label: m.filterCF, value: "cf_video" },
    { label: m.filterBlog, value: "blog_post" },
    { label: m.filterCM, value: "cm_song" },
    { label: m.filterYoutubeSub, value: "youtube_sub" },
    { label: m.filterSnsBanner, value: "sns_banner" },
    { label: m.filterTelegramJoin, value: "telegram_join" },
    { label: m.filterFollowJoin, value: "follow_join" },
    { label: m.filterJumpdao, value: "jumpdao" },
  ];

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const loadMissions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/missions`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json() as RawMission[];
      setMissions(data);
    } catch {
      toast.error("미션 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMissions(); }, [loadMissions]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 미션을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`${API}/api/missions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) throw new Error(`Error ${res.status}`);
      setMissions((prev) => prev.filter((ms) => String(ms.id) !== id));
      toast.success("미션이 삭제되었습니다");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  const handleSaved = (saved: MissionFormData) => {
    setMissions((prev) => {
      const idx = prev.findIndex((ms) => String(ms.id) === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved as unknown as RawMission;
        return next;
      }
      return [saved as unknown as RawMission, ...prev];
    });
  };

  const filtered = missions.filter((ms) => {
    const title = String(ms.title ?? "").toLowerCase();
    const desc = String(ms.description ?? "").toLowerCase();
    const matchSearch = title.includes(search.toLowerCase()) || desc.includes(search.toLowerCase());
    const matchFilter = filter === "all" || ms.missionType === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black mb-2">{m.title}</h1>
          <p className="text-muted-foreground">{m.subtitle}</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setAdminModal({ open: true, mission: null })}
            className="shrink-0 bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-2" />
            미션 추가
          </Button>
        )}
      </div>

      {/* CF Ad Request CTA */}
      <div className="mb-8 rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-cyan-50 dark:from-violet-950/30 dark:to-cyan-950/30 p-5 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-md">
          <Film className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <p className="font-bold text-violet-900 dark:text-violet-200">{t.cfAd.ctaTitle}</p>
          <p className="text-sm text-violet-700 dark:text-violet-400 mt-0.5">{t.cfAd.ctaSubtitle}</p>
        </div>
        <Button
          onClick={() => setCfAdOpen(true)}
          className="shrink-0 bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90 shadow-md"
        >
          <Film className="h-4 w-4 mr-2" />
          {t.cfAd.ctaBtn}
        </Button>
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
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-72 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((ms) => {
            const card = toCardMission(ms);
            const isOwner = user?.id && String(ms.advertiserId) === String(user.id);
            const canEdit = isAdmin || !!isOwner;
            return (
              <div key={card.id} className="relative group">
                <MissionCard mission={card} onJoin={setJoinMission} />
                {canEdit && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setAdminModal({ open: true, mission: toFormData(ms) })}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow border border-border text-muted-foreground hover:text-violet-600 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => void handleDelete(card.id, card.title)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow border border-border text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <svg className="h-12 w-12 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <circle cx="12" cy="12" r="6" strokeWidth="2" />
            <circle cx="12" cy="12" r="2" strokeWidth="2" />
          </svg>
          <p className="text-lg font-medium">{m.noResults}</p>
          <p className="text-sm mt-1">
            {isAdmin ? "아직 미션이 없습니다. 위의 '미션 추가' 버튼으로 첫 미션을 만들어보세요." : m.noResultsHint}
          </p>
        </div>
      )}

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
      <CfAdRequestModal
        open={cfAdOpen}
        onClose={() => setCfAdOpen(false)}
      />

      {/* Admin: Create / Edit Mission Modal */}
      <MissionAdminModal
        open={adminModal.open}
        mission={adminModal.mission}
        onClose={() => setAdminModal({ open: false })}
        onSaved={handleSaved}
      />
    </div>
  );
}
