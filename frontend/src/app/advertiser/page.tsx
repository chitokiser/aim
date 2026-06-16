"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Megaphone, Coins, Plus, TrendingUp,
  Users, Eye, MousePointerClick, Tag, Copy, ExternalLink, LayoutTemplate, Loader2, ArrowLeft,
  CheckCircle, XCircle, Clock, ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const MISSION_TYPES_EN = [
  { value: "click", label: "Click Ad", price: "50 AP/click", desc: "Reward on link click" },
  { value: "exposure", label: "Exposure Ad", price: "10 AP/view", desc: "Reward on content view" },
  { value: "like", label: "Like Ad", price: "100 AP/like", desc: "Reward on like" },
  { value: "comment", label: "Comment Ad", price: "300 AP/comment", desc: "Reward on comment" },
  { value: "share", label: "Share Ad", price: "300 AP/share", desc: "Reward on SNS share" },
  { value: "subscribe", label: "Subscribe Ad", price: "500 AP/sub", desc: "Reward on YouTube subscribe" },
  { value: "follow", label: "Follow Ad", price: "500 AP/follow", desc: "Reward on Instagram follow" },
  { value: "join", label: "Join Ad", price: "500 AP/join", desc: "Reward on Telegram group/channel join" },
  { value: "cf_video", label: "CF Video", price: "per mission", desc: "Commission AI CF video" },
  { value: "blog_post", label: "Blog Post", price: "per mission", desc: "Post ad content on blog" },
  { value: "cm_song", label: "CM Song", price: "per mission", desc: "Commission AI CM song" },
  { value: "review", label: "App Review", price: "20,000 AP/review", desc: "Write Google/App Store review" },
];

const MY_MISSIONS = [
  { id: "1", title: "AI CF Video Production", type: "cf_video", budget: 5000000, spent: 2500000, participants: 234, status: "active" },
  { id: "2", title: "Blog AI Review", type: "blog_post", budget: 3000000, spent: 1800000, participants: 567, status: "active" },
  { id: "3", title: "Instagram Follow", type: "follow", budget: 1000000, spent: 1000000, participants: 2000, status: "ended" },
];

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface MissionTemplate {
  id: string;
  title: string;
  type: string;
  description?: string;
  rewardPerUnit?: number;
  maxParticipants?: number;
  requiredTags?: string;
}

interface Campaign {
  id: string;
  title: string;
  status: string;
  remainingBudget?: number;
  totalBudget?: number;
  participantCount?: number;
  rewardPerUnit?: number;
}

interface Submission {
  id: string;
  userId: string;
  displayName: string;
  postUrl: string;
  description?: string;
  platform?: string;
  createdAt: string;
  status: string;
}

