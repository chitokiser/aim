"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users, Target, Coins, ShieldAlert, CheckCircle, XCircle,
  Search, Bell, Loader2, History, Zap, Bot, LayoutTemplate, Clock, Gavel,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const PENDING_POSTS = [
  { id: "1", user: "aimaster_kim", platform: "Instagram", url: "https://instagram.com/p/ABC", tags: ["#AIM", "#AIcf"], mission: "AI CF 영상", date: "2026-06-14 09:23" },
  { id: "2", user: "creative_lee", platform: "YouTube", url: "https://youtube.com/watch?v=XYZ", tags: ["#AIM", "#AI리뷰"], mission: "블로그 리뷰", date: "2026-06-14 08:45" },
  { id: "3", user: "tonhunter", platform: "Blog", url: "https://blog.example.com/post1", tags: ["#AIM", "#AICMsong"], mission: "CM송 제작", date: "2026-06-14 07:30" },
];

interface Member {
  id: string;
  username?: string;
  firstName?: string;
  telegramId?: string;
  points?: number;
  postCount?: number;
  isAdmin?: boolean;
  createdAt?: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

interface MissionTemplate {
  id: string;
  title: string;
  type: string;
  description?: string;
  rewardPerUnit?: number;
  maxParticipants?: number;
  requiredTags?: string;
  createdAt?: string;
}

interface PendingMission {
  id: string;
  title: string;
  type: string;
  advertiserId: string;
  budget?: number;
  createdAt?: string;
}

const AP_STATUS = [
  { labelKey: "총 발행량", value: "4,200,000,000 AP" },
  { labelKey: "총 지급량", value: "3,150,000,000 AP" },
  { labelKey: "총 소각량", value: "840,000,000 AP" },
  { labelKey: "플랫폼 수익", value: "210,000,000 AP" },
  { labelKey: "멘토 수당", value: "105,000,000 AP" },
  { labelKey: "출금 대기", value: "42,500 AP" },
];

const MISSION_TYPES = ["sns_marketing", "ai_review", "ai_music", "business_content", "sns_sponsorship", "follow_join"];

export default function AdminPage() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Charge AP dialog
  const [chargeTarget, setChargeTarget] = useState<Member | null>(null);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeReason, setChargeReason] = useState("");
  const [charging, setCharging] = useState(false);

  // History dialog
  const [historyTarget, setHistoryTarget] = useState<Member | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Platform vault state
  interface VaultTransaction { id: string; amount: number; missionId: string; description: string; createdAt: string; }
  const [vault, setVault] = useState<{ totalAP: number; transactions: VaultTransaction[] } | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [tplTitle, setTplTitle] = useState("");
  const [tplType, setTplType] = useState(MISSION_TYPES[0]);
  const [tplDesc, setTplDesc] = useState("");
  const [tplReward, setTplReward] = useState("");
  const [tplMaxPart, setTplMaxPart] = useState("");
  const [tplTags, setTplTags] = useState("");
  const [tplSaving, setTplSaving] = useState(false);

  // Pending auctions state
  interface PendingAuction {
    id: string; title: string; category: string; startPrice: number;
    buyNowPrice?: number; endsAt: string; sellerId: string; createdAt?: string;
    description?: string; thumbnailUrl?: string;
  }
  const [pendingAuctions, setPendingAuctions] = useState<PendingAuction[]>([]);
  const [auctionsLoading, setAuctionsLoading] = useState(false);
  const [auctionActioningId, setAuctionActioningId] = useState<string | null>(null);
  const [seedingAuctions, setSeedingAuctions] = useState(false);
  const [deletingSeed, setDeletingSeed] = useState(false);

  // Pending missions state
  const [pending, setPending] = useState<PendingMission[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    if (user && !user.isAdmin) router.push("/");
  }, [user, router]);

  const authHeader = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token],
  );

  const loadMembers = useCallback(async (q?: string) => {
    if (!token) return;
    setMembersLoading(true);
    try {
      const url = `${API}/api/users/admin/list${q ? `?search=${encodeURIComponent(q)}` : ""}`;
      const res = await fetch(url, { headers: authHeader() });
      if (!res.ok) throw new Error();
      setMembers(await res.json());
    } catch {
      toast.error("Failed to load members");
    } finally {
      setMembersLoading(false);
    }
  }, [token, authHeader]);

  useEffect(() => {
    if (user?.isAdmin) loadMembers();
  }, [user, loadMembers]);

  useEffect(() => {
    const timer = setTimeout(() => loadMembers(search), 400);
    return () => clearTimeout(timer);
  }, [search, loadMembers]);

  const loadVault = useCallback(async () => {
    if (!token) return;
    setVaultLoading(true);
    try {
      const res = await fetch(`${API}/api/missions/platform-vault`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      setVault(await res.json());
    } catch {
      toast.error("Failed to load vault");
    } finally {
      setVaultLoading(false);
    }
  }, [token, authHeader]);

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

  const loadPendingAuctions = useCallback(async () => {
    if (!token) return;
    setAuctionsLoading(true);
    try {
      const res = await fetch(`${API}/api/auction/admin/all?status=pending_approval`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      setPendingAuctions(await res.json());
    } catch {
      toast.error("Failed to load pending auctions");
    } finally {
      setAuctionsLoading(false);
    }
  }, [token, authHeader]);

  const handleAuctionApprove = async (id: string) => {
    setAuctionActioningId(id);
    try {
      const res = await fetch(`${API}/api/auction/admin/${id}/approve`, { method: "POST", headers: authHeader() });
      if (!res.ok) throw new Error();
      toast.success("Auction approved");
      setPendingAuctions((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Failed to approve auction");
    } finally {
      setAuctionActioningId(null);
    }
  };

  const handleAuctionStop = async (id: string) => {
    setAuctionActioningId(id);
    try {
      const res = await fetch(`${API}/api/auction/admin/${id}/stop`, { method: "POST", headers: authHeader() });
      if (!res.ok) throw new Error();
      toast.success("Auction stopped");
      setPendingAuctions((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Failed to stop auction");
    } finally {
      setAuctionActioningId(null);
    }
  };

  const handleSeedAuctions = async () => {
    setSeedingAuctions(true);
    try {
      const res = await fetch(`${API}/api/auction/admin/seed/run`, { method: "POST", headers: authHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error();
      if (data.skipped) {
        toast.info("Seed data already exists. Delete first to re-seed.");
      } else {
        toast.success(`${data.inserted} demo auctions added!`);
      }
    } catch {
      toast.error("Failed to seed auction data");
    } finally {
      setSeedingAuctions(false);
    }
  };

  const handleDeleteSeed = async () => {
    if (!confirm("Delete all seed demo auctions? This cannot be undone.")) return;
    setDeletingSeed(true);
    try {
      const res = await fetch(`${API}/api/auction/admin/seed/delete`, { method: "POST", headers: authHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error();
      toast.success(`${data.deleted} seed auctions deleted.`);
    } catch {
      toast.error("Failed to delete seed data");
    } finally {
      setDeletingSeed(false);
    }
  };

  const loadPending = useCallback(async () => {
    if (!token) return;
    setPendingLoading(true);
    try {
      const res = await fetch(`${API}/api/missions?status=pending`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      setPending(await res.json());
    } catch {
      toast.error("Failed to load pending campaigns");
    } finally {
      setPendingLoading(false);
    }
  }, [token, authHeader]);

  const handleCreateTemplate = async () => {
    if (!tplTitle.trim() || !tplDesc.trim()) return;
    setTplSaving(true);
    try {
      const res = await fetch(`${API}/api/missions/template`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          title: tplTitle.trim(),
          type: tplType,
          description: tplDesc.trim(),
          rewardPerUnit: tplReward ? Number(tplReward) : undefined,
          maxParticipants: tplMaxPart ? Number(tplMaxPart) : undefined,
          requiredTags: tplTags.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(t.admin.templateSaved);
      setTplTitle(""); setTplDesc(""); setTplReward(""); setTplMaxPart(""); setTplTags("");
      loadTemplates();
    } catch {
      toast.error("Failed to save template");
    } finally {
      setTplSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/missions/${id}`, { method: "DELETE", headers: authHeader() });
      if (!res.ok && res.status !== 204) throw new Error();
      toast.success(t.admin.templateDeleted);
      setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
    } catch {
      toast.error("Failed to delete template");
    }
  };

  const handleApprove = async (id: string) => {
    setActioningId(id);
    try {
      const res = await fetch(`${API}/api/missions/${id}/approve`, { method: "PATCH", headers: authHeader() });
      if (!res.ok) throw new Error();
      toast.success(t.admin.approveSuccess);
      setPending((prev) => prev.filter((m) => m.id !== id));
    } catch {
      toast.error("Failed to approve mission");
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActioningId(id);
    try {
      const res = await fetch(`${API}/api/missions/${id}/reject`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      toast.success(t.admin.rejectSuccess);
      setPending((prev) => prev.filter((m) => m.id !== id));
      setRejectTargetId(null);
      setRejectReason("");
    } catch {
      toast.error("Failed to reject mission");
    } finally {
      setActioningId(null);
    }
  };

  const openCharge = (member: Member) => {
    setChargeTarget(member);
    setChargeAmount("");
    setChargeReason("");
  };

  const submitCharge = async () => {
    if (!chargeTarget || !chargeAmount || !chargeReason.trim()) return;
    const amount = Number(chargeAmount);
    if (isNaN(amount) || amount === 0) return;
    setCharging(true);
    try {
      const res = await fetch(`${API}/api/users/${chargeTarget.id}/charge-ap`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ amount, reason: chargeReason }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${chargeTarget.firstName ?? chargeTarget.username} — ${t.admin.chargeSuccess}`);
      setChargeTarget(null);
      loadMembers(search);
    } catch {
      toast.error(t.admin.chargeFail);
    } finally {
      setCharging(false);
    }
  };

  const openHistory = async (member: Member) => {
    setHistoryTarget(member);
    setTransactions([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API}/api/users/${member.id}/transactions`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      setTransactions(await res.json());
    } catch {
      toast.error("Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const txTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      admin_charge: t.admin.txTypeAdminCharge,
      post_reward: t.admin.txTypePostReward,
      mission_reward: t.admin.txTypeMissionReward,
      referral_bonus: t.admin.txTypeReferralBonus,
      mentor_bonus: t.admin.txTypeMentorBonus,
      withdrawal: t.admin.txTypeWithdrawal,
    };
    return map[type] ?? type;
  };

  const approvePost = (id: string) => toast.success(`#${id} ${t.admin.approve}`);
  const rejectPost = (id: string) => toast.error(`#${id} ${t.admin.reject}`);
  const suspendUser = (id: string) => toast.warning(`#${id} ${t.admin.suspend}`);
  const sendNotice = () => {
    if (!notice.trim()) return;
    toast.success(t.admin.sendNotice);
    setNotice("");
  };

  const stats = [
    { label: t.admin.statMembers, value: "12,450", icon: Users, color: "text-violet-500" },
    { label: t.admin.statMissions, value: "24", icon: Target, color: "text-cyan-500" },
    { label: t.admin.statAP, value: "4.2B", icon: Coins, color: "text-amber-500" },
    { label: t.admin.statReports, value: "7", icon: ShieldAlert, color: "text-red-500" },
  ];

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black mb-1">{t.admin.title}</h1>
          <p className="text-muted-foreground">{t.admin.subtitle}</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => router.push("/admin/telegram")}
        >
          <Bot className="h-4 w-4" />
          Telegram Settings
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <Icon className={`h-6 w-6 ${color} mb-3`} />
              <div className="text-2xl font-black">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="posts">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="posts">{t.admin.tabPosts}</TabsTrigger>
          <TabsTrigger value="templates" onClick={loadTemplates}>
            <LayoutTemplate className="h-3.5 w-3.5 mr-1" />
            {t.admin.tabTemplates}
          </TabsTrigger>
          <TabsTrigger value="auctions" onClick={loadPendingAuctions}>
            <Gavel className="h-3.5 w-3.5 mr-1" />
            경매 승인
          </TabsTrigger>
          <TabsTrigger value="pending" onClick={loadPending}>
            <Clock className="h-3.5 w-3.5 mr-1" />
            {t.admin.tabPending}
          </TabsTrigger>
          <TabsTrigger value="members">{t.admin.tabMembers}</TabsTrigger>
          <TabsTrigger value="vault" onClick={loadVault}>{t.admin.tabVault}</TabsTrigger>
          <TabsTrigger value="points">{t.admin.tabPoints}</TabsTrigger>
          <TabsTrigger value="notice">{t.admin.tabNotice}</TabsTrigger>
          <TabsTrigger value="tags">{t.admin.tabTags}</TabsTrigger>
        </TabsList>

        {/* Posts Review */}
        <TabsContent value="posts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.admin.postsPending} ({PENDING_POSTS.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {PENDING_POSTS.map((post) => (
                  <div key={post.id} className="p-4 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">@{post.user}</Badge>
                        <Badge variant="secondary">{post.platform}</Badge>
                        <span className="text-xs text-muted-foreground">{post.mission}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {post.tags.map((tag) => (
                          <span key={tag} className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                      <a href={post.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-violet-500 hover:underline truncate block">
                        {post.url}
                      </a>
                      <p className="text-xs text-muted-foreground">{post.date}</p>
                    </div>
                    <div className="flex sm:flex-col gap-2 sm:justify-center">
                      <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white flex-1 sm:flex-none"
                        onClick={() => approvePost(post.id)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> {t.admin.approve}
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1 sm:flex-none"
                        onClick={() => rejectPost(post.id)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> {t.admin.reject}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mission Templates */}
        <TabsContent value="templates">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LayoutTemplate className="h-4 w-4 text-violet-500" />
                  {t.admin.templateTitle}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{t.admin.templateSubtitle}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t.admin.templateName}</Label>
                    <Input value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.admin.templateType}</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                      value={tplType}
                      onChange={(e) => setTplType(e.target.value)}
                    >
                      {MISSION_TYPES.map((mt) => (
                        <option key={mt} value={mt}>{mt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>{t.admin.templateDesc}</Label>
                    <Input value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.admin.templateReward}</Label>
                    <Input type="number" value={tplReward} onChange={(e) => setTplReward(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.admin.templateMaxPart}</Label>
                    <Input type="number" value={tplMaxPart} onChange={(e) => setTplMaxPart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>{t.admin.templateRequiredTags}</Label>
                    <Input value={tplTags} onChange={(e) => setTplTags(e.target.value)} placeholder="#AIM, #AIcreator" />
                  </div>
                </div>
                <Button
                  className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
                  disabled={tplSaving || !tplTitle.trim() || !tplDesc.trim()}
                  onClick={handleCreateTemplate}
                >
                  {tplSaving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t.admin.templateSaving}</>
                  ) : (
                    <><LayoutTemplate className="h-4 w-4 mr-2" />{t.admin.templateSaveBtn}</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.admin.createTemplate} ({templates.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {templatesLoading ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">{t.admin.loadingMissions}</span>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">{t.admin.noTemplates}</div>
                ) : (
                  <div className="divide-y">
                    {templates.map((tpl) => (
                      <div key={tpl.id} className="p-4 flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{tpl.title}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">{tpl.type}</Badge>
                            {tpl.rewardPerUnit && (
                              <span className="text-xs text-muted-foreground">{tpl.rewardPerUnit.toLocaleString()} AP/{t.admin.times}</span>
                            )}
                            {tpl.maxParticipants && (
                              <span className="text-xs text-muted-foreground">max {tpl.maxParticipants}</span>
                            )}
                          </div>
                          {tpl.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{tpl.description}</p>
                          )}
                          {tpl.requiredTags && (
                            <p className="text-xs font-mono text-violet-500 mt-1">{tpl.requiredTags}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 shrink-0"
                          onClick={() => handleDeleteTemplate(tpl.id)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Pending Auction Approvals */}
        <TabsContent value="auctions">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gavel className="h-4 w-4 text-amber-500" />
                    경매 승인 대기 {pendingAuctions.length > 0 && `(${pendingAuctions.length})`}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">승인 후 경매 목록에 공개됩니다.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-400 text-amber-600 hover:bg-amber-50"
                    disabled={seedingAuctions}
                    onClick={handleSeedAuctions}
                  >
                    {seedingAuctions ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
                    시드 데이터 삽입 (100개)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    disabled={deletingSeed}
                    onClick={handleDeleteSeed}
                  >
                    {deletingSeed ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
                    시드 삭제
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {auctionsLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : pendingAuctions.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">승인 대기 중인 경매가 없습니다.</div>
              ) : (
                <div className="divide-y">
                  {pendingAuctions.map((a) => (
                    <div key={a.id} className="p-4 flex items-start gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{a.title}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{a.category}</Badge>
                          <span className="text-xs text-muted-foreground">시작가: {a.startPrice.toLocaleString()} AP</span>
                          {a.buyNowPrice && (
                            <span className="text-xs text-muted-foreground">즉시구매: {a.buyNowPrice.toLocaleString()} AP</span>
                          )}
                          <span className="text-xs text-muted-foreground">마감: {new Date(a.endsAt).toLocaleString("ko-KR")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">판매자 ID: {a.sellerId}</p>
                        {a.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="bg-green-500 hover:bg-green-600 text-white"
                          disabled={auctionActioningId === a.id}
                          onClick={() => handleAuctionApprove(a.id)}
                        >
                          {auctionActioningId === a.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <><CheckCircle className="h-3.5 w-3.5 mr-1" />승인</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={auctionActioningId === a.id}
                          onClick={() => handleAuctionStop(a.id)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />거절
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Campaign Approvals */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                {t.admin.pendingTitle}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{t.admin.pendingSubtitle}</p>
            </CardHeader>
            <CardContent className="p-0">
              {pendingLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">{t.admin.loadingMissions}</span>
                </div>
              ) : pending.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">{t.admin.noPending}</div>
              ) : (
                <div className="divide-y">
                  {pending.map((m) => (
                    <div key={m.id} className="p-4 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{m.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">{t.admin.pendingAdvertiser}: {m.advertiserId}</Badge>
                          <Badge variant="secondary" className="text-xs">{m.type}</Badge>
                          {m.budget && (
                            <span className="text-xs text-muted-foreground">
                              {t.admin.pendingBudget}: {m.budget.toLocaleString()} AP
                            </span>
                          )}
                          {m.createdAt && (
                            <span className="text-xs text-muted-foreground">{m.createdAt.slice(0, 10)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="bg-green-500 hover:bg-green-600 text-white"
                          disabled={actioningId === m.id}
                          onClick={() => handleApprove(m.id)}
                        >
                          {actioningId === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <><CheckCircle className="h-3.5 w-3.5 mr-1" />{t.admin.approve}</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          disabled={actioningId === m.id}
                          onClick={() => { setRejectTargetId(m.id); setRejectReason(""); }}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />{t.admin.reject}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-base">
                  {t.admin.memberMgmt}
                  {members.length > 0 && (
                    <span className="ml-2 text-muted-foreground font-normal text-sm">({members.length})</span>
                  )}
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t.admin.search}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {membersLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">{t.admin.loadingMembers}</span>
                </div>
              ) : (
                <div className="divide-y">
                  {members.map((member) => (
                    <div key={member.id} className="p-4 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{member.firstName || "—"}</span>
                          {member.username && (
                            <span className="text-xs text-muted-foreground">@{member.username}</span>
                          )}
                          {member.isAdmin && (
                            <Badge className="text-xs bg-violet-500">Admin</Badge>
                          )}
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {member.telegramId && <span>TG: {member.telegramId}</span>}
                          <span className="font-medium text-foreground">{(member.points ?? 0).toLocaleString()} AP</span>
                          {member.postCount !== undefined && <span>{member.postCount} posts</span>}
                          {member.createdAt && (
                            <span>{member.createdAt.slice(0, 10)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 border-amber-400 text-amber-600 hover:bg-amber-50"
                          onClick={() => openCharge(member)}
                        >
                          <Zap className="h-3.5 w-3.5" />
                          {t.admin.chargeAp}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => openHistory(member)}
                        >
                          <History className="h-3.5 w-3.5" />
                          {t.admin.history}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => suspendUser(member.id)}
                        >
                          {t.admin.suspend}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {members.length === 0 && !membersLoading && (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No members found
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charge AP Dialog */}
          <Dialog open={!!chargeTarget} onOpenChange={(o) => !o && setChargeTarget(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  {t.admin.chargeApTitle}
                  {chargeTarget && (
                    <span className="font-normal text-muted-foreground text-sm ml-1">
                      — {chargeTarget.firstName || chargeTarget.username}
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {chargeTarget && (
                  <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Balance</span>
                      <span className="font-bold">{(chargeTarget.points ?? 0).toLocaleString()} AP</span>
                    </div>
                    {chargeTarget.telegramId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Telegram ID</span>
                        <span>{chargeTarget.telegramId}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>{t.admin.chargeAmountLabel}</Label>
                  <Input
                    type="number"
                    placeholder={t.admin.chargeAmountPlaceholder}
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                  />
                  {chargeAmount && !isNaN(Number(chargeAmount)) && (
                    <p className="text-xs text-muted-foreground">
                      After charge: {((chargeTarget?.points ?? 0) + Number(chargeAmount)).toLocaleString()} AP
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{t.admin.chargeReasonLabel}</Label>
                  <Input
                    placeholder={t.admin.chargeReasonPlaceholder}
                    value={chargeReason}
                    onChange={(e) => setChargeReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90"
                    disabled={charging || !chargeAmount || !chargeReason.trim()}
                    onClick={submitCharge}
                  >
                    {charging ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t.admin.charging}</>
                    ) : (
                      <><Zap className="h-4 w-4 mr-2" />{t.admin.chargeBtn}</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setChargeTarget(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Transaction History Dialog */}
          <Dialog open={!!historyTarget} onOpenChange={(o) => !o && setHistoryTarget(null)}>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  {t.admin.historyTitle}
                  {historyTarget && (
                    <span className="font-normal text-muted-foreground text-sm ml-1">
                      — {historyTarget.firstName || historyTarget.username}
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto flex-1 mt-2">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    {t.admin.historyEmpty}
                  </div>
                ) : (
                  <div className="divide-y">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="py-3 px-1 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`text-xs ${tx.amount > 0 ? "border-green-400 text-green-600" : "border-red-400 text-red-600"}`}
                            >
                              {txTypeLabel(tx.type)}
                            </Badge>
                          </div>
                          <p className="text-sm mt-0.5 truncate">{tx.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {tx.createdAt?.slice(0, 16).replace("T", " ")}
                          </p>
                        </div>
                        <span className={`text-sm font-bold shrink-0 ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()} AP
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Platform Vault */}
        <TabsContent value="vault">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Coins className="h-5 w-5 text-amber-500" />
                  {t.admin.vaultTitle}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={loadVault}>
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {vaultLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">{t.admin.vaultLoading}</span>
                </div>
              ) : vault ? (
                <div className="space-y-6">
                  <div className="rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200 p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">{t.admin.vaultBalance}</p>
                    <p className="text-4xl font-black text-amber-600">{vault.totalAP.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground mt-1">AP ≈ ${(vault.totalAP / 10000).toFixed(2)} USD</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-3 text-muted-foreground">Recent Transactions</p>
                    {vault.transactions.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">{t.admin.vaultEmpty}</p>
                    ) : (
                      <div className="divide-y">
                        {vault.transactions.map((tx) => (
                          <div key={tx.id} className="py-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{tx.description}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {tx.createdAt?.slice(0, 16).replace("T", " ")}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-amber-600 shrink-0">
                              +{tx.amount.toLocaleString()} AP
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Coins className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p>{t.admin.vaultEmpty}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Points Management */}
        <TabsContent value="points">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">{t.admin.pointManual}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t.admin.targetUser}</label>
                  <Input placeholder="123456" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t.admin.amount}</label>
                  <Input type="number" placeholder="+1000 / -1000" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t.admin.reason}</label>
                  <Input placeholder="event bonus, correction..." />
                </div>
                <Button className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90">
                  {t.admin.processPoints}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">{t.admin.apStatus}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {AP_STATUS.map(({ labelKey, value }) => (
                  <div key={labelKey} className="flex justify-between py-2 border-b last:border-0 text-sm">
                    <span className="text-muted-foreground">{labelKey}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notice */}
        <TabsContent value="notice">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                {t.admin.noticeTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.admin.noticeContent}</label>
                <textarea
                  className="w-full min-h-32 rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={t.admin.noticePlaceholder}
                  value={notice}
                  onChange={(e) => setNotice(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90" onClick={sendNotice}>
                  <Bell className="h-4 w-4 mr-2" />
                  {t.admin.sendNotice}
                </Button>
                <Button variant="outline">{t.admin.preview}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tags */}
        <TabsContent value="tags">
          <Card>
            <CardHeader><CardTitle className="text-base">{t.admin.tagMgmt}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder={t.admin.addTag} className="flex-1" />
                <Button variant="outline">{t.admin.add}</Button>
              </div>
              <div className="space-y-2">
                {["#AIM", "#AIcreator", "#AIcf", "#AICMsong", "#AI리뷰", "#창작"].map((tag) => (
                  <div key={tag} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <span className="font-mono text-sm">{tag}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {t.admin.used} {Math.floor(Math.random() * 2000 + 100)}{t.admin.times}
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 text-red-500 hover:text-red-600">
                        {t.admin.delete}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Mission Dialog */}
      <Dialog open={!!rejectTargetId} onOpenChange={(o) => !o && setRejectTargetId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              {t.admin.reject}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t.admin.rejectReasonLabel}</Label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Budget too low, invalid template..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={actioningId === rejectTargetId}
                onClick={() => rejectTargetId && handleReject(rejectTargetId)}
              >
                {actioningId === rejectTargetId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><XCircle className="h-4 w-4 mr-2" />{t.admin.reject}</>
                )}
              </Button>
              <Button variant="outline" onClick={() => setRejectTargetId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
