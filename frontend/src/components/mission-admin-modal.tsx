"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const MISSION_TYPES = [
  { value: "cf_video", label: "CF Video" },
  { value: "blog_post", label: "Blog Post" },
  { value: "sns_post", label: "SNS Post" },
  { value: "cm_song", label: "CM Song" },
  { value: "review", label: "Product Review" },
  { value: "signup", label: "Sign Up" },
  { value: "youtube_sub", label: "YouTube Subscribe" },
  { value: "sns_banner", label: "SNS Banner" },
  { value: "telegram_join", label: "Telegram Join" },
  { value: "jumpdao", label: "Jumpdao" },
];

const SUBMIT_FIELD_OPTIONS = [
  { key: "youtube", label: "YouTube URL" },
  { key: "blog", label: "Blog/Post URL" },
  { key: "instagram", label: "Instagram URL" },
  { key: "tiktok", label: "TikTok URL" },
  { key: "screenshot", label: "Screenshot URL" },
  { key: "comment", label: "Comment Text" },
];

export interface MissionFormData {
  id?: string;
  title: string;
  description: string;
  missionType: string;
  advertiserName: string;
  reward: number;
  totalBudget: number;
  remainingBudget: number;
  endDate: string;
  requiredTags: string[];
  submitFields: string[];
  status: string;
  participantCount: number;
}

const DEFAULT_FORM: MissionFormData = {
  title: "",
  description: "",
  missionType: "cf_video",
  advertiserName: "",
  reward: 10000,
  totalBudget: 1000000,
  remainingBudget: 1000000,
  endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  requiredTags: ["#AIM"],
  submitFields: ["youtube"],
  status: "active",
  participantCount: 0,
};

interface Props {
  open: boolean;
  mission?: MissionFormData | null;
  onClose: () => void;
  onSaved: (mission: MissionFormData) => void;
}

export function MissionAdminModal({ open, mission, onClose, onSaved }: Props) {
  const { token, user } = useAuthStore();
  const isAdmin = user?.isAdmin === true;
  const [form, setForm] = useState<MissionFormData>(DEFAULT_FORM);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mission) {
      setForm({ ...DEFAULT_FORM, ...mission });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [mission, open]);

  const set = <K extends keyof MissionFormData>(key: K, value: MissionFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    const normalized = tag.startsWith("#") ? tag : `#${tag}`;
    if (!form.requiredTags.includes(normalized)) {
      set("requiredTags", [...form.requiredTags, normalized]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) =>
    set("requiredTags", form.requiredTags.filter((t) => t !== tag));

  const toggleField = (key: string) => {
    const cur = form.submitFields;
    set("submitFields", cur.includes(key) ? cur.filter((f) => f !== key) : [...cur, key]);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.advertiserName.trim()) {
      toast.error("Title and Advertiser Name are required");
      return;
    }
    setLoading(true);
    try {
      const body = {
        ...form,
        reward: Number(form.reward),
        totalBudget: Number(form.totalBudget),
        remainingBudget: mission?.id ? Number(form.remainingBudget) : Number(form.totalBudget),
        endDate: new Date(form.endDate).toISOString(),
        participantCount: form.participantCount ?? 0,
      };

      const url = mission?.id
        ? `${API}/api/missions/${mission.id}`
        : `${API}/api/missions`;
      const method = mission?.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? `Error ${res.status}`);
      }

      const saved = await res.json() as MissionFormData;
      toast.success(mission?.id ? "미션이 수정되었습니다" : "미션이 추가되었습니다");
      onSaved(saved);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mission?.id ? "미션 편집" : "새 미션 추가"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Badge / Mission Type */}
          <div className="space-y-1.5">
            <Label>뱃지 (미션 유형)</Label>
            <Select value={form.missionType} onValueChange={(v) => set("missionType", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MISSION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>제목</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="미션 제목을 입력하세요"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>내용 (설명)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="미션 상세 설명"
              rows={3}
            />
          </div>

          {/* Advertiser */}
          <div className="space-y-1.5">
            <Label>광고주명</Label>
            <Input
              value={form.advertiserName}
              onChange={(e) => set("advertiserName", e.target.value)}
              placeholder="e.g. BrandX"
            />
          </div>

          {/* Reward + Budget */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>보상 AP (건당)</Label>
              <Input
                type="number"
                value={form.reward}
                onChange={(e) => set("reward", Number(e.target.value))}
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label>총 예산 (AP){!isAdmin && mission?.id ? " 🔒" : ""}</Label>
              <Input
                type="number"
                value={form.totalBudget}
                onChange={(e) => set("totalBudget", Number(e.target.value))}
                min={0}
                disabled={!isAdmin && !!mission?.id}
              />
              {!isAdmin && mission?.id && (
                <p className="text-xs text-muted-foreground">보증금은 변경할 수 없습니다</p>
              )}
            </div>
          </div>

          {/* Remaining budget (edit only, admin only) */}
          {mission?.id && isAdmin && (
            <div className="space-y-1.5">
              <Label>잔여 예산 (AP)</Label>
              <Input
                type="number"
                value={form.remainingBudget}
                onChange={(e) => set("remainingBudget", Number(e.target.value))}
                min={0}
              />
            </div>
          )}

          {/* End Date */}
          <div className="space-y-1.5">
            <Label>종료일</Label>
            <Input
              type="date"
              value={form.endDate.slice(0, 10)}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>상태</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active (진행중)</SelectItem>
                <SelectItem value="ended">Ended (종료)</SelectItem>
                <SelectItem value="pending">Pending (대기)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Required Tags */}
          <div className="space-y-1.5">
            <Label>필수 태그</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="#AIM"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              />
              <Button type="button" variant="outline" size="icon" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.requiredTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Submit Fields */}
          <div className="space-y-1.5">
            <Label>입력값 (참여자가 제출하는 항목)</Label>
            <div className="grid grid-cols-2 gap-2">
              {SUBMIT_FIELD_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    form.submitFields.includes(opt.key)
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.submitFields.includes(opt.key)}
                    onChange={() => toggleField(opt.key)}
                  />
                  <span className={`h-4 w-4 rounded flex items-center justify-center border ${form.submitFields.includes(opt.key) ? "bg-violet-600 border-violet-600" : "border-muted-foreground"}`}>
                    {form.submitFields.includes(opt.key) && (
                      <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
          >
            {loading ? "저장 중…" : mission?.id ? "수정 저장" : "미션 추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