export default function AdvertiserPage() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const { t } = useLanguage();
  const balance = user?.points ?? 0;
  const [tonWallet, setTonWallet] = useState<string>("");
  const [botUsername, setBotUsername] = useState<string>("ai_bootcamp_hub_bot");
  const [customAmount, setCustomAmount] = useState<string>("");

  const loadTelegramSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/users/public/telegram-info`);
      if (res.ok) {
        const data = await res.json() as { tonWalletAddress?: string; botUsername?: string };
        if (data.tonWalletAddress) setTonWallet(data.tonWalletAddress);
        if (data.botUsername) setBotUsername(data.botUsername);
      }
    } catch { /* settings not available */ }
  }, []);

  useEffect(() => { void loadTelegramSettings(); }, [loadTelegramSettings]);

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  // Templates browse state
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MissionTemplate | null>(null);
  const [campaignForm, setCampaignForm] = useState({
    title: "", budget: "", description: "", targetUrl: "",
    tags: "", startDate: "", endDate: "", maxParticipants: "",
    targetGroupId: "", minDaysRequired: "7", inviteLink: "",
  });
  const [campaignSubmitting, setCampaignSubmitting] = useState(false);

  const [missionForm, setMissionForm] = useState({
    title: "", description: "", type: "", budget: "", reward: "",
    maxParticipants: "", startDate: "", endDate: "", requiredTags: "", targetUrl: "",
    productName: "", website: "", productDesc: "", brandDesc: "", contentType: "", contentOption: "",
  });

  const AI_CONTENT_TYPES = [
    { value: "review_video", label: t.advertiser.aiTypeTitle, options: ["30s", "60s", "90s"] },
    { value: "ad_video", label: "AI Ad Video", options: ["CF", "Brand", "Product intro"] },
    { value: "music", label: "AI Music", options: ["Jingle", "Brand song", "CM song", "BGM"] },
    { value: "music_video", label: "AI Music Video", options: ["Lyrics → AI compose → MP3 → MV"] },
    { value: "brochure", label: "AI Brochure", options: ["PDF", "PPT", "Webpage"] },
    { value: "landing", label: "Landing Page", options: ["HTML", "Mobile", "CTA", "SEO"] },
    { value: "poster", label: "Poster", options: ["SNS poster", "Event poster", "Ad banner"] },
  ];

  // ── Submission review state ────────────────────────────────────────────────
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  const loadMyCampaigns = useCallback(async () => {
    if (!token) return;
    setCampaignsLoading(true);
    try {
      const res = await fetch(`${API}/api/missions/my-campaigns`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setMyCampaigns(await res.json() as Campaign[]);
    } catch {
      toast.error("Failed to load campaigns");
    } finally {
      setCampaignsLoading(false);
    }
  }, [token]);

  const loadPendingSubmissions = useCallback(async (campaignId: string) => {
    if (!token) return;
    setSubmissionsLoading(true);
    try {
      const res = await fetch(`${API}/api/missions/${campaignId}/pending-submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setPendingSubmissions(await res.json() as Submission[]);
    } catch {
      toast.error("Failed to load submissions");
    } finally {
      setSubmissionsLoading(false);
    }
  }, [token]);

  const handleApproveSubmission = async (submissionId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/missions/submissions/${submissionId}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast.error(err.message ?? "Approval failed");
        return;
      }
      const data = await res.json() as { rewardedAP?: number };
      toast.success(`Approved! ${data.rewardedAP?.toLocaleString() ?? 0} AP rewarded to member`);
      setPendingSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      if (selectedCampaign) {
        setSelectedCampaign((prev) => prev ? { ...prev, participantCount: (prev.participantCount ?? 0) + 1 } : prev);
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleRejectSubmission = async (submissionId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/missions/submissions/${submissionId}/reject`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast.error(err.message ?? "Rejection failed");
        return;
      }
      toast.success("Submission rejected");
      setPendingSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    } catch {
      toast.error("Network error");
    }
  };

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch(`${API}/api/missions/templates`);
      if (!res.ok) throw new Error();
      setTemplates(await res.json());
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const handleCampaignRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token || !selectedTemplate) return;
    if (!campaignForm.title.trim() || !campaignForm.budget || !campaignForm.description.trim()) return;
    setCampaignSubmitting(true);
    try {
      const res = await fetch(`${API}/api/missions/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          title: campaignForm.title.trim(),
          totalBudget: Number(campaignForm.budget),
          description: campaignForm.description.trim(),
          targetUrl: campaignForm.targetUrl.trim() || undefined,
          requiredTags: campaignForm.tags.trim() || undefined,
          startDate: campaignForm.startDate || undefined,
          endDate: campaignForm.endDate || undefined,
          maxParticipants: campaignForm.maxParticipants ? Number(campaignForm.maxParticipants) : undefined,
          targetGroupId: campaignForm.targetGroupId.trim() || undefined,
          inviteLink: campaignForm.inviteLink.trim() || undefined,
          minDaysRequired: campaignForm.minDaysRequired ? Number(campaignForm.minDaysRequired) : 7,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast.error(err.message ?? "Failed to submit campaign");
        return;
      }
      toast.success(t.advertiser.campaignSubmitted);
      setSelectedTemplate(null);
      setCampaignForm({ title: "", budget: "", description: "", targetUrl: "", tags: "", startDate: "", endDate: "", maxParticipants: "", targetGroupId: "", minDaysRequired: "7", inviteLink: "" });
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setCampaignSubmitting(false);
    }
  };

  const handleMissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      router.push("/auth");
      return;
    }
    const budget = parseInt(missionForm.budget);
    if (budget > balance) {
      toast.error(t.advertiser.chargeTitle);
      return;
    }
    try {
      const res = await fetch(`${API}/api/missions/escrow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: missionForm.title,
          description: missionForm.description,
          missionType: missionForm.type,
          totalBudget: budget,
          reward: parseInt(missionForm.reward) || 0,
          maxParticipants: missionForm.maxParticipants ? parseInt(missionForm.maxParticipants) : null,
          startDate: missionForm.startDate,
          endDate: missionForm.endDate,
          requiredTags: missionForm.requiredTags.split(",").map((s) => s.trim()).filter(Boolean),
          targetUrl: missionForm.targetUrl || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { message?: string }).message || "Mission creation failed");
        return;
      }
      toast.success(t.advertiser.submitMission);
      setMissionForm({
        title: "", description: "", type: "", budget: "", reward: "",
        maxParticipants: "", startDate: "", endDate: "", requiredTags: "", targetUrl: "",
        productName: "", website: "", productDesc: "", brandDesc: "", contentType: "", contentOption: "",
      });
    } catch {
      toast.error("Network error. Please try again.");
    }
  };

  const stats = [
    { label: t.advertiser.statActiveMissions, value: "2", icon: Megaphone, color: "text-violet-500" },
    { label: t.advertiser.statParticipants, value: "801", icon: Users, color: "text-cyan-500" },
    { label: t.advertiser.statViews, value: "45,200", icon: Eye, color: "text-amber-500" },
    { label: t.advertiser.statClicks, value: "8,340", icon: MousePointerClick, color: "text-green-500" },
  ];

  const statRows = [
    { label: t.advertiser.statsParticipants, value: "801", icon: Users, change: "+12.3%" },
    { label: t.advertiser.statsPosts, value: "1,240", icon: Tag, change: "+8.7%" },
    { label: t.advertiser.statsViews, value: "45,200", icon: Eye, change: "+23.1%" },
    { label: t.advertiser.statsClicks, value: "8,340", icon: MousePointerClick, change: "+15.4%" },
    { label: t.advertiser.statsTags, value: "#AIM: 1,890", icon: Tag, change: "+31.2%" },
    { label: t.advertiser.statsROI, value: "340%", icon: TrendingUp, change: "+45.0%" },
  ];

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black mb-1">{t.advertiser.title}</h1>
          <p className="text-muted-foreground">{t.advertiser.subtitle}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <Coins className="h-5 w-5 text-violet-500" />
            <span className="text-2xl font-black text-violet-600 dark:text-violet-400">
              {balance.toLocaleString()} AP
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t.advertiser.availableBudget}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <Icon className={`h-5 w-5 ${color} mb-2`} />
              <div className="text-2xl font-black">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="create">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="templates" onClick={loadTemplates}>
            <LayoutTemplate className="h-3.5 w-3.5 mr-1" />
            {t.advertiser.tabBrowse}
          </TabsTrigger>
          <TabsTrigger value="create">{t.advertiser.tabCreate}</TabsTrigger>
          <TabsTrigger value="ai-content">{t.advertiser.tabAI}</TabsTrigger>
          <TabsTrigger value="my-missions">{t.advertiser.tabMyMissions}</TabsTrigger>
          <TabsTrigger value="review" onClick={loadMyCampaigns}>
            <Clock className="h-3.5 w-3.5 mr-1" />
            제출 검토
          </TabsTrigger>
          <TabsTrigger value="charge">{t.advertiser.tabCharge}</TabsTrigger>
          <TabsTrigger value="stats">{t.advertiser.tabStats}</TabsTrigger>
        </TabsList>

        {/* Browse Templates */}
        <TabsContent value="templates">
          {selectedTemplate ? (
            <Card>
              <CardHeader>
                <Button variant="ghost" size="sm" className="w-fit -ml-2 mb-2 gap-1 text-muted-foreground"
                  onClick={() => setSelectedTemplate(null)}>
                  <ArrowLeft className="h-4 w-4" />
                  {t.advertiser.backToTemplates}
                </Button>
                <CardTitle className="flex items-center gap-2">
                  <LayoutTemplate className="h-5 w-5 text-violet-500" />
                  {selectedTemplate.title}
                </CardTitle>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="secondary">{selectedTemplate.type}</Badge>
                  {selectedTemplate.rewardPerUnit && (
                    <Badge variant="outline">{selectedTemplate.rewardPerUnit.toLocaleString()} AP / unit</Badge>
                  )}
                  {selectedTemplate.maxParticipants && (
                    <Badge variant="outline">max {selectedTemplate.maxParticipants}</Badge>
                  )}
                </div>
                {selectedTemplate.description && (
                  <CardDescription className="mt-2">{selectedTemplate.description}</CardDescription>
                )}
                {selectedTemplate.requiredTags && (
                  <p className="text-xs font-mono text-violet-500 mt-1">{selectedTemplate.requiredTags}</p>
                )}
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCampaignRequest} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>{t.advertiser.campaignTitle}</Label>
                    <Input
                      value={campaignForm.title}
                      onChange={(e) => setCampaignForm((p) => ({ ...p, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>{t.advertiser.campaignBudget}</Label>
                      <Input
                        type="number"
                        value={campaignForm.budget}
                        onChange={(e) => setCampaignForm((p) => ({ ...p, budget: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t.advertiser.campaignMaxPart}</Label>
                      <Input
                        type="number"
                        value={campaignForm.maxParticipants}
                        onChange={(e) => setCampaignForm((p) => ({ ...p, maxParticipants: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.advertiser.campaignDescription}</Label>
                    <Textarea
                      rows={3}
                      value={campaignForm.description}
                      onChange={(e) => setCampaignForm((p) => ({ ...p, description: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.advertiser.campaignTargetUrl}</Label>
                    <Input
                      type="url"
                      placeholder="https://"
                      value={campaignForm.targetUrl}
                      onChange={(e) => setCampaignForm((p) => ({ ...p, targetUrl: e.target.value }))}
                    />
                  </div>
                  {selectedTemplate.type === "follow_join" && (
                    <div className="space-y-4 p-4 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/20">
                      <p className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                        📌 Telegram Group Join Settings
                      </p>

                      <div className="space-y-1.5">
                        <Label>Telegram Group ID <span className="text-red-500">*</span></Label>
                        <Input
                          placeholder="-1001234567890"
                          value={campaignForm.targetGroupId}
                          onChange={(e) => setCampaignForm((p) => ({ ...p, targetGroupId: e.target.value }))}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Add <strong>@ai119_reward_bot</strong> to your group as admin first — it will reply with the Group ID automatically.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Invite Link (t.me/...)</Label>
                        <Input
                          placeholder="https://t.me/+xxxxxxxx"
                          value={campaignForm.inviteLink}
                          onChange={(e) => setCampaignForm((p) => ({ ...p, inviteLink: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Shown to members so they know which group to join.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Minimum Days to Stay (체류 최소 일수)</Label>
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={campaignForm.minDaysRequired}
                          onChange={(e) => setCampaignForm((p) => ({ ...p, minDaysRequired: e.target.value }))}
                        >
                          <option value="0">즉시 지급 (권장 안 함)</option>
                          <option value="1">1일 유지 후 지급</option>
                          <option value="3">3일 유지 후 지급</option>
                          <option value="7">7일 유지 후 지급 (추천)</option>
                          <option value="14">14일 유지 후 지급</option>
                          <option value="30">30일 유지 후 지급</option>
                        </select>
                      </div>

                      <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                        <p className="font-semibold">🤖 Bot Setup Instructions</p>
                        <ol className="list-decimal list-inside space-y-0.5">
                          <li>@ai119_reward_bot 을 귀하의 텔레그램 그룹에 초대</li>
                          <li>봇을 <strong>관리자(Admin)</strong>로 설정 (멤버 조회 권한 필요)</li>
                          <li>봇이 그룹 ID를 자동으로 알려줍니다 — 위 필드에 입력하세요</li>
                          <li>미션 승인 후 회원이 그룹 가입 시 자동 추적 시작</li>
                        </ol>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>{t.advertiser.campaignTags}</Label>
                    <Input
                      placeholder="#AIM, #brand"
                      value={campaignForm.tags}
                      onChange={(e) => setCampaignForm((p) => ({ ...p, tags: e.target.value }))}
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>{t.advertiser.campaignStartDate}</Label>
                      <Input
                        type="date"
                        value={campaignForm.startDate}
                        onChange={(e) => setCampaignForm((p) => ({ ...p, startDate: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t.advertiser.campaignEndDate}</Label>
                      <Input
                        type="date"
                        value={campaignForm.endDate}
                        onChange={(e) => setCampaignForm((p) => ({ ...p, endDate: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  {campaignForm.budget && (
                    <div className="p-4 rounded-lg bg-violet-50 dark:bg-violet-950/20 text-sm">
                      <p className="font-semibold mb-2">{t.advertiser.revenueShare}</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded bg-white dark:bg-slate-800">
                          <div className="font-bold text-violet-600">{Math.round(Number(campaignForm.budget) * 0.2).toLocaleString()} AP</div>
                          <div className="text-xs text-muted-foreground">{t.advertiser.platform} (20%)</div>
                        </div>
                        <div className="p-2 rounded bg-white dark:bg-slate-800">
                          <div className="font-bold text-cyan-600">{Math.round(Number(campaignForm.budget) * 0.1).toLocaleString()} AP</div>
                          <div className="text-xs text-muted-foreground">{t.advertiser.mentor} (10%)</div>
                        </div>
                        <div className="p-2 rounded bg-white dark:bg-slate-800">
                          <div className="font-bold text-green-600">{Math.round(Number(campaignForm.budget) * 0.7).toLocaleString()} AP</div>
                          <div className="text-xs text-muted-foreground">{t.advertiser.participant} (70%)</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
                    disabled={campaignSubmitting}
                  >
                    {campaignSubmitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t.advertiser.campaignSubmitting}</>
                    ) : (
                      t.advertiser.campaignSubmitBtn
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="mb-4">
                <h2 className="text-lg font-bold">{t.advertiser.browseTitle}</h2>
                <p className="text-sm text-muted-foreground">{t.advertiser.browseSubtitle}</p>
              </div>
              {templatesLoading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">{t.advertiser.loadingTemplates}</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">{t.advertiser.noTemplates}</div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {templates.map((tpl) => (
                    <Card key={tpl.id} className="hover:border-violet-400 transition-colors cursor-pointer"
                      onClick={() => setSelectedTemplate(tpl)}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-bold leading-tight">{tpl.title}</h3>
                          <Badge variant="secondary" className="text-xs shrink-0">{tpl.type}</Badge>
                        </div>
                        {tpl.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{tpl.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {tpl.rewardPerUnit && (
                            <span>{tpl.rewardPerUnit.toLocaleString()} AP / unit</span>
                          )}
                          {tpl.maxParticipants && (
                            <span>max {tpl.maxParticipants}</span>
                          )}
                        </div>
                        {tpl.requiredTags && (
                          <p className="text-xs font-mono text-violet-500 mt-2">{tpl.requiredTags}</p>
                        )}
                        <Button className="w-full mt-4 bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90" size="sm">
                          {t.advertiser.orderBtn}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Create Mission */}
        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                {t.advertiser.newMissionTitle}
              </CardTitle>
              <CardDescription>{t.advertiser.newMissionDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMissionSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t.advertiser.missionName} *</Label>
                    <Input placeholder="ex) AI CF Video Mission" value={missionForm.title}
                      onChange={(e) => setMissionForm(p => ({ ...p, title: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.advertiser.missionType} *</Label>
                    <Select onValueChange={(v) => setMissionForm(p => ({ ...p, type: v }))}>
                      <SelectTrigger><SelectValue placeholder={t.advertiser.missionType} /></SelectTrigger>
                      <SelectContent>
                        {MISSION_TYPES_EN.map((mt) => (
                          <SelectItem key={mt.value} value={mt.value}>
                            {mt.label} — {mt.price}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{t.advertiser.missionDesc} *</Label>
                  <Textarea placeholder="Describe exactly what participants should do." rows={3}
                    value={missionForm.description}
                    onChange={(e) => setMissionForm(p => ({ ...p, description: e.target.value }))} required />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t.advertiser.totalBudget} (AP) *</Label>
                    <Input type="number" placeholder="1000000" value={missionForm.budget}
                      onChange={(e) => setMissionForm(p => ({ ...p, budget: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.advertiser.rewardPerUnit} (AP) *</Label>
                    <Input type="number" placeholder="5000" value={missionForm.reward}
                      onChange={(e) => setMissionForm(p => ({ ...p, reward: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.advertiser.maxParticipants}</Label>
                    <Input type="number" placeholder="∞" value={missionForm.maxParticipants}
                      onChange={(e) => setMissionForm(p => ({ ...p, maxParticipants: e.target.value }))} />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t.advertiser.startDate} *</Label>
                    <Input type="date" value={missionForm.startDate}
                      onChange={(e) => setMissionForm(p => ({ ...p, startDate: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.advertiser.endDate} *</Label>
                    <Input type="date" value={missionForm.endDate}
                      onChange={(e) => setMissionForm(p => ({ ...p, endDate: e.target.value }))} required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{t.advertiser.requiredTags}</Label>
                  <Input placeholder="#AIM, #brand, #ad" value={missionForm.requiredTags}
                    onChange={(e) => setMissionForm(p => ({ ...p, requiredTags: e.target.value }))} />
                </div>

                <div className="space-y-1.5">
                  <Label>{t.advertiser.targetUrl}</Label>
                  <Input type="url" placeholder="https://your-website.com" value={missionForm.targetUrl}
                    onChange={(e) => setMissionForm(p => ({ ...p, targetUrl: e.target.value }))} />
                </div>

                {missionForm.budget && (
                  <div className="p-4 rounded-lg bg-violet-50 dark:bg-violet-950/20 space-y-2 text-sm">
                    <p className="font-semibold">{t.advertiser.revenueShare}</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded bg-white dark:bg-slate-800">
                        <div className="font-bold text-violet-600">{Math.round(parseInt(missionForm.budget || "0") * 0.2).toLocaleString()} AP</div>
                        <div className="text-xs text-muted-foreground">{t.advertiser.platform} (20%)</div>
                      </div>
                      <div className="p-2 rounded bg-white dark:bg-slate-800">
                        <div className="font-bold text-cyan-600">{Math.round(parseInt(missionForm.budget || "0") * 0.1).toLocaleString()} AP</div>
                        <div className="text-xs text-muted-foreground">{t.advertiser.mentor} (10%)</div>
                      </div>
                      <div className="p-2 rounded bg-white dark:bg-slate-800">
                        <div className="font-bold text-green-600">{Math.round(parseInt(missionForm.budget || "0") * 0.7).toLocaleString()} AP</div>
                        <div className="text-xs text-muted-foreground">{t.advertiser.participant} (70%)</div>
                      </div>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90">
                  {t.advertiser.submitMission}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Content Request */}
        <TabsContent value="ai-content">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.advertiser.advertiserInfo}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t.advertiser.productName}</Label>
                  <Input placeholder="Product or service name" value={missionForm.productName}
                    onChange={(e) => setMissionForm(p => ({ ...p, productName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.advertiser.website}</Label>
                  <Input type="url" placeholder="https://your-website.com" value={missionForm.website}
                    onChange={(e) => setMissionForm(p => ({ ...p, website: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.advertiser.productDesc}</Label>
                  <Textarea placeholder="Detailed product/service description" rows={3} value={missionForm.productDesc}
                    onChange={(e) => setMissionForm(p => ({ ...p, productDesc: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.advertiser.brandDesc}</Label>
                  <Textarea placeholder="Brand concept, tone, target audience" rows={2} value={missionForm.brandDesc}
                    onChange={(e) => setMissionForm(p => ({ ...p, brandDesc: e.target.value }))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.advertiser.aiTypeTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {AI_CONTENT_TYPES.map((type) => (
                  <div
                    key={type.value}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      missionForm.contentType === type.value
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                        : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setMissionForm(p => ({ ...p, contentType: type.value }))}
                  >
                    <p className="font-medium text-sm">{type.label}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {type.options.map((opt) => (
                        <Badge key={opt} variant="secondary" className="text-xs">{opt}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
                <Button className="w-full mt-4 bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90">
                  {t.advertiser.requestAI}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* My Missions */}
        <TabsContent value="my-missions">
          <div className="space-y-4">
            {MY_MISSIONS.map((mission) => {
              const spentPct = (mission.spent / mission.budget) * 100;
              return (
                <Card key={mission.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold">{mission.title}</h3>
                        <Badge variant={mission.status === "active" ? "default" : "secondary"} className="mt-1 text-xs">
                          {mission.status === "active" ? t.advertiser.active : t.advertiser.ended}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-violet-600">{mission.spent.toLocaleString()} AP {t.advertiser.budgetSpent}</div>
                        <div className="text-xs text-muted-foreground">/ {mission.budget.toLocaleString()} AP</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{t.advertiser.budgetProgress}</span>
                          <span>{Math.round(spentPct)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full" style={{ width: `${spentPct}%` }} />
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{mission.participants.toLocaleString()} {t.advertiser.participants}</span>
                        </div>
                        <Button variant="outline" size="sm">{t.advertiser.detailStats}</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Submission Review */}
        <TabsContent value="review">
          {selectedCampaign ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground -ml-2"
                  onClick={() => { setSelectedCampaign(null); setPendingSubmissions([]); }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  미션 목록으로
                </Button>
                <div>
                  <h2 className="font-bold text-sm">{selectedCampaign.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    남은 예산: {(selectedCampaign.remainingBudget ?? 0).toLocaleString()} AP &middot; 승인된 참여자: {selectedCampaign.participantCount ?? 0}명
                  </p>
                </div>
              </div>

              {submissionsLoading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading submissions...</span>
                </div>
              ) : pendingSubmissions.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-400" />
                  검토 대기 중인 제출물이 없습니다
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingSubmissions.map((sub) => (
                    <Card key={sub.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm">{sub.displayName}</span>
                              {sub.platform && (
                                <Badge variant="secondary" className="text-xs">{sub.platform}</Badge>
                              )}
                              <span className="text-xs text-muted-foreground ml-auto">
                                {new Date(sub.createdAt).toLocaleDateString("ko-KR")}
                              </span>
                            </div>
                            {sub.description && (
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{sub.description}</p>
                            )}
                            <a
                              href={sub.postUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline truncate max-w-full"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              {sub.postUrl}
                            </a>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            <Button
                              size="sm"
                              className="bg-green-500 hover:bg-green-600 text-white gap-1"
                              onClick={() => void handleApproveSubmission(sub.id)}
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              승인 +AP
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500 border-red-200 hover:bg-red-50 gap-1"
                              onClick={() => void handleRejectSubmission(sub.id)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              반려
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mb-4">
                <h2 className="text-lg font-bold">제출 검토</h2>
                <p className="text-sm text-muted-foreground">
                  미션을 선택하면 참여자가 제출한 콘텐츠를 확인하고 AP를 지급할 수 있습니다.
                </p>
              </div>
              {campaignsLoading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading campaigns...</span>
                </div>
              ) : myCampaigns.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  <Megaphone className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                  진행 중인 미션이 없습니다
                </div>
              ) : (
                <div className="space-y-3">
                  {myCampaigns.map((campaign) => (
                    <Card
                      key={campaign.id}
                      className="hover:border-violet-400 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedCampaign(campaign);
                        void loadPendingSubmissions(campaign.id);
                      }}
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{campaign.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>남은 예산: {(campaign.remainingBudget ?? 0).toLocaleString()} AP</span>
                            <span>승인 {campaign.participantCount ?? 0}명</span>
                            <Badge
                              variant={campaign.status === "active" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {campaign.status}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Charge */}
        <TabsContent value="charge">
          <div className="space-y-5">
            {/* Telegram Stars */}
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  ⭐ Telegram Stars
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Instant</Badge>
                </CardTitle>
                <CardDescription>
                  Pay with Telegram Stars directly in the bot. 1 Star = 100 AP. Credited instantly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[100, 500, 1000, 5000].map((stars) => (
                    <a
                      key={stars}
                      href={`https://t.me/${botUsername}?start=topup_${stars}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl border-2 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-center transition-colors cursor-pointer block"
                    >
                      <div className="font-black text-amber-500">⭐ {stars}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {(stars * 100).toLocaleString()} AP
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ≈ ${(stars * 100 / 10000).toFixed(2)}
                      </div>
                    </a>
                  ))}
                </div>
                <Button
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => window.open(`https://t.me/${botUsername}?start=topup`, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in Telegram Bot → /topup
                </Button>
              </CardContent>
            </Card>

            {/* TON */}
            <Card className="border-cyan-200 dark:border-cyan-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  💎 TON Wallet Transfer
                </CardTitle>
                <CardDescription>
                  Send TON to the platform wallet. Include your Telegram ID as the transfer comment for identification.
                  Rate: 1 TON ≈ 30,000 AP (based on market price). Admin processes manually within 24h.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tonWallet ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>Platform TON Wallet Address</Label>
                      <div className="flex gap-2">
                        <Input
                          value={tonWallet}
                          readOnly
                          className="font-mono text-sm bg-muted"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(tonWallet)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Your Telegram ID (use as transfer comment/memo)</Label>
                      <div className="flex gap-2">
                        <Input
                          value={user?.telegramId ?? "Login with Telegram to see your ID"}
                          readOnly
                          className="font-mono bg-muted"
                        />
                        {user?.telegramId && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(String(user.telegramId))}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ⚠️ You MUST include your Telegram ID as the comment, otherwise your deposit cannot be matched.
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/20 text-xs text-cyan-700 dark:text-cyan-300 space-y-1">
                      <p className="font-semibold">How to deposit TON</p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>Copy the wallet address above</li>
                        <li>Open your TON wallet (Tonkeeper, Ton Space, etc.)</li>
                        <li>Send TON — paste your Telegram ID in the Comment/Memo field</li>
                        <li>Admin will credit AP to your account within 24 hours</li>
                      </ol>
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center text-muted-foreground text-sm">
                    TON wallet address not configured yet. Contact admin.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* USDT */}
            <Card className="border-green-200 dark:border-green-800 opacity-70">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  💵 USDT
                  <Badge variant="secondary">Coming Soon</Badge>
                </CardTitle>
                <CardDescription>
                  USDT (TRC20 / ERC20) top-up — coming soon.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* AP rate reference */}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium mb-2">AP Rate Reference</p>
                <div className="flex gap-2 flex-wrap">
                  {[10, 50, 100, 500, 1000].map((amt) => (
                    <Badge key={amt} variant="outline" className="px-3 py-1.5 text-sm">
                      ${amt} = {(amt * 10000).toLocaleString()} AP
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5">
                  <Label className="text-xs">{t.advertiser.chargeAmount} (USD)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Custom amount"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                    />
                    <div className="flex items-center px-3 text-sm text-muted-foreground bg-muted rounded-md whitespace-nowrap">
                      = {customAmount ? (parseInt(customAmount) * 10000).toLocaleString() : "0"} AP
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Stats */}
        <TabsContent value="stats">
          <div className="grid md:grid-cols-2 gap-6">
            {statRows.map(({ label, value, icon: Icon, change }) => (
              <Card key={label}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-violet-50 dark:bg-violet-950/20 flex items-center justify-center shrink-0">
                    <Icon className="h-6 w-6 text-violet-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-2xl font-black">{value}</p>
                    <p className="text-sm text-muted-foreground">{label}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                    {change}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
