"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MissionCard } from "@/components/mission-card";
import {
  MissionDetailSheet,
  SubmitLinksModal,
  CfAdRequestModal,
  type MissionFlowData,
} from "@/components/mission-join-flow";
import { MissionAdminModal, type MissionFormData } from "@/components/mission-admin-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import {
  Search,
  SlidersHorizontal,
  Film,
  Plus,
  Pencil,
  Trash2,
  ClipboardList,
  CheckCircle,
  ChevronRight,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type RawMission = Record<string, unknown>;

interface CpxConfig { appId: string; secureHash: string; userId: string; }
interface OfferwallConfig { apiKey: string; userId: string; }

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
    missionType: String(m.missionType ?? "cf_video") as "cf_video" | "blog_post" | "sns_post" | "cm_song" | "review" | "signup" | "youtube_sub" | "sns_banner" | "telegram_join" | "follow_join" | "jumpdao" | "survey",
    status: String(m.status ?? "active") as "active" | "ended" | "pending",
    advertiserName: String(m.advertiserName ?? ""),
    targetUrl: m.targetUrl ? String(m.targetUrl) : undefined,
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
  const router = useRouter();
  const { user, token } = useAuthStore();
  const isAdmin = user?.isAdmin === true;

  // Mission list state
  const [missions, setMissions] = useState<RawMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminModal, setAdminModal] = useState<{ open: boolean; mission?: MissionFormData | null }>({ open: false });
  const [detailMission, setDetailMission] = useState<MissionFlowData | null>(null);
  const [submitMission, setSubmitMission] = useState<MissionFlowData | null>(null);
  const [cfAdOpen, setCfAdOpen] = useState(false);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // Widget configs (loaded lazily when tab is activated)
  const [cpxConfig, setCpxConfig] = useState<CpxConfig | null>(null);
  const [cpxLoading, setCpxLoading] = useState(false);
  const [offerwallConfig, setOfferwallConfig] = useState<OfferwallConfig | null>(null);
  const [offerwallLoading, setOfferwallLoading] = useState(false);

  const refreshJoinedIds = useCallback(() => {
    if (!token) return;
    void fetch(`${API}/api/missions/my-joined-ids`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { missionIds?: string[] }) => {
        if (data.missionIds) setJoinedIds(new Set(data.missionIds));
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => { refreshJoinedIds(); }, [refreshJoinedIds]);

  const FILTERS = [
    { label: m.filterAll, value: "all" },
    { label: m.filterCF, value: "cf_video" },
    { label: m.filterCM, value: "cm_song" },
    { label: m.filterYoutubeSub, value: "youtube_sub" },
  ];

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

  const handleTabChange = (value: string) => {
    if (value === "survey" && !cpxConfig && token) {
      setCpxLoading(true);
      void fetch(`${API}/api/cpx/widget-config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data: CpxConfig) => setCpxConfig(data))
        .catch(() => {})
        .finally(() => setCpxLoading(false));
    }
    if (value === "offerwall" && !offerwallConfig && token) {
      setOfferwallLoading(true);
      void fetch(`${API}/api/offerwall/widget-config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data: OfferwallConfig) => setOfferwallConfig(data))
        .catch(() => {})
        .finally(() => setOfferwallLoading(false));
    }
  };

  const filtered = missions.filter((ms) => {
    const title = String(ms.title ?? "").toLowerCase();
    const desc = String(ms.description ?? "").toLowerCase();
    const matchSearch = title.includes(search.toLowerCase()) || desc.includes(search.toLowerCase());
    const matchFilter = filter === "all" || ms.missionType === filter;
    return matchSearch && matchFilter;
  });

  const cpxIframeUrl = cpxConfig
    ? `https://offers.cpx-research.com/index.php?app_id=${cpxConfig.appId}&ext_user_id=${cpxConfig.userId}&secure_hash=${cpxConfig.secureHash}`
    : null;

  const offerwallIframeUrl = offerwallConfig
    ? `https://offerwall.me/offerwall/${offerwallConfig.apiKey}/${offerwallConfig.userId}`
    : null;

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Page Header */}
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

      {/* Main Tabs */}
      <Tabs defaultValue="missions" onValueChange={handleTabChange}>
        <TabsList className="mb-8 w-full sm:w-auto">
          <TabsTrigger value="missions" className="flex items-center gap-2">
            <Film className="h-4 w-4" />
            {m.tabMissions}
          </TabsTrigger>
          <TabsTrigger value="survey" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            {m.tabSurvey}
          </TabsTrigger>
          <TabsTrigger value="offerwall" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            {m.tabOfferwall}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Missions ── */}
        <TabsContent value="missions">
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
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((ms) => {
                const card = toCardMission(ms);
                const isOwner = user?.id && String(ms.advertiserId) === String(user.id);
                const canEdit = isAdmin || !!isOwner;
                return (
                  <div key={card.id} className="relative group">
                    <MissionCard mission={card} onJoin={setSubmitMission} joined={joinedIds.has(card.id)} />
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
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-20 text-muted-foreground">
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
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: CPX Research Surveys ── */}
        <TabsContent value="survey">
          <div className="max-w-4xl">
            <div className="mb-6 rounded-2xl border bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-md">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-green-800 dark:text-green-300">{t.survey.howTitle}</h2>
                </div>
              </div>
              <ol className="space-y-1.5 mb-3">
                {[t.survey.how1, t.survey.how2, t.survey.how3].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ChevronRight className="h-3.5 w-3.5" />
                <span>{t.survey.earning} <strong>50,000</strong> {t.survey.earningUnit}</span>
              </div>
            </div>

            {cpxLoading ? (
              <div className="flex items-center justify-center h-96 text-muted-foreground text-sm">
                {t.survey.loadingWidget}
              </div>
            ) : !user || !token ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                <p className="text-muted-foreground">{t.survey.loginRequired}</p>
                <a
                  href="/auth"
                  className={buttonVariants({ variant: "default" }) + " bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"}
                >
                  {t.survey.loginBtn}
                </a>
              </div>
            ) : cpxIframeUrl ? (
              <div className="rounded-2xl overflow-hidden border shadow-sm">
                <iframe
                  src={cpxIframeUrl}
                  className="w-full"
                  style={{ height: "700px", border: "none" }}
                  title="CPX Research Surveys"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                {t.survey.noSurveys}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Tab 3: Offerwall.me ── */}
        <TabsContent value="offerwall">
          <div className="max-w-4xl">
            <div className="mb-6 rounded-2xl border bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-md">
                  <Gift className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-purple-800 dark:text-purple-300">{t.offerwall.howTitle}</h2>
                </div>
              </div>
              <ol className="space-y-1.5 mb-3">
                {[t.offerwall.how1, t.offerwall.how2, t.offerwall.how3].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-purple-700 dark:text-purple-400">
                    <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ChevronRight className="h-3.5 w-3.5" />
                <span>{t.offerwall.earning}</span>
              </div>
            </div>

            {offerwallLoading ? (
              <div className="flex items-center justify-center h-96 text-muted-foreground text-sm">
                {t.offerwall.loadingWidget}
              </div>
            ) : !user || !token ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                <p className="text-muted-foreground">{t.offerwall.loginRequired}</p>
                <a
                  href="/auth"
                  className={buttonVariants({ variant: "default" }) + " bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:opacity-90"}
                >
                  {t.offerwall.loginBtn}
                </a>
              </div>
            ) : offerwallIframeUrl ? (
              <div className="rounded-2xl overflow-hidden border shadow-sm">
                <iframe
                  src={offerwallIframeUrl}
                  className="w-full"
                  style={{ height: "700px", border: "none" }}
                  title="Offerwall.me Offers"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                {t.offerwall.noOffers}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Mission Join Flow */}
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
        onClose={() => { setSubmitMission(null); refreshJoinedIds(); }}
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
