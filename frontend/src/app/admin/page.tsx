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
  ShoppingBag, Play, Trash2, ToggleLeft, ToggleRight, Pencil,
  Package, RefreshCw,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";


interface Member {
  id: string;
  username?: string;
  firstName?: string;
  telegramId?: string;
  points?: number;
  freePoints?: number;
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

interface WithdrawalItem {
  id: string;
  userId: string;
  username: string;
  tonWallet: string;
  apAmount: number;
  usdAmount: number;
  status: "pending" | "approved" | "rejected";
  txHash: string | null;
  adminNote: string | null;
  requestedAt: string;
  processedAt: string | null;
}


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

  // Charge P dialog
  const [chargePTarget, setChargePTarget] = useState<Member | null>(null);
  const [chargePAmount, setChargePAmount] = useState("");
  const [chargingP, setChargingP] = useState(false);

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

  // Pending submissions state
  interface PendingSubmission {
    id: string;
    userId: string;
    userName?: string | null;
    username?: string | null;
    missionId: string;
    missionTitle: string;
    description: string;
    status: string;
    createdAt: string;
  }
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionActioningId, setSubmissionActioningId] = useState<string | null>(null);

  // Tags state
  const [tags, setTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [newTag, setNewTag] = useState("");

  // Platform stats state
  interface AdminStats {
    totalMembers: number;
    activeMissions: number;
    totalApIssued: number;
    pendingWithdrawals: number;
    pendingSubmissions: number;
    pendingItems: number;
  }
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Coupang products state
  interface CoupangProduct {
    id: string;
    productNo?: number;
    name: string;
    iframeCode?: string;
    iframeSrc: string;
    iframeWidth: number;
    iframeHeight: number;
    videoUrl?: string | null;
    active: boolean;
    createdAt: string;
  }
  const [coupangProducts, setCoupangProducts] = useState<CoupangProduct[]>([]);
  const [coupangLoading, setCoupangLoading] = useState(false);
  const [coupangIframe, setCoupangIframe] = useState("");
  const [coupangName, setCoupangName] = useState("");
  const [coupangVideo, setCoupangVideo] = useState("");
  const [coupangSaving, setCoupangSaving] = useState(false);
  const [editingCoupangId, setEditingCoupangId] = useState<string | null>(null);
  const [editCoupangName, setEditCoupangName] = useState("");
  const [editCoupangVideo, setEditCoupangVideo] = useState("");
  const [editCoupangIframe, setEditCoupangIframe] = useState("");

  // CJ Shop state
  interface CjSearchResult { id: string; nameEn: string; sku?: string; bigImage?: string; sellPrice?: string }
  interface CjVariant { vid: string; variantNameEn?: string; variantSellPrice?: string; variantImage?: string }
  interface CjProductAdmin {
    id: string; cjProductId: string; cjVariantId: string; nameKo: string;
    images: string[]; cjPriceUsd: number; marginPercent: number; apPrice: number; active: boolean; createdAt: string;
  }
  interface CjOrderAdmin {
    id: string; userId: string; productId: string; quantity: number; apCharged: number;
    status: string; cjStatus: string | null; trackNumber: string | null; createdAt: string;
  }
  const [cjSearchKeyword, setCjSearchKeyword] = useState("");
  const [cjSearchResults, setCjSearchResults] = useState<CjSearchResult[]>([]);
  const [cjSearching, setCjSearching] = useState(false);
  const [cjRegisteringId, setCjRegisteringId] = useState<string | null>(null);
  const [cjDetailVariants, setCjDetailVariants] = useState<CjVariant[]>([]);
  const [cjDetailLoading, setCjDetailLoading] = useState(false);
  const [cjMarginInput, setCjMarginInput] = useState("100");
  const [cjProducts, setCjProducts] = useState<CjProductAdmin[]>([]);
  const [cjProductsLoading, setCjProductsLoading] = useState(false);
  const [editingCjId, setEditingCjId] = useState<string | null>(null);
  const [editCjMargin, setEditCjMargin] = useState("");
  const [cjOrders, setCjOrders] = useState<CjOrderAdmin[]>([]);
  const [cjOrdersLoading, setCjOrdersLoading] = useState(false);
  const [cjRefreshingId, setCjRefreshingId] = useState<string | null>(null);
  const [cjBalance, setCjBalance] = useState<number | null>(null);

  // Withdrawal management state
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState("pending");
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null);
  const [txHashInput, setTxHashInput] = useState("");
  const [rejectWithdrawalId, setRejectWithdrawalId] = useState<string | null>(null);
  const [rejectWithdrawalNote, setRejectWithdrawalNote] = useState("");
  const [withdrawalActioning, setWithdrawalActioning] = useState(false);

  useEffect(() => {
    if (user && !user.isAdmin) router.push("/");
  }, [user, router]);

  const authHeader = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token],
  );

  const loadAdminStats = useCallback(async () => {
    if (!token) return;
    setStatsLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/stats`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      setAdminStats(await res.json());
    } catch {
      // stats fail silently — dashboard still usable
    } finally {
      setStatsLoading(false);
    }
  }, [token, authHeader]);

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
    if (user?.isAdmin) {
      loadMembers();
      void loadAdminStats();
    }
  }, [user, loadMembers, loadAdminStats]);

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      if (data.skipped) {
        toast.info("Seed data already exists. Delete first to re-seed.");
      } else {
        toast.success(`${data.inserted} demo auctions added!`);
      }
    } catch (err) {
      toast.error(`Failed to seed auction data: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSeedingAuctions(false);
    }
  };

  const handleDeleteSeed = async () => {
    if (!confirm("Delete all seed demo auctions? This cannot be undone.")) return;
    setDeletingSeed(true);
    try {
      const res = await fetch(`${API}/api/auction/admin/seed/delete`, { method: "POST", headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      toast.success(`${data.deleted} seed auctions deleted.`);
    } catch (err) {
      toast.error(`Failed to delete seed data: ${err instanceof Error ? err.message : String(err)}`);
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

  const loadTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/tags`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTags(data.tags ?? []);
    } catch {
      toast.error("Failed to load tags");
    } finally {
      setTagsLoading(false);
    }
  }, []);

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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      toast.success(t.admin.approveSuccess);
      setPending((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      toast.error(`Failed to approve: ${err instanceof Error ? err.message : String(err)}`);
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      toast.success(t.admin.rejectSuccess);
      setPending((prev) => prev.filter((m) => m.id !== id));
      setRejectTargetId(null);
      setRejectReason("");
    } catch (err) {
      toast.error(`Failed to reject: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActioningId(null);
    }
  };

  const loadPendingSubmissions = useCallback(async () => {
    if (!token) return;
    setSubmissionsLoading(true);
    try {
      const res = await fetch(`${API}/api/missions/admin/pending-submissions`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      setPendingSubmissions(await res.json());
    } catch {
      toast.error("Failed to load pending submissions");
    } finally {
      setSubmissionsLoading(false);
    }
  }, [token, authHeader]);

  const handleApproveSubmission = async (id: string) => {
    setSubmissionActioningId(id);
    try {
      const res = await fetch(`${API}/api/missions/admin/submissions/${id}/approve`, {
        method: "PATCH",
        headers: authHeader(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      toast.success("Submission approved — AP distributed");
      setPendingSubmissions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmissionActioningId(null);
    }
  };

  const handleRejectSubmission = async (id: string) => {
    setSubmissionActioningId(id);
    try {
      const res = await fetch(`${API}/api/missions/admin/submissions/${id}/reject`, {
        method: "PATCH",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error();
      toast.success("Submission rejected");
      setPendingSubmissions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error("Failed to reject submission");
    } finally {
      setSubmissionActioningId(null);
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

  const submitChargeP = async () => {
    if (!chargePTarget || !chargePAmount) return;
    const amount = Number(chargePAmount);
    if (isNaN(amount) || amount <= 0) return;
    setChargingP(true);
    try {
      const res = await fetch(`${API}/api/users/${chargePTarget.id}/charge-p`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${chargePTarget.firstName ?? chargePTarget.username} — ${amount.toLocaleString()} P 지급 완료`);
      setChargePTarget(null);
      loadMembers(search);
    } catch {
      toast.error("P 지급에 실패했습니다");
    } finally {
      setChargingP(false);
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

  const loadWithdrawals = useCallback(async (status?: string) => {
    if (!token) return;
    setWithdrawalsLoading(true);
    try {
      const qs = status ? `?status=${status}` : "";
      const res = await fetch(`${API}/api/withdrawals/admin/list${qs}`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      setWithdrawals(await res.json());
    } catch {
      toast.error("Failed to load withdrawals");
    } finally {
      setWithdrawalsLoading(false);
    }
  }, [token, authHeader]);

  const handleApproveWithdrawal = async () => {
    if (!approveTargetId) return;
    setWithdrawalActioning(true);
    try {
      const res = await fetch(`${API}/api/withdrawals/${approveTargetId}/approve`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify({ txHash: txHashInput.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      toast.success("Withdrawal approved");
      setApproveTargetId(null);
      setTxHashInput("");
      void loadWithdrawals(withdrawalStatusFilter);
    } catch {
      toast.error("Failed to approve withdrawal");
    } finally {
      setWithdrawalActioning(false);
    }
  };

  const handleRejectWithdrawal = async () => {
    if (!rejectWithdrawalId) return;
    setWithdrawalActioning(true);
    try {
      const res = await fetch(`${API}/api/withdrawals/${rejectWithdrawalId}/reject`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify({ adminNote: rejectWithdrawalNote.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      toast.success("Withdrawal rejected — AP refunded to user");
      setRejectWithdrawalId(null);
      setRejectWithdrawalNote("");
      void loadWithdrawals(withdrawalStatusFilter);
    } catch {
      toast.error("Failed to reject withdrawal");
    } finally {
      setWithdrawalActioning(false);
    }
  };

  const loadCoupangProducts = useCallback(async () => {
    if (!token) return;
    setCoupangLoading(true);
    try {
      const res = await fetch(`${API}/api/coupang/products/all`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      setCoupangProducts(await res.json());
    } catch {
      toast.error("Failed to load Coupang products");
    } finally {
      setCoupangLoading(false);
    }
  }, [token, authHeader]);

  const handleCoupangCreate = async () => {
    if (!coupangIframe.trim()) return;
    setCoupangSaving(true);
    try {
      const res = await fetch(`${API}/api/coupang/products`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          name: coupangName.trim() || undefined,
          iframeCode: coupangIframe.trim(),
          videoUrl: coupangVideo.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("상품이 등록되었습니다");
      setCoupangIframe("");
      setCoupangName("");
      setCoupangVideo("");
      void loadCoupangProducts();
    } catch {
      toast.error("상품 등록에 실패했습니다");
    } finally {
      setCoupangSaving(false);
    }
  };

  const handleCoupangDelete = async (id: string) => {
    if (!confirm("이 상품을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`${API}/api/coupang/products/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error();
      toast.success("삭제되었습니다");
      setCoupangProducts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast.error("삭제에 실패했습니다");
    }
  };

  const handleCoupangToggle = async (p: { id: string; active: boolean }) => {
    try {
      const res = await fetch(`${API}/api/coupang/products/${p.id}`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify({ active: !p.active }),
      });
      if (!res.ok) throw new Error();
      setCoupangProducts((prev) =>
        prev.map((item) => item.id === p.id ? { ...item, active: !item.active } : item),
      );
    } catch {
      toast.error("상태 변경에 실패했습니다");
    }
  };

  const startEditCoupang = (p: CoupangProduct) => {
    setEditingCoupangId(p.id);
    setEditCoupangName(p.name);
    setEditCoupangVideo(p.videoUrl ?? "");
    setEditCoupangIframe(p.iframeCode ?? "");
  };

  const handleCoupangUpdate = async (id: string) => {
    try {
      const body: Record<string, unknown> = {
        name: editCoupangName.trim(),
        videoUrl: editCoupangVideo.trim() || null,
      };
      if (editCoupangIframe.trim()) body.iframeCode = editCoupangIframe.trim();
      const res = await fetch(`${API}/api/coupang/products/${id}`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const iframeSrc = editCoupangIframe.trim()
        ? (editCoupangIframe.match(/src="([^"]+)"/) ?? [])[1] ?? ""
        : undefined;
      setCoupangProducts((prev) =>
        prev.map((item) => item.id === id
          ? {
              ...item,
              name: editCoupangName.trim(),
              videoUrl: editCoupangVideo.trim() || null,
              ...(editCoupangIframe.trim() && {
                iframeCode: editCoupangIframe.trim(),
                iframeSrc: iframeSrc ?? item.iframeSrc,
              }),
            }
          : item),
      );
      toast.success("수정되었습니다");
      setEditingCoupangId(null);
    } catch {
      toast.error("수정에 실패했습니다");
    }
  };

  // ── CJ Shop ────────────────────────────────────────────────────────────

  const loadCjProducts = useCallback(async () => {
    setCjProductsLoading(true);
    try {
      const res = await fetch(`${API}/api/cj-shop/admin/products`, { headers: authHeader() });
      setCjProducts(await res.json());
    } catch {
      toast.error("상품 목록을 불러오지 못했습니다");
    } finally {
      setCjProductsLoading(false);
    }
  }, [authHeader]);

  const loadCjOrders = useCallback(async () => {
    setCjOrdersLoading(true);
    try {
      const res = await fetch(`${API}/api/cj-shop/admin/orders`, { headers: authHeader() });
      setCjOrders(await res.json());
    } catch {
      toast.error("주문 목록을 불러오지 못했습니다");
    } finally {
      setCjOrdersLoading(false);
    }
  }, [authHeader]);

  const loadCjBalance = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/cj-shop/admin/balance`, { headers: authHeader() });
      const data = await res.json() as { balance?: number };
      setCjBalance(typeof data.balance === "number" ? data.balance : null);
    } catch { /* ignore */ }
  }, [authHeader]);

  const loadCjShopData = useCallback(() => {
    void loadCjProducts();
    void loadCjOrders();
    void loadCjBalance();
  }, [loadCjProducts, loadCjOrders, loadCjBalance]);

  const handleCjSearch = async () => {
    if (!cjSearchKeyword.trim()) return;
    setCjSearching(true);
    try {
      const res = await fetch(`${API}/api/cj-shop/admin/search?keyword=${encodeURIComponent(cjSearchKeyword.trim())}`, {
        headers: authHeader(),
      });
      const data = await res.json() as Record<string, unknown>;
      // CJ's listV2 response nests results as data.content[0].productList
      const contentArr = data.content as Array<Record<string, unknown>> | undefined;
      const list = (contentArr?.[0]?.productList ?? []) as CjSearchResult[];
      setCjSearchResults(Array.isArray(list) ? list : []);
    } catch {
      toast.error("검색에 실패했습니다");
    } finally {
      setCjSearching(false);
    }
  };

  const openCjRegister = async (item: CjSearchResult) => {
    setCjRegisteringId(item.id);
    setCjDetailVariants([]);
    setCjMarginInput("100");
    setCjDetailLoading(true);
    try {
      const res = await fetch(`${API}/api/cj-shop/admin/products/${item.id}/detail`, { headers: authHeader() });
      const data = await res.json() as { variants?: CjVariant[] };
      setCjDetailVariants(Array.isArray(data.variants) ? data.variants : []);
    } catch {
      toast.error("상품 상세 조회에 실패했습니다");
    } finally {
      setCjDetailLoading(false);
    }
  };

  const handleCjRegister = async (item: CjSearchResult, variant: CjVariant) => {
    const marginPercent = parseFloat(cjMarginInput);
    try {
      const res = await fetch(`${API}/api/cj-shop/admin/products`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          cjProductId: item.id,
          cjVariantId: variant.vid,
          nameKo: item.nameEn,
          images: [variant.variantImage || item.bigImage].filter(Boolean),
          cjPriceUsd: parseFloat(variant.variantSellPrice || item.sellPrice || "0") || 0,
          marginPercent: isNaN(marginPercent) ? 100 : marginPercent,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast.error(err.message ?? "등록에 실패했습니다");
        return;
      }
      toast.success(t.shop.admin.registerSuccess);
      setCjRegisteringId(null);
      setCjDetailVariants([]);
      void loadCjProducts();
    } catch {
      toast.error("Network error");
    }
  };

  const handleCjMarginSave = async (id: string) => {
    const marginPercent = parseFloat(editCjMargin);
    if (isNaN(marginPercent)) return;
    try {
      const res = await fetch(`${API}/api/cj-shop/admin/products/${id}`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify({ marginPercent }),
      });
      if (!res.ok) { toast.error("수정에 실패했습니다"); return; }
      setEditingCjId(null);
      void loadCjProducts();
    } catch {
      toast.error("Network error");
    }
  };

  const handleCjToggle = async (p: CjProductAdmin) => {
    try {
      const res = await fetch(`${API}/api/cj-shop/admin/products/${p.id}`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify({ active: !p.active }),
      });
      if (!res.ok) { toast.error("수정에 실패했습니다"); return; }
      setCjProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)));
    } catch {
      toast.error("Network error");
    }
  };

  const handleCjDelete = async (id: string) => {
    if (!confirm(t.shop.admin.deleteConfirm)) return;
    try {
      const res = await fetch(`${API}/api/cj-shop/admin/products/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) { toast.error("삭제에 실패했습니다"); return; }
      setCjProducts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast.error("Network error");
    }
  };

  const handleCjRefreshOrder = async (id: string) => {
    setCjRefreshingId(id);
    try {
      const res = await fetch(`${API}/api/cj-shop/admin/orders/${id}/refresh-status`, {
        method: "PATCH",
        headers: authHeader(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast.error(err.message ?? "갱신에 실패했습니다");
        return;
      }
      toast.success(t.shop.admin.refreshSuccess);
      void loadCjOrders();
    } catch {
      toast.error("Network error");
    } finally {
      setCjRefreshingId(null);
    }
  };

  const suspendUser = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/users/${id}/suspend`, {
        method: "PATCH",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as { isSuspended: boolean };
      toast.success(data.isSuspended ? `#${id} ${t.admin.suspend}` : `#${id} 정지 해제됨`);
      loadMembers(search);
    } catch {
      toast.error("사용자 정지에 실패했습니다");
    }
  };

  const sendNotice = async () => {
    if (!notice.trim()) return;
    try {
      const res = await fetch(`${API}/api/admin/notice`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ content: notice }),
      });
      if (!res.ok) throw new Error();
      toast.success(t.admin.sendNotice);
      setNotice("");
    } catch {
      toast.error("공지 전송에 실패했습니다");
    }
  };

  const formatAp = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const stats = [
    {
      label: t.admin.statMembers,
      value: statsLoading ? "…" : adminStats ? adminStats.totalMembers.toLocaleString() : "—",
      icon: Users,
      color: "text-violet-500",
    },
    {
      label: t.admin.statMissions,
      value: statsLoading ? "…" : adminStats ? adminStats.activeMissions.toLocaleString() : "—",
      icon: Target,
      color: "text-cyan-500",
    },
    {
      label: t.admin.statAP,
      value: statsLoading ? "…" : adminStats ? formatAp(adminStats.totalApIssued) : "—",
      icon: Coins,
      color: "text-amber-500",
    },
    {
      label: t.admin.statReports,
      value: statsLoading ? "…" : adminStats ? adminStats.pendingItems.toLocaleString() : "—",
      icon: ShieldAlert,
      color: "text-red-500",
    },
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
          <TabsTrigger value="submissions" onClick={loadPendingSubmissions}>
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
            제출 내역
          </TabsTrigger>
          <TabsTrigger value="tags" onClick={loadTags}>{t.admin.tabTags}</TabsTrigger>
          <TabsTrigger value="withdrawals" onClick={() => void loadWithdrawals("pending")}>
            출금 관리
          </TabsTrigger>
          <TabsTrigger value="coupang" onClick={loadCoupangProducts}>
            <ShoppingBag className="h-3.5 w-3.5 mr-1" />
            쿠팡 상품
          </TabsTrigger>
          <TabsTrigger value="cjshop" onClick={loadCjShopData}>
            <Package className="h-3.5 w-3.5 mr-1" />
            {t.shop.admin.tabTitle}
          </TabsTrigger>
        </TabsList>

        {/* Posts Review */}
        <TabsContent value="posts">
          <Card>
            <CardContent className="py-14 text-center">
              <CheckCircle className="h-10 w-10 mx-auto mb-4 text-muted-foreground/30" />
              <p className="font-semibold mb-1">SNS 게시물 검토</p>
              <p className="text-sm text-muted-foreground">
                미션 게시물 제출 내역은 <strong>제출 내역</strong> 탭에서 확인하고 승인·거절하세요.
              </p>
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
                    <Input value={tplTags} onChange={(e) => setTplTags(e.target.value)} placeholder="#AI119, #AIcreator" />
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

        {/* Submission Review */}
        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                제출 내역 검토
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                회원이 제출한 미션 증빙을 확인하고 AP를 즉시 지급하거나 거절합니다.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {submissionsLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : pendingSubmissions.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">검토 대기 중인 제출이 없습니다.</div>
              ) : (
                <div className="divide-y">
                  {pendingSubmissions.map((s) => {
                    let parsed: Record<string, string> = {};
                    try { parsed = JSON.parse(s.description); } catch { /* raw string */ }
                    const taskUrl = parsed.taskUrl ?? s.description;
                    const myProfile = parsed.myProfile;
                    const screenshot = parsed.screenshot;
                    return (
                      <div key={s.id} className="p-4 flex items-start gap-4 flex-wrap">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-semibold text-sm">{s.missionTitle}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {s.userName || s.username
                                ? `${s.userName ?? ""}${s.username ? ` @${s.username}` : ""}`.trim()
                                : `사용자 ID: ${s.userId}`}
                            </Badge>
                            {s.createdAt && <span>{s.createdAt.slice(0, 16).replace("T", " ")}</span>}
                          </div>
                          {taskUrl && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">과제 URL: </span>
                              <a href={taskUrl} target="_blank" rel="noopener noreferrer"
                                className="text-violet-500 hover:underline break-all">{taskUrl}</a>
                            </div>
                          )}
                          {myProfile && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">내 프로필: </span>
                              <a href={myProfile} target="_blank" rel="noopener noreferrer"
                                className="text-violet-500 hover:underline break-all">{myProfile}</a>
                            </div>
                          )}
                          {screenshot && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">스크린샷: </span>
                              <a href={screenshot} target="_blank" rel="noopener noreferrer"
                                className="text-violet-500 hover:underline break-all">{screenshot}</a>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600 text-white"
                            disabled={submissionActioningId === s.id}
                            onClick={() => handleApproveSubmission(s.id)}
                          >
                            {submissionActioningId === s.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <><CheckCircle className="h-3.5 w-3.5 mr-1" />승인 & AP 지급</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={submissionActioningId === s.id}
                            onClick={() => handleRejectSubmission(s.id)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />거절
                          </Button>
                        </div>
                      </div>
                    );
                  })}
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
                          <span className="font-medium text-violet-600">{(member.freePoints ?? 0).toLocaleString()} P</span>
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
                          className="gap-1 border-violet-400 text-violet-600 hover:bg-violet-50"
                          onClick={() => { setChargePTarget(member); setChargePAmount(""); }}
                        >
                          <Zap className="h-3.5 w-3.5" />
                          P 지급
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

          {/* Charge P Dialog */}
          <Dialog open={!!chargePTarget} onOpenChange={(o) => !o && setChargePTarget(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-violet-500" />
                  P 포인트 지급
                  {chargePTarget && (
                    <span className="font-normal text-muted-foreground text-sm ml-1">
                      — {chargePTarget.firstName || chargePTarget.username}
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {chargePTarget && (
                  <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">현재 P 잔액</span>
                      <span className="font-bold text-violet-600">{(chargePTarget.freePoints ?? 0).toLocaleString()} P</span>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>지급 금액 (P)</Label>
                  <Input
                    type="number"
                    placeholder="예: 10000"
                    value={chargePAmount}
                    onChange={(e) => setChargePAmount(e.target.value)}
                  />
                  {chargePAmount && !isNaN(Number(chargePAmount)) && (
                    <p className="text-xs text-muted-foreground">
                      지급 후: {((chargePTarget?.freePoints ?? 0) + Number(chargePAmount)).toLocaleString()} P
                    </p>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:opacity-90"
                    disabled={chargingP || !chargePAmount || Number(chargePAmount) <= 0}
                    onClick={submitChargeP}
                  >
                    {chargingP ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />지급 중...</>
                    ) : (
                      <><Zap className="h-4 w-4 mr-2" />P 지급</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setChargePTarget(null)}>취소</Button>
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
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t.admin.apStatus}</CardTitle>
                  <button
                    onClick={() => void loadAdminStats()}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {statsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "새로고침"}
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {adminStats ? (
                  <>
                    <div className="flex justify-between py-2 border-b text-sm">
                      <span className="text-muted-foreground">총 회원 수</span>
                      <span className="font-semibold">{adminStats.totalMembers.toLocaleString()} 명</span>
                    </div>
                    <div className="flex justify-between py-2 border-b text-sm">
                      <span className="text-muted-foreground">활성 미션</span>
                      <span className="font-semibold">{adminStats.activeMissions.toLocaleString()} 개</span>
                    </div>
                    <div className="flex justify-between py-2 border-b text-sm">
                      <span className="text-muted-foreground">총 AP 보유량</span>
                      <span className="font-semibold">{adminStats.totalApIssued.toLocaleString()} AP</span>
                    </div>
                    <div className="flex justify-between py-2 border-b text-sm">
                      <span className="text-muted-foreground">출금 대기</span>
                      <span className="font-semibold text-amber-600">{adminStats.pendingWithdrawals.toLocaleString()} 건</span>
                    </div>
                    <div className="flex justify-between py-2 text-sm">
                      <span className="text-muted-foreground">제출 대기</span>
                      <span className="font-semibold text-cyan-600">{adminStats.pendingSubmissions.toLocaleString()} 건</span>
                    </div>
                  </>
                ) : statsLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">로딩 중...</span>
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-6">데이터를 불러올 수 없습니다</p>
                )}
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
                <Input
                  placeholder={t.admin.addTag}
                  className="flex-1"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key !== "Enter") return;
                    const trimmed = newTag.trim();
                    if (!trimmed) return;
                    const tag = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
                    try {
                      const res = await fetch(`${API}/api/admin/tags`, {
                        method: "POST",
                        headers: authHeader(),
                        body: JSON.stringify({ tag }),
                      });
                      if (!res.ok) throw new Error();
                      const data = await res.json();
                      setTags(data.tags);
                      setNewTag("");
                      toast.success("Tag added");
                    } catch {
                      toast.error("Failed to add tag");
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    const trimmed = newTag.trim();
                    if (!trimmed) return;
                    const tag = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
                    try {
                      const res = await fetch(`${API}/api/admin/tags`, {
                        method: "POST",
                        headers: authHeader(),
                        body: JSON.stringify({ tag }),
                      });
                      if (!res.ok) throw new Error();
                      const data = await res.json();
                      setTags(data.tags);
                      setNewTag("");
                      toast.success("Tag added");
                    } catch {
                      toast.error("Failed to add tag");
                    }
                  }}
                >
                  {t.admin.add}
                </Button>
              </div>
              {tagsLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading tags...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div key={tag} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <span className="font-mono text-sm">{tag}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-red-500 hover:text-red-600"
                        onClick={async () => {
                          try {
                            const res = await fetch(
                              `${API}/api/admin/tags/${encodeURIComponent(tag)}`,
                              { method: "DELETE", headers: authHeader() },
                            );
                            if (!res.ok) throw new Error();
                            const data = await res.json();
                            setTags(data.tags);
                            toast.success("Tag deleted");
                          } catch {
                            toast.error("Failed to delete tag");
                          }
                        }}
                      >
                        {t.admin.delete}
                      </Button>
                    </div>
                  ))}
                  {tags.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-6">No tags yet. Add one above.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdrawal Management */}
        <TabsContent value="withdrawals">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Coins className="h-4 w-4 text-violet-500" />
                출금 관리
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status filter */}
              <div className="flex gap-2 flex-wrap">
                {["pending", "approved", "rejected"].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={withdrawalStatusFilter === s ? "default" : "outline"}
                    onClick={() => {
                      setWithdrawalStatusFilter(s);
                      void loadWithdrawals(s);
                    }}
                  >
                    {s === "pending" ? "대기중" : s === "approved" ? "승인완료" : "거절"}
                  </Button>
                ))}
              </div>

              {withdrawalsLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : withdrawals.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">출금 요청이 없습니다</p>
              ) : (
                <div className="divide-y">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="py-4 space-y-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="font-semibold">@{w.username}</div>
                          <div className="text-sm text-muted-foreground">{w.tonWallet}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(w.requestedAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-lg">{w.apAmount.toLocaleString()} AP</div>
                          <div className="text-sm text-muted-foreground">≈ ${w.usdAmount.toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            w.status === "approved"
                              ? "bg-green-500 text-white border-0"
                              : w.status === "rejected"
                              ? "bg-red-500 text-white border-0"
                              : "bg-amber-500 text-white border-0"
                          }
                        >
                          {w.status === "approved" ? "승인완료" : w.status === "rejected" ? "거절" : "대기중"}
                        </Badge>
                        {w.txHash && (
                          <span className="text-xs text-muted-foreground">TX: {w.txHash}</span>
                        )}
                        {w.adminNote && (
                          <span className="text-xs text-red-500">{w.adminNote}</span>
                        )}
                      </div>
                      {w.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => { setApproveTargetId(w.id); setTxHashInput(""); }}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => { setRejectWithdrawalId(w.id); setRejectWithdrawalNote(""); }}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            거절
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Coupang Products */}
        <TabsContent value="coupang">
          <div className="space-y-6">
            {/* Add form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-red-500" />
                  쿠팡 파트너스 상품 등록
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  쿠팡 파트너스에서 받은 iframe 코드를 붙여넣으세요.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>상품명 (선택 — 미입력시 자동 생성)</Label>
                  <Input
                    placeholder="예: 삼성 갤럭시 버즈 3 프로"
                    value={coupangName}
                    onChange={(e) => setCoupangName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>iframe 코드 *</Label>
                  <textarea
                    className="w-full min-h-24 rounded-md border bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder='<iframe src="https://coupa.ng/cnJKHV" width="120" height="240" frameborder="0" scrolling="no" referrerpolicy="unsafe-url" browsingtopics></iframe>'
                    value={coupangIframe}
                    onChange={(e) => setCoupangIframe(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Play className="h-3.5 w-3.5 text-red-500" />
                    상품 영상 링크 (선택 — YouTube 또는 직접 영상 URL)
                  </Label>
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={coupangVideo}
                    onChange={(e) => setCoupangVideo(e.target.value)}
                  />
                </div>
                <Button
                  className="bg-gradient-to-r from-red-500 to-orange-500 text-white hover:opacity-90"
                  disabled={coupangSaving || !coupangIframe.trim()}
                  onClick={handleCoupangCreate}
                >
                  {coupangSaving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />등록 중...</>
                  ) : (
                    <><ShoppingBag className="h-4 w-4 mr-2" />상품 등록</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Product list */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    등록된 상품 {coupangProducts.length > 0 && `(${coupangProducts.length})`}
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={loadCoupangProducts}>
                    새로고침
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {coupangLoading ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">불러오는 중...</span>
                  </div>
                ) : coupangProducts.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    등록된 상품이 없습니다.
                  </div>
                ) : (
                  <div className="divide-y">
                    {coupangProducts.map((p) => (
                      <div key={p.id} className="p-4 border-b last:border-b-0">
                        <div className="flex items-start gap-4 flex-wrap">
                          {/* Preview iframe */}
                          <div className="shrink-0 bg-muted/30 rounded p-1 flex items-center justify-center" style={{ minWidth: 80 }}>
                            <iframe
                              srcDoc={(() => {
                                const w = Math.min(p.iframeWidth || 120, 120);
                                const h = Math.min(p.iframeHeight || 240, 200);
                                const code = p.iframeCode || `<iframe src="${p.iframeSrc}" width="${w}" height="${h}" frameborder="0" scrolling="no" referrerpolicy="unsafe-url"></iframe>`;
                                return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;}body{overflow:hidden;}iframe{display:block;margin-top:-28px;}</style></head><body>${code}</body></html>`;
                              })()}
                              width={Math.min(p.iframeWidth || 120, 120)}
                              height={Math.min(p.iframeHeight || 240, 200) - 28}
                              frameBorder="0"
                              scrolling="no"
                              title={p.name}
                            />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="font-mono text-xs">#{p.productNo ?? "—"}</Badge>
                              {!p.active && <Badge variant="secondary" className="text-xs">비활성</Badge>}
                            </div>
                            <p className="font-semibold text-sm">{p.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.iframeSrc}</p>
                            {p.videoUrl && (
                              <div className="flex items-center gap-1 text-xs text-red-500">
                                <Play className="h-3 w-3 fill-current" />
                                <a href={p.videoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-xs">
                                  {p.videoUrl}
                                </a>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {p.createdAt?.slice(0, 10)}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => editingCoupangId === p.id ? setEditingCoupangId(null) : startEditCoupang(p)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              title={p.active ? "비활성화" : "활성화"}
                              onClick={() => void handleCoupangToggle(p)}
                            >
                              {p.active ? (
                                <ToggleRight className="h-4 w-4 text-green-500" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void handleCoupangDelete(p.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Inline edit form */}
                        {editingCoupangId === p.id && (
                          <div className="mt-3 ml-24 space-y-2 p-3 bg-muted/30 rounded-lg border">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">상품명</label>
                              <Input
                                value={editCoupangName}
                                onChange={(e) => setEditCoupangName(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="상품명"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">iframe 코드 (수정 시 입력)</label>
                              <textarea
                                className="w-full min-h-20 rounded-md border bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder='<iframe src="https://coupa.ng/..." width="120" height="240" ...></iframe>'
                                value={editCoupangIframe}
                                onChange={(e) => setEditCoupangIframe(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">영상 URL (선택)</label>
                              <Input
                                value={editCoupangVideo}
                                onChange={(e) => setEditCoupangVideo(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="YouTube 또는 직접 영상 URL"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => void handleCoupangUpdate(p.id)}>저장</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingCoupangId(null)}>취소</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CJ Shop */}
        <TabsContent value="cjshop">
          <div className="space-y-6">
            {/* Balance */}
            <Card className={cjBalance !== null && cjBalance < 50 ? "border-red-300" : ""}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">{t.shop.admin.balanceLabel}</span>
                  <span className="font-bold">{cjBalance !== null ? `$${cjBalance.toLocaleString()}` : "—"}</span>
                </div>
                <Button size="sm" variant="outline" onClick={loadCjBalance}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
              {cjBalance !== null && cjBalance < 50 && (
                <CardContent className="pt-0">
                  <p className="text-xs text-red-500">{t.shop.admin.balanceLow}</p>
                </CardContent>
              )}
            </Card>

            {/* Search + register */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4 text-violet-500" />
                  CJ Dropshipping 상품 검색
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder={t.shop.admin.searchPlaceholder}
                    value={cjSearchKeyword}
                    onChange={(e) => setCjSearchKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void handleCjSearch()}
                  />
                  <Button disabled={cjSearching} onClick={() => void handleCjSearch()}>
                    {cjSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : t.shop.admin.searchBtn}
                  </Button>
                </div>

                {cjSearchResults.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {cjSearchResults.map((item) => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex gap-3">
                          {item.bigImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.bigImage} alt={item.nameEn} className="h-16 w-16 rounded object-cover shrink-0" />
                          ) : (
                            <div className="h-16 w-16 rounded bg-muted flex items-center justify-center shrink-0">
                              <Package className="h-6 w-6 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2">{item.nameEn}</p>
                            <p className="text-xs text-muted-foreground">${item.sellPrice ?? "?"}</p>
                            <Button size="sm" variant="outline" className="mt-1.5 h-7 text-xs" onClick={() => void openCjRegister(item)}>
                              {t.shop.admin.registerBtn}
                            </Button>
                          </div>
                        </div>

                        {cjRegisteringId === item.id && (
                          <div className="p-3 bg-muted/30 rounded-lg border space-y-2">
                            {cjDetailLoading ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 불러오는 중...
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs shrink-0">{t.shop.admin.marginLabel}</Label>
                                  <Input
                                    type="number"
                                    className="h-8 text-sm w-24"
                                    value={cjMarginInput}
                                    onChange={(e) => setCjMarginInput(e.target.value)}
                                  />
                                </div>
                                {cjDetailVariants.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">변형 정보를 찾을 수 없습니다.</p>
                                ) : (
                                  cjDetailVariants.map((v) => (
                                    <div key={v.vid} className="flex items-center justify-between gap-2 text-xs">
                                      <span className="truncate">{v.variantNameEn || v.vid} — ${v.variantSellPrice}</span>
                                      <Button size="sm" className="h-7 text-xs shrink-0" onClick={() => void handleCjRegister(item, v)}>
                                        {t.shop.admin.registerBtn}
                                      </Button>
                                    </div>
                                  ))
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Registered products */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {t.shop.admin.registeredTitle} {cjProducts.length > 0 && `(${cjProducts.length})`}
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={loadCjProducts}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {cjProductsLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : cjProducts.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">등록된 상품이 없습니다.</div>
                ) : (
                  <div className="divide-y">
                    {cjProducts.map((p) => (
                      <div key={p.id} className="p-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          {p.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.images[0]} alt={p.nameKo} className="h-12 w-12 rounded object-cover shrink-0" />
                          ) : (
                            <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
                              <Package className="h-5 w-5 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{p.nameKo}</p>
                            <p className="text-xs text-muted-foreground">
                              ${p.cjPriceUsd} · {p.marginPercent}% → {p.apPrice.toLocaleString()} AP
                            </p>
                          </div>
                          <Badge variant={p.active ? "outline" : "secondary"} className="text-xs shrink-0">
                            {p.active ? t.shop.admin.activeLabel : t.shop.admin.inactiveLabel}
                          </Badge>
                          <div className="flex gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (editingCjId === p.id) { setEditingCjId(null); return; }
                                setEditingCjId(p.id);
                                setEditCjMargin(String(p.marginPercent));
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void handleCjToggle(p)}>
                              {p.active ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => void handleCjDelete(p.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {editingCjId === p.id && (
                          <div className="mt-3 ml-16 flex items-center gap-2">
                            <Label className="text-xs shrink-0">{t.shop.admin.marginLabel}</Label>
                            <Input
                              type="number"
                              className="h-8 text-sm w-24"
                              value={editCjMargin}
                              onChange={(e) => setEditCjMargin(e.target.value)}
                            />
                            <Button size="sm" onClick={() => void handleCjMarginSave(p.id)}>저장</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingCjId(null)}>취소</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Orders */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {t.shop.admin.ordersTitle} {cjOrders.length > 0 && `(${cjOrders.length})`}
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={loadCjOrders}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {cjOrdersLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : cjOrders.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">{t.shop.noOrders}</div>
                ) : (
                  <div className="divide-y">
                    {cjOrders.map((o) => (
                      <div key={o.id} className="p-3 flex items-center gap-3 flex-wrap text-sm">
                        <Badge variant={o.status === "paid" ? "outline" : "secondary"} className="text-xs shrink-0">
                          {o.status === "paid" ? t.shop.orderStatusPaid : t.shop.orderStatusFailed}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{o.cjStatus ?? "—"}</span>
                        <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
                          {o.trackNumber ? `${t.shop.trackingLabel}: ${o.trackNumber}` : ""}
                        </span>
                        <span className="text-xs font-bold text-violet-600 shrink-0">{o.apCharged.toLocaleString()} AP</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={cjRefreshingId === o.id}
                          onClick={() => void handleCjRefreshOrder(o.id)}
                        >
                          {cjRefreshingId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.shop.admin.refreshBtn}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Approve Withdrawal Dialog */}
      <Dialog open={!!approveTargetId} onOpenChange={(o) => !o && setApproveTargetId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              출금 승인
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>TON TX Hash (선택)</Label>
              <Input
                value={txHashInput}
                onChange={(e) => setTxHashInput(e.target.value)}
                placeholder="TON 트랜잭션 해시 입력..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={withdrawalActioning}
                onClick={() => void handleApproveWithdrawal()}
              >
                {withdrawalActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : "승인 확정"}
              </Button>
              <Button variant="outline" onClick={() => setApproveTargetId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Withdrawal Dialog */}
      <Dialog open={!!rejectWithdrawalId} onOpenChange={(o) => !o && setRejectWithdrawalId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              출금 거절 (AP 환불)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>거절 사유</Label>
              <Input
                value={rejectWithdrawalNote}
                onChange={(e) => setRejectWithdrawalNote(e.target.value)}
                placeholder="거절 사유를 입력하세요..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={withdrawalActioning}
                onClick={() => void handleRejectWithdrawal()}
              >
                {withdrawalActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : "거절 및 AP 환불"}
              </Button>
              <Button variant="outline" onClick={() => setRejectWithdrawalId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
