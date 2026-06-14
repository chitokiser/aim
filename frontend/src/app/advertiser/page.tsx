"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
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
  Megaphone, Coins, BarChart3, Plus, TrendingUp,
  Users, Eye, MousePointerClick, Tag, Zap
} from "lucide-react";

const MISSION_TYPES = [
  { value: "click", label: "클릭 광고", price: "50 AP/클릭", desc: "링크 클릭 시 보상" },
  { value: "exposure", label: "노출 광고", price: "10 AP/노출", desc: "콘텐츠 조회 시 보상" },
  { value: "like", label: "좋아요 광고", price: "100 AP/좋아요", desc: "좋아요 수행 시 보상" },
  { value: "comment", label: "댓글 광고", price: "300 AP/댓글", desc: "댓글 작성 시 보상" },
  { value: "share", label: "공유 광고", price: "300 AP/공유", desc: "SNS 공유 시 보상" },
  { value: "subscribe", label: "구독 광고", price: "500 AP/구독", desc: "유튜브 구독 시 보상" },
  { value: "follow", label: "팔로우 광고", price: "500 AP/팔로우", desc: "인스타그램 팔로우 시 보상" },
  { value: "join", label: "가입 광고", price: "500 AP/가입", desc: "텔레그램 그룹/채널 가입 시 보상" },
  { value: "cf_video", label: "CF 영상 제작", price: "미션별 설정", desc: "AI CF 영상 제작 의뢰" },
  { value: "blog_post", label: "블로그 게시", price: "미션별 설정", desc: "광고 내용 블로그 게시" },
  { value: "cm_song", label: "CM송 제작", price: "미션별 설정", desc: "AI CM송 제작 의뢰" },
  { value: "review", label: "앱스토어 리뷰", price: "20,000 AP/리뷰", desc: "구글/앱스토어 리뷰 작성" },
];

const AI_CONTENT_TYPES = [
  { value: "review_video", label: "AI 리뷰 영상", options: ["30초", "60초", "90초"] },
  { value: "ad_video", label: "AI 광고 영상", options: ["CF 영상", "브랜드 영상", "제품 소개 영상"] },
  { value: "music", label: "AI 음악 제작", options: ["광고송", "브랜드송", "CM송", "배경음악"] },
  { value: "music_video", label: "AI 뮤직비디오", options: ["가사 입력 → AI 작곡 → MP3 → 뮤직비디오"] },
  { value: "brochure", label: "AI 사업소개서", options: ["PDF", "PPT", "웹페이지"] },
  { value: "landing", label: "랜딩페이지 제작", options: ["HTML", "모바일 최적화", "CTA", "SEO"] },
  { value: "poster", label: "포스터 제작", options: ["SNS 포스터", "이벤트 포스터", "광고 배너"] },
];

const MY_MISSIONS = [
  { id: "1", title: "AI CF 영상 제작", type: "cf_video", budget: 5000000, spent: 2500000, participants: 234, status: "active" },
  { id: "2", title: "블로그 AI 리뷰", type: "blog_post", budget: 3000000, spent: 1800000, participants: 567, status: "active" },
  { id: "3", title: "인스타그램 팔로우", type: "follow", budget: 1000000, spent: 1000000, participants: 2000, status: "ended" },
];

