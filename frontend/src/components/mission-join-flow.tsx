"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import {
  Coins, Users, CheckCircle, Heart, ExternalLink,
  Building2, CalendarDays, Wallet, Loader2, Film,
} from "lucide-react";

const API = "https://ai119-bot-production.up.railway.app";

// ─── Shared type ────────────────────────────────────────────────────────────

export interface MissionFlowData {
  id: string;
  title: string;
  description: string;
  reward: number;
  remainingBudget: number;
  totalBudget: number;
  endDate: Date;
  requiredTags: string[];
  participantCount: number;
  missionType: string;
  status: "active" | "ended" | "pending";
  advertiserName: string;
}

// ─── Mock helpers ────────────────────────────────────────────────────────────

function mockAdvertisers(base: MissionFlowData): MissionFlowData[] {
  return [
    base,
    {
      ...base,
      id: `${base.id}-b`,
      advertiserName: "MediaPro",
      title: `${base.title} — MediaPro`,
      reward: Math.floor(base.reward * 0.8),
      totalBudget: Math.floor(base.totalBudget * 0.6),
      remainingBudget: Math.floor(base.totalBudget * 0.5),
      participantCount: Math.floor(base.participantCount * 0.55),
    },
    {
      ...base,
      id: `${base.id}-c`,
      advertiserName: "StartupX",
      title: `${base.title} — StartupX`,
      reward: Math.floor(base.reward * 1.2),
      totalBudget: Math.floor(base.totalBudget * 0.35),
      remainingBudget: Math.floor(base.totalBudget * 0.3),
      participantCount: Math.floor(base.participantCount * 0.25),
    },
  ];
}

interface SubmissionRow {
  id: string;
  username: string;
  likes: number;
  isLiked: boolean;
  estimatedAP: number;
}

function calcEstimated(rows: SubmissionRow[], budget: number): SubmissionRow[] {
  const total = rows.reduce((s, r) => s + r.likes, 0);
  return rows.map((r) => ({
    ...r,
    estimatedAP: total > 0 ? Math.floor((r.likes / total) * budget * 0.7) : 0,
  }));
}

// ─── Submissions Board ────────────────────────────────────────────────────────

