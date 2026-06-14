"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Users, Target, Coins, ShieldAlert, CheckCircle, XCircle,
  Search, Megaphone, Tag, Bell, BarChart3, Loader2
} from "lucide-react";

const STATS = [
  { label: "총 회원", value: "12,450", icon: Users, color: "text-violet-500" },
  { label: "활성 미션", value: "24", icon: Target, color: "text-cyan-500" },
  { label: "총 AP 발행", value: "4.2B", icon: Coins, color: "text-amber-500" },
  { label: "신고 처리 대기", value: "7", icon: ShieldAlert, color: "text-red-500" },
];

const PENDING_POSTS = [
  { id: "1", user: "aimaster_kim", platform: "Instagram", url: "https://instagram.com/p/ABC", tags: ["#AIM", "#AIcf"], mission: "AI CF 영상", date: "2026-06-14 09:23" },
  { id: "2", user: "creative_lee", platform: "YouTube", url: "https://youtube.com/watch?v=XYZ", tags: ["#AIM", "#AI리뷰"], mission: "블로그 리뷰", date: "2026-06-14 08:45" },
  { id: "3", user: "tonhunter", platform: "Blog", url: "https://blog.example.com/post1", tags: ["#AIM", "#AICMsong"], mission: "CM송 제작", date: "2026-06-14 07:30" },
];

const MEMBERS = [
  { id: "1", username: "aimaster_kim", firstName: "김민준", telegramId: "123456", points: 2450000, posts: 89, status: "active", joined: "2026-01-15" },
  { id: "2", username: "creative_lee", firstName: "이서연", telegramId: "234567", points: 1980000, posts: 67, status: "active", joined: "2026-02-03" },
  { id: "3", username: "spammer_x", firstName: "스팸계정", telegramId: "999888", points: 500, posts: 120, status: "suspended", joined: "2026-06-01" },
];

const MISSIONS_PENDING = [
  { id: "1", advertiser: "BrandX", title: "AI CF 영상 제작 v2", budget: 10000000, type: "cf_video", date: "2026-06-13" },
  { id: "2", advertiser: "TechCo", title: "앱 리뷰 미션", budget: 2000000, type: "review", date: "2026-06-14" },
];

export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (user && !user.isAdmin) router.push("/");
  }, [user, router]);

  const approvePost = (id: string) => toast.success(`게시물 #${id} 승인 완료. 포인트 지급 처리됨.`);
  const rejectPost = (id: string) => toast.error(`게시물 #${id} 거절 처리됨.`);
  const approveMission = (id: string) => toast.success(`미션 #${id} 승인 완료. 활성화됨.`);
  const suspendUser = (id: string) => toast.warning(`유저 #${id} 정지 처리됨.`);
  const sendNotice = () => {
    if (!notice.trim()) return;
    toast.success("텔레그램 그룹에 공지사항이 발송되었습니다.");
    setNotice("");
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-1">관리자 대시보드</h1>
        <p className="text-muted-foreground">AIM 플랫폼 전체 현황을 관리합니다</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {STATS.map(({ label, value, icon: Icon, color }) => (
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
          <TabsTrigger value="posts">게시물 검수</TabsTrigger>
          <TabsTrigger value="missions">미션 승인</TabsTrigger>
          <TabsTrigger value="members">회원 관리</TabsTrigger>
          <TabsTrigger value="points">포인트 관리</TabsTrigger>
          <TabsTrigger value="notice">공지사항</TabsTrigger>
          <TabsTrigger value="tags">태그 관리</TabsTrigger>
        </TabsList>

        {/* Posts Review */}
        <TabsContent value="posts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">게시물 검수 대기 ({PENDING_POSTS.length})</CardTitle>
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
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> 승인
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1 sm:flex-none"
                        onClick={() => rejectPost(post.id)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> 거절
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mission Approval */}
        <TabsContent value="missions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">미션 승인 대기 ({MISSIONS_PENDING.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {MISSIONS_PENDING.map((m) => (
                  <div key={m.id} className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-semibold">{m.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{m.advertiser}</Badge>
                        <span className="text-xs text-muted-foreground">
                          예산: {m.budget.toLocaleString()} AP · {m.date}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white"
                        onClick={() => approveMission(m.id)}>승인</Button>
                      <Button size="sm" variant="outline">거절</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-base">회원 관리</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {MEMBERS.filter((m) =>
                  m.username.includes(search) || m.firstName.includes(search)
                ).map((member) => (
                  <div key={member.id} className="p-4 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{member.firstName}</span>
                        <span className="text-xs text-muted-foreground">@{member.username}</span>
                        <Badge variant={member.status === "active" ? "default" : "destructive"} className="text-xs">
                          {member.status === "active" ? "정상" : "정지"}
                        </Badge>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        <span>TG: {member.telegramId}</span>
                        <span>{member.points.toLocaleString()} AP</span>
                        <span>게시물 {member.posts}개</span>
                        <span>가입: {member.joined}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">포인트 조정</Button>
                      {member.status === "active" ? (
                        <Button size="sm" variant="destructive" onClick={() => suspendUser(member.id)}>정지</Button>
                      ) : (
                        <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white">복구</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Points Management */}
        <TabsContent value="points">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">포인트 수동 지급</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">대상 유저 (텔레그램 ID)</label>
                  <Input placeholder="123456" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">지급/차감 금액 (AP)</label>
                  <Input type="number" placeholder="+1000 또는 -1000" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">사유</label>
                  <Input placeholder="이벤트 보상, 오류 수정 등" />
                </div>
                <Button className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90">
                  포인트 처리
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">AP 발행 현황</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "총 발행량", value: "4,200,000,000 AP" },
                  { label: "총 지급량", value: "3,150,000,000 AP" },
                  { label: "총 소각량", value: "840,000,000 AP" },
                  { label: "플랫폼 수익", value: "210,000,000 AP" },
                  { label: "멘토 수당", value: "105,000,000 AP" },
                  { label: "출금 대기", value: "42,500 AP" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-2 border-b last:border-0 text-sm">
                    <span className="text-muted-foreground">{label}</span>
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
                텔레그램 공지사항 발송
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">공지 내용</label>
                <textarea
                  className="w-full min-h-32 rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="텔레그램 그룹방에 발송할 공지 내용을 입력하세요..."
                  value={notice}
                  onChange={(e) => setNotice(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90" onClick={sendNotice}>
                  <Bell className="h-4 w-4 mr-2" />
                  전체 공지 발송
                </Button>
                <Button variant="outline">미리보기</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tags */}
        <TabsContent value="tags">
          <Card>
            <CardHeader><CardTitle className="text-base">태그 관리</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="새 필수 태그 추가 (예: #AIM2026)" className="flex-1" />
                <Button variant="outline">추가</Button>
              </div>
              <div className="space-y-2">
                {["#AIM", "#AIcreator", "#AIcf", "#AICMsong", "#AI리뷰", "#창작"].map((tag) => (
                  <div key={tag} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <span className="font-mono text-sm">{tag}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">사용 {Math.floor(Math.random() * 2000 + 100)}회</span>
                      <Button variant="ghost" size="sm" className="h-7 text-red-500 hover:text-red-600">삭제</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