export default function AdvertiserPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [balance] = useState(500000);
  const [missionForm, setMissionForm] = useState({
    title: "", description: "", type: "", budget: "", reward: "",
    maxParticipants: "", startDate: "", endDate: "", requiredTags: "", targetUrl: "",
    productName: "", website: "", productDesc: "", brandDesc: "", contentType: "", contentOption: "",
  });

  const handleMissionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const budget = parseInt(missionForm.budget);
    if (budget > balance) {
      toast.error("잔액이 부족합니다. 포인트를 충전해주세요.");
      return;
    }
    toast.success("미션이 등록되었습니다! 관리자 승인 후 활성화됩니다.");
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black mb-1">광고주 센터</h1>
          <p className="text-muted-foreground">AI 창작자들과 함께 효과적인 마케팅을 진행하세요</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <Coins className="h-5 w-5 text-violet-500" />
            <span className="text-2xl font-black text-violet-600 dark:text-violet-400">
              {balance.toLocaleString()} AP
            </span>
          </div>
          <p className="text-xs text-muted-foreground">보유 예산</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "진행 중 미션", value: "2", icon: Megaphone, color: "text-violet-500" },
          { label: "총 참여자", value: "801", icon: Users, color: "text-cyan-500" },
          { label: "총 노출", value: "45,200", icon: Eye, color: "text-amber-500" },
          { label: "총 클릭", value: "8,340", icon: MousePointerClick, color: "text-green-500" },
        ].map(({ label, value, icon: Icon, color }) => (
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
        <TabsList className="mb-6">
          <TabsTrigger value="create">미션 등록</TabsTrigger>
          <TabsTrigger value="ai-content">AI 콘텐츠 의뢰</TabsTrigger>
          <TabsTrigger value="my-missions">내 미션</TabsTrigger>
          <TabsTrigger value="charge">예산 충전</TabsTrigger>
          <TabsTrigger value="stats">성과 통계</TabsTrigger>
        </TabsList>

        {/* Create Mission */}
        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                새 미션 등록
              </CardTitle>
              <CardDescription>
                AP 에스크로 예치 후 미션이 활성화됩니다. 수익 분배: 플랫폼 20%, 멘토 10%, 참여자 70%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMissionSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>미션 제목 *</Label>
                    <Input placeholder="ex) AI CF 영상 제작 미션" value={missionForm.title}
                      onChange={(e) => setMissionForm(p => ({ ...p, title: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>미션 유형 *</Label>
                    <Select onValueChange={(v) => setMissionForm(p => ({ ...p, type: v }))}>
                      <SelectTrigger><SelectValue placeholder="유형 선택" /></SelectTrigger>
                      <SelectContent>
                        {MISSION_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label} — {t.price}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>미션 설명 *</Label>
                  <Textarea placeholder="참여자가 수행해야 할 내용을 상세히 작성하세요." rows={3}
                    value={missionForm.description}
                    onChange={(e) => setMissionForm(p => ({ ...p, description: e.target.value }))} required />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>총 예산 (AP) *</Label>
                    <Input type="number" placeholder="1000000" value={missionForm.budget}
                      onChange={(e) => setMissionForm(p => ({ ...p, budget: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>건당 보상 (AP) *</Label>
                    <Input type="number" placeholder="5000" value={missionForm.reward}
                      onChange={(e) => setMissionForm(p => ({ ...p, reward: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>최대 참여 인원</Label>
                    <Input type="number" placeholder="무제한" value={missionForm.maxParticipants}
                      onChange={(e) => setMissionForm(p => ({ ...p, maxParticipants: e.target.value }))} />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>시작일 *</Label>
                    <Input type="date" value={missionForm.startDate}
                      onChange={(e) => setMissionForm(p => ({ ...p, startDate: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>종료일 *</Label>
                    <Input type="date" value={missionForm.endDate}
                      onChange={(e) => setMissionForm(p => ({ ...p, endDate: e.target.value }))} required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>필수 태그 (쉼표로 구분)</Label>
                  <Input placeholder="#AIM, #브랜드명, #광고" value={missionForm.requiredTags}
                    onChange={(e) => setMissionForm(p => ({ ...p, requiredTags: e.target.value }))} />
                </div>

                <div className="space-y-1.5">
                  <Label>타겟 URL (링크 삽입 필수 시)</Label>
                  <Input type="url" placeholder="https://your-website.com" value={missionForm.targetUrl}
                    onChange={(e) => setMissionForm(p => ({ ...p, targetUrl: e.target.value }))} />
                </div>

                {missionForm.budget && (
                  <div className="p-4 rounded-lg bg-violet-50 dark:bg-violet-950/20 space-y-2 text-sm">
                    <p className="font-semibold">수익 분배 예상</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded bg-white dark:bg-slate-800">
                        <div className="font-bold text-violet-600">{Math.round(parseInt(missionForm.budget || "0") * 0.2).toLocaleString()} AP</div>
                        <div className="text-xs text-muted-foreground">플랫폼 (20%)</div>
                      </div>
                      <div className="p-2 rounded bg-white dark:bg-slate-800">
                        <div className="font-bold text-cyan-600">{Math.round(parseInt(missionForm.budget || "0") * 0.1).toLocaleString()} AP</div>
                        <div className="text-xs text-muted-foreground">멘토 (10%)</div>
                      </div>
                      <div className="p-2 rounded bg-white dark:bg-slate-800">
                        <div className="font-bold text-green-600">{Math.round(parseInt(missionForm.budget || "0") * 0.7).toLocaleString()} AP</div>
                        <div className="text-xs text-muted-foreground">참여자 (70%)</div>
                      </div>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90">
                  미션 등록 (AP 에스크로 예치)
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
                <CardTitle className="text-base">광고주 자료 등록</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>제품명</Label>
                  <Input placeholder="제품 또는 서비스명" value={missionForm.productName}
                    onChange={(e) => setMissionForm(p => ({ ...p, productName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>웹사이트</Label>
                  <Input type="url" placeholder="https://your-website.com" value={missionForm.website}
                    onChange={(e) => setMissionForm(p => ({ ...p, website: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>제품 설명</Label>
                  <Textarea placeholder="제품/서비스 상세 설명" rows={3} value={missionForm.productDesc}
                    onChange={(e) => setMissionForm(p => ({ ...p, productDesc: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>브랜드 설명</Label>
                  <Textarea placeholder="브랜드 컨셉, 톤앤매너, 타겟" rows={2} value={missionForm.brandDesc}
                    onChange={(e) => setMissionForm(p => ({ ...p, brandDesc: e.target.value }))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI 제작 유형 선택</CardTitle>
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
                  AI 콘텐츠 제작 의뢰
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
                          {mission.status === "active" ? "진행 중" : "종료"}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-violet-600">{mission.spent.toLocaleString()} AP 사용</div>
                        <div className="text-xs text-muted-foreground">/ {mission.budget.toLocaleString()} AP</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">예산 소진</span>
                          <span>{Math.round(spentPct)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full" style={{ width: `${spentPct}%` }} />
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{mission.participants.toLocaleString()}명 참여</span>
                        </div>
                        <Button variant="outline" size="sm">상세 통계</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Charge */}
        <TabsContent value="charge">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AP 예산 충전</CardTitle>
              <CardDescription>Telegram Stars, TON, USDT로 충전 가능합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { method: "Telegram Stars", icon: "⭐", desc: "텔레그램 내 간편 결제", color: "border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20" },
                  { method: "TON", icon: "💎", desc: "TON 개인 지갑 연동", color: "border-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/20" },
                  { method: "USDT", icon: "💵", desc: "USDT (TRC20/ERC20)", color: "border-green-300 hover:bg-green-50 dark:hover:bg-green-950/20" },
                ].map(({ method, icon, desc, color }) => (
                  <div key={method} className={`p-4 rounded-xl border-2 cursor-pointer transition-colors ${color} text-center`}>
                    <div className="text-3xl mb-2">{icon}</div>
                    <p className="font-bold text-sm">{method}</p>
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <Label>충전 금액 (USD)</Label>
                <div className="flex gap-2 flex-wrap">
                  {[10, 50, 100, 500, 1000].map((amt) => (
                    <Badge key={amt} variant="outline" className="cursor-pointer px-3 py-2 text-sm">
                      ${amt} = {(amt * 10000).toLocaleString()} AP
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input type="number" placeholder="직접 입력 (USD)" />
                  <Button className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90 whitespace-nowrap">
                    충전하기
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats */}
        <TabsContent value="stats">
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { label: "참여자 수", value: "801명", icon: Users, change: "+12.3%" },
              { label: "게시물 수", value: "1,240개", icon: Tag, change: "+8.7%" },
              { label: "총 노출수", value: "45,200회", icon: Eye, change: "+23.1%" },
              { label: "총 클릭수", value: "8,340회", icon: MousePointerClick, change: "+15.4%" },
              { label: "태그 사용량", value: "#AIM: 1,890회", icon: Tag, change: "+31.2%" },
              { label: "ROI", value: "340%", icon: TrendingUp, change: "+45.0%" },
            ].map(({ label, value, icon: Icon, change }) => (
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