function SubmissionsBoard({
  missionId,
  totalBudget,
  daysLeft,
}: {
  missionId: string;
  totalBudget: number;
  daysLeft: number;
}) {
  const { t } = useLanguage();
  const mf = t.missionFlow;
  const { token } = useAuthStore();

  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/missions/${encodeURIComponent(missionId)}/submissions`);
      if (res.ok) {
        const data = (await res.json()) as Array<Record<string, unknown>>;
        const mapped = data.map((s) => ({
          id: s.id as string,
          username:
            (s.displayName as string) ||
            `User #${((s.userId as string) || '').slice(-4) || '????'}`,
          likes: (s.likes as number) || 0,
          isLiked: false,
          estimatedAP: 0,
        }));
        setRows(calcEstimated(mapped, totalBudget));
      }
    } catch {
      // silent — keep empty list
    } finally {
      setLoading(false);
    }
  }, [missionId, totalBudget]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleLike = async (id: string) => {
    if (!token) {
      toast.error(mf.loginToVote);
      return;
    }

    // Optimistic toggle
    setRows((prev) => {
      const updated = prev.map((r) =>
        r.id === id
          ? { ...r, likes: r.isLiked ? r.likes - 1 : r.likes + 1, isLiked: !r.isLiked }
          : r,
      );
      return calcEstimated(updated, totalBudget);
    });

    try {
      const res = await fetch(`${API}/api/missions/submissions/${id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Revert on failure
        setRows((prev) => {
          const reverted = prev.map((r) =>
            r.id === id
              ? { ...r, likes: r.isLiked ? r.likes + 1 : r.likes - 1, isLiked: !r.isLiked }
              : r,
          );
          return calcEstimated(reverted, totalBudget);
        });
      } else {
        // Update from server response
        const result = (await res.json()) as { liked: boolean; likes: number };
        setRows((prev) => {
          const synced = prev.map((r) =>
            r.id === id ? { ...r, likes: result.likes, isLiked: result.liked } : r,
          );
          return calcEstimated(synced, totalBudget);
        });
      }
    } catch {
      // Revert on network error
      setRows((prev) => {
        const reverted = prev.map((r) =>
          r.id === id
            ? { ...r, likes: r.isLiked ? r.likes + 1 : r.likes - 1, isLiked: !r.isLiked }
            : r,
        );
        return calcEstimated(reverted, totalBudget);
      });
    }
  };

  const sorted = [...rows].sort((a, b) => b.likes - a.likes);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">{mf.submissionsTitle}</h3>
        <Badge variant="outline" className="text-xs">
          {mf.settleIn.replace("{n}", String(daysLeft))}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{mf.voteNote}</p>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {mf.loading}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-center text-muted-foreground py-6">{mf.noSubmissions}</p>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((row, rank) => (
            <div key={row.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                {rank + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">@{row.username}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {row.likes.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1 text-violet-600 font-medium">
                    <Coins className="h-3 w-3" />
                    ~{row.estimatedAP.toLocaleString()} AP
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant={row.isLiked ? "default" : "outline"}
                className={`shrink-0 text-xs h-8 px-3 ${
                  row.isLiked ? "bg-pink-500 hover:bg-pink-600 border-pink-500 text-white" : ""
                }`}
                onClick={() => handleLike(row.id)}
              >
                <Heart className={`h-3.5 w-3.5 mr-1 ${row.isLiked ? "fill-current" : ""}`} />
                {row.isLiked ? mf.liked : mf.likeBtn}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Submit Links Modal ───────────────────────────────────────────────────────

interface SubmitLinksModalProps {
  mission: MissionFlowData | null;
  open: boolean;
  onClose: () => void;
}

export function SubmitLinksModal({ mission, open, onClose }: SubmitLinksModalProps) {
  const { t } = useLanguage();
  const mf = t.missionFlow;
  const { token } = useAuthStore();

  const [links, setLinks] = useState({ youtube: "", blog: "", comment: "", screenshot: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Object.values(links).some((l) => l.trim())) {
      toast.error(mf.atLeastOneLink);
      return;
    }
    if (!token) {
      toast.error(mf.loginToVote);
      return;
    }

    setSubmitting(true);
    try {
      const primaryUrl =
        links.youtube || links.blog || links.comment || links.screenshot || "";
      const platform = links.youtube ? "YouTube" : links.blog ? "Blog" : "Multi";

      const res = await fetch(`${API}/api/missions/submit-general`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          missionId: mission!.id,
          section: mission!.missionType,
          platform,
          postUrl: primaryUrl,
          description: JSON.stringify(links),
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ message: "Submit failed" }))) as {
          message?: string;
        };
        throw new Error(err.message || "Submit failed");
      }

      setSubmitted(true);
      toast.success(mf.submitted);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setLinks({ youtube: "", blog: "", comment: "", screenshot: "" });
    setSubmitted(false);
    onClose();
  };

  if (!mission) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{submitted ? mf.submitted : mf.submitTitle}</DialogTitle>
        </DialogHeader>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
            <p className="text-sm text-muted-foreground">{mf.submitDesc}</p>

            {(
              [
                { key: "youtube", label: mf.linkYoutube, placeholder: "https://youtube.com/..." },
                { key: "blog", label: mf.linkBlog, placeholder: "https://instagram.com/p/..." },
                { key: "comment", label: `${mf.linkComment} ${mf.optional}`, placeholder: "https://..." },
                { key: "screenshot", label: `${mf.linkScreenshot} ${mf.optional}`, placeholder: "https://drive.google.com/..." },
              ] as const
            ).map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-sm">{label}</Label>
                <div className="relative">
                  <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder={placeholder}
                    value={links[key as keyof typeof links]}
                    onChange={(e) =>
                      setLinks((p) => ({ ...p, [key]: e.target.value }))
                    }
                    className="pl-9"
                  />
                </div>
              </div>
            ))}

            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <Wallet className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-700 dark:text-amber-400">{mf.escrowNote}</p>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {mf.submitting}
                </>
              ) : (
                mf.submitBtn
              )}
            </Button>
          </form>
        ) : (
          <div className="space-y-4 mt-1">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <CheckCircle className="h-7 w-7 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">{mf.submitted}</p>
                <p className="text-sm text-green-600 dark:text-green-500 mt-1">{mf.submittedDesc}</p>
              </div>
            </div>
            <SubmissionsBoard missionId={mission.id} totalBudget={mission.totalBudget} daysLeft={10} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Mission Detail Sheet ─────────────────────────────────────────────────────

interface MissionDetailSheetProps {
  mission: MissionFlowData | null;
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function MissionDetailSheet({ mission, open, onClose, onSubmit }: MissionDetailSheetProps) {
  const { t } = useLanguage();
  const mf = t.missionFlow;

  if (!mission) return null;

  const budgetUsed =
    ((mission.totalBudget - mission.remainingBudget) / mission.totalBudget) * 100;
  const endStr =
    mission.endDate instanceof Date
      ? mission.endDate.toLocaleDateString()
      : String(mission.endDate);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-5">
          <SheetTitle>{mf.detailTitle}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* Advertiser badge */}
          <div className="flex items-center gap-3 p-4 rounded-xl border">
            <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{mf.advertiserInfo}</p>
              <p className="font-bold">{mission.advertiserName}</p>
            </div>
          </div>

          {/* Title & description */}
          <div>
            <h2 className="font-black text-lg mb-2">{mission.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{mission.description}</p>
          </div>

          {/* Required tags */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{mf.missionConditions}</p>
            <div className="flex flex-wrap gap-1.5">
              {mission.requiredTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="font-mono text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Reward method */}
          <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 space-y-1.5">
            <p className="text-xs font-semibold text-violet-700 dark:text-violet-400">
              {mf.rewardMethod}
            </p>
            {(mission.missionType === 'telegram_join' || mission.missionType === 'follow_join') ? (
              <>
                <p className="text-xs text-violet-600 dark:text-violet-500">{mf.instantRewardNote}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{mf.blacklistWarning}</p>
              </>
            ) : (
              <>
                <p className="text-xs text-violet-600 dark:text-violet-500">{mf.likeBasedNote}</p>
                <p className="text-xs text-muted-foreground">{mf.escrowNote}</p>
              </>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: CalendarDays, label: mf.endDate, value: endStr, color: "text-muted-foreground" },
              { icon: Coins, label: mf.totalBudget, value: `${(mission.totalBudget / 10000).toFixed(0)}만 AP`, color: "text-violet-500" },
              { icon: Users, label: mf.participants, value: mission.participantCount.toLocaleString(), color: "text-cyan-500" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="text-center p-3 rounded-lg border">
                <Icon className={`h-4 w-4 mx-auto ${color} mb-1`} />
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xs font-semibold">{value}</p>
              </div>
            ))}
          </div>

          {/* Budget bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t.missionCard.budget}</span>
              <span>{Math.round(budgetUsed)}%</span>
            </div>
            <Progress value={budgetUsed} className="h-2" />
          </div>

          <Button
            className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
            onClick={() => { onClose(); onSubmit(); }}
          >
            {mf.submitWork}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Advertiser List Modal ────────────────────────────────────────────────────

interface AdvertiserListModalProps {
  mission: MissionFlowData | null;
  open: boolean;
  onClose: () => void;
  onViewDetail: (m: MissionFlowData) => void;
  onSubmitWork: (m: MissionFlowData) => void;
}

export function AdvertiserListModal({
  mission,
  open,
  onClose,
  onViewDetail,
  onSubmitWork,
}: AdvertiserListModalProps) {
  const { t } = useLanguage();
  const mf = t.missionFlow;

  const [advertisers, setAdvertisers] = useState<MissionFlowData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !mission) return;

    const fetchMissions = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/missions?status=active`);
        if (res.ok) {
          const data = (await res.json()) as Array<Record<string, unknown>>;
          const filtered = data
            .filter(
              (m) =>
                (m.missionType as string) === mission.missionType ||
                (m.section as string) === mission.missionType,
            )
            .map((m) => ({
              id: m.id as string,
              title: (m.title as string) || mission.title,
              description: (m.description as string) || mission.description,
              reward: (m.reward as number) || mission.reward,
              remainingBudget: (m.remainingBudget as number) || 0,
              totalBudget: (m.totalBudget as number) || 0,
              endDate: m.endDate ? new Date(m.endDate as string) : mission.endDate,
              requiredTags: (m.requiredTags as string[]) || [],
              participantCount: (m.participantCount as number) || 0,
              missionType: mission.missionType,
              status: "active" as const,
              advertiserName:
                (m.advertiserName as string) ||
                (m.advertiserId as string)?.slice(-6) ||
                "Advertiser",
            }));

          setAdvertisers(filtered.length > 0 ? filtered : mockAdvertisers(mission));
        } else {
          setAdvertisers(mockAdvertisers(mission));
        }
      } catch {
        setAdvertisers(mockAdvertisers(mission));
      } finally {
        setLoading(false);
      }
    };

    fetchMissions();
  }, [open, mission]);

  if (!mission) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mf.advertisers}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2 mb-2">{mf.selectAdvertiser}</p>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            {mf.loading}
          </div>
        ) : (
          <div className="space-y-4">
            {advertisers.map((adv) => {
              const budgetUsed =
                adv.totalBudget > 0
                  ? ((adv.totalBudget - adv.remainingBudget) / adv.totalBudget) * 100
                  : 0;
              const endStr =
                adv.endDate instanceof Date
                  ? adv.endDate.toLocaleDateString()
                  : String(adv.endDate);

              return (
                <Card key={adv.id} className="border shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-violet-600" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{adv.advertiserName}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{adv.title}</p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-300 text-xs shrink-0"
                      >
                        {t.admin.active}
                      </Badge>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                      <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">{mf.totalBudget}</p>
                        <p className="text-sm font-bold text-violet-600">
                          {(adv.totalBudget / 10000).toFixed(0)}만 AP
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">{mf.endDate}</p>
                        <p className="text-sm font-bold">{endStr}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">{mf.participants}</p>
                        <p className="text-sm font-bold">{adv.participantCount.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Budget bar */}
                    <div className="space-y-1 mb-4">
                      <Progress value={budgetUsed} className="h-1.5" />
                      <p className="text-xs text-muted-foreground text-right">
                        {Math.round(budgetUsed)}% used
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onViewDetail(adv)}
                      >
                        {mf.viewDetail}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
                        onClick={() => onSubmitWork(adv)}
                      >
                        {mf.submitWork}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── CF Ad Request Modal ──────────────────────────────────────────────────────

interface CfAdRequestModalProps {
  open: boolean;
  onClose: () => void;
}

export function CfAdRequestModal({ open, onClose }: CfAdRequestModalProps) {
  const { t } = useLanguage();
  const ca = t.cfAd;
  const router = useRouter();
  const { user, token } = useAuthStore();

  const [form, setForm] = useState({
    brandName: "",
    campaignTitle: "",
    campaignDesc: "",
    productUrl: "",
    totalBudget: "",
    rewardPerVideo: "",
    requiredTags: "#AIM",
    endDate: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleClose = () => {
    setForm({
      brandName: "",
      campaignTitle: "",
      campaignDesc: "",
      productUrl: "",
      totalBudget: "",
      rewardPerVideo: "",
      requiredTags: "#AIM",
      endDate: "",
    });
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user) return;

    const budget = parseInt(form.totalBudget, 10);
    const rewardPer = parseInt(form.rewardPerVideo, 10);

    if (!budget || budget < 100000) {
      toast.error("Minimum budget is 100,000 AP");
      return;
    }
    if (!rewardPer || rewardPer <= 0) {
      toast.error("Reward per video must be greater than 0");
      return;
    }
    if (user.points < budget) {
      toast.error(ca.insufficientBalance);
      return;
    }

    const tags = form.requiredTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const description =
      `${form.campaignDesc}\n\nCreate a 30-second CF video using AI tools and upload to Instagram, TikTok, or YouTube.` +
      (form.productUrl ? `\n\nProduct URL: ${form.productUrl}` : "");

    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "https://ai119-bot-production.up.railway.app"}/api/missions/escrow`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: form.campaignTitle || `${form.brandName} CF Video`,
            description,
            missionType: "cf_video",
            advertiserName: form.brandName,
            totalBudget: budget,
            reward: rewardPer,
            requiredTags: tags,
            endDate: form.endDate,
          }),
        },
      );

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ message: "Failed" }))) as {
          message?: string;
        };
        throw new Error(err.message || "Failed to create mission");
      }

      setSuccess(true);
      toast.success(ca.success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create mission");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token || !user) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{ca.modalTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Film className="h-12 w-12 text-violet-400" />
            <p className="text-sm text-muted-foreground">{ca.loginRequired}</p>
            <Button
              className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
              onClick={() => { handleClose(); router.push("/auth"); }}
            >
              {ca.loginBtn}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-violet-500" />
            {success ? ca.success : ca.modalTitle}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <CheckCircle className="h-7 w-7 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">{ca.success}</p>
                <p className="text-sm text-green-600 dark:text-green-500 mt-1">{ca.successDesc}</p>
              </div>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
              onClick={handleClose}
            >
              {t.missionFlow.close}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{ca.modalDesc}</p>

            {/* AP balance indicator */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800">
              <span className="text-xs text-violet-700 dark:text-violet-400">{ca.balanceLabel}</span>
              <span className="text-sm font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1">
                <Coins className="h-3.5 w-3.5" />
                {(user.points ?? 0).toLocaleString()} AP
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{ca.brandName} *</Label>
              <Input
                required
                placeholder="Nike, Samsung, ..."
                value={form.brandName}
                onChange={set("brandName")}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{ca.campaignTitle} *</Label>
              <Input
                required
                placeholder="Summer 2026 CF Campaign"
                value={form.campaignTitle}
                onChange={set("campaignTitle")}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{ca.campaignDesc} *</Label>
              <Textarea
                required
                rows={3}
                placeholder="Describe your product and what you want creators to highlight..."
                value={form.campaignDesc}
                onChange={set("campaignDesc")}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{ca.productUrl}</Label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="url"
                  placeholder="https://yourproduct.com"
                  value={form.productUrl}
                  onChange={set("productUrl")}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">{ca.totalBudget} *</Label>
                <Input
                  required
                  type="number"
                  min={100000}
                  step={10000}
                  placeholder="100000"
                  value={form.totalBudget}
                  onChange={set("totalBudget")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{ca.rewardPerVideo} *</Label>
                <Input
                  required
                  type="number"
                  min={1000}
                  step={1000}
                  placeholder="50000"
                  value={form.rewardPerVideo}
                  onChange={set("rewardPerVideo")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{ca.requiredTags}</Label>
              <Input
                placeholder="#AIM,#YourBrand"
                value={form.requiredTags}
                onChange={set("requiredTags")}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{ca.endDate} *</Label>
              <Input
                required
                type="date"
                value={form.endDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={set("endDate")}
              />
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <Wallet className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-700 dark:text-amber-400">{ca.budgetHint}</p>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {ca.submitting}
                </>
              ) : (
                ca.submitBtn
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
