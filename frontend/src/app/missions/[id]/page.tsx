"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Coins, Users, Clock, Tag, CheckCircle, AlertCircle, ArrowLeft, ExternalLink
} from "lucide-react";

const MISSION_DATA: Record<string, {
  id: string;
  title: string;
  description: string;
  fullDescription: string;
  reward: number;
  remainingBudget: number;
  totalBudget: number;
  endDate: string;
  requiredTags: string[];
  participantCount: number;
  advertiserName: string;
  steps: string[];
  targetUrl?: string;
}> = {
  "1": {
    id: "1",
    title: "AI 브랜드 CF 영상 제작",
    description: "AI 도구를 이용해 30초 CF 영상을 제작하고 SNS에 업로드하세요.",
    fullDescription: "AI 비디오 생성 도구(Runway, Sora, Pika 등)를 사용하여 브랜드 CF 영상을 제작합니다. 영상은 최소 15초 이상이어야 하며, 필수 태그를 포함해야 합니다.",
    reward: 50000,
    remainingBudget: 2500000,
    totalBudget: 5000000,
    endDate: "2026-06-30",
    requiredTags: ["#AIM", "#AIcf", "#창작"],
    participantCount: 234,
    advertiserName: "BrandX",
    steps: [
      "AI 비디오 도구로 CF 영상 제작 (15초 이상)",
      "인스타그램, 틱톡, 유튜브 숏폼에 업로드",
      "필수 태그 모두 포함",
      "아래 폼에 게시물 URL 제출",
    ],
  },
};

export default function MissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [postUrl, setPostUrl] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const mission = MISSION_DATA[params.id as string] || MISSION_DATA["1"];
  const budgetUsed = ((mission.totalBudget - mission.remainingBudget) / mission.totalBudget) * 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push("/auth");
      return;
    }
    if (!postUrl.trim()) {
      toast.error("게시물 URL을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      setSubmitted(true);
      toast.success("미션 신청이 완료되었습니다! 텔레그램 봇이 자동 검수 후 포인트를 지급합니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <Button variant="ghost" className="mb-6 -ml-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        미션 목록
      </Button>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Mission Info */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0">
                {mission.advertiserName}
              </Badge>
              <Badge variant="outline" className="text-green-600 border-green-300">진행 중</Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-black mb-3">{mission.title}</h1>
            <p className="text-muted-foreground leading-relaxed">{mission.fullDescription}</p>
          </div>

          {/* Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">미션 수행 방법</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mission.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30 text-xs font-bold text-violet-700 dark:text-violet-400">
                    {i + 1}
                  </div>
                  <p className="text-sm mt-0.5">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Required Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4" />
                필수 태그 (모두 포함 필수)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {mission.requiredTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-mono text-sm px-3 py-1">
                    {tag}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                위 태그가 게시물에 없으면 자동 검수에서 거절됩니다.
              </p>
            </CardContent>
          </Card>

          {/* Submit Form */}
          {!submitted ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">미션 제출</CardTitle>
              </CardHeader>
              <CardContent>
                {!user ? (
                  <div className="text-center py-6">
                    <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">미션 참여를 위해 로그인이 필요합니다.</p>
                    <Button onClick={() => router.push("/auth")}>
                      텔레그램으로 로그인
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>게시물 URL *</Label>
                      <div className="relative">
                        <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="url"
                          placeholder="https://www.instagram.com/p/..."
                          value={postUrl}
                          onChange={(e) => setPostUrl(e.target.value)}
                          className="pl-9"
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">필수 태그가 포함된 게시물의 URL을 입력하세요</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>추가 메모 (선택)</Label>
                      <Textarea
                        placeholder="미션 수행 관련 추가 내용을 입력하세요..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
                      disabled={submitting}
                    >
                      {submitting ? "제출 중..." : "미션 제출하기"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
              <CardContent className="flex items-center gap-4 py-6">
                <CheckCircle className="h-10 w-10 text-green-500 shrink-0" />
                <div>
                  <p className="font-semibold text-green-700 dark:text-green-400">미션 제출 완료!</p>
                  <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                    텔레그램 봇이 자동 검수 중입니다. 검수 완료 후 포인트가 즉시 지급됩니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-violet-50 to-cyan-50 dark:from-violet-950/20 dark:to-cyan-950/20">
                <Coins className="h-8 w-8 mx-auto text-violet-600 mb-2" />
                <div className="text-3xl font-black text-violet-700 dark:text-violet-400">
                  {mission.reward.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">AP 보상</div>
                <div className="text-xs text-muted-foreground mt-1">
                  ≈ {(mission.reward / 10000).toFixed(2)} USD
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">예산 소진</span>
                  <span className="font-medium">{Math.round(budgetUsed)}%</span>
                </div>
                <Progress value={budgetUsed} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  잔여 예산 {mission.remainingBudget.toLocaleString()} AP
                </div>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>참여자</span>
                  </div>
                  <span className="font-medium">{mission.participantCount.toLocaleString()}명</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>마감일</span>
                  </div>
                  <span className="font-medium">{mission.endDate}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
