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
import { toast } from "sonner";
import {
  Users, Target, Coins, ShieldAlert, CheckCircle, XCircle,
  Search, Bell
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

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

const AP_STATUS = [
  { labelKey: "총 발행량", value: "4,200,000,000 AP" },
  { labelKey: "총 지급량", value: "3,150,000,000 AP" },
  { labelKey: "총 소각량", value: "840,000,000 AP" },
  { labelKey: "플랫폼 수익", value: "210,000,000 AP" },
  { labelKey: "멘토 수당", value: "105,000,000 AP" },
  { labelKey: "출금 대기", value: "42,500 AP" },
];

export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (user && !user.isAdmin) router.push("/");
  }, [user, router]);

  const approvePost = (id: string) => toast.success(`#${id} ${t.admin.approve}`);
  const rejectPost = (id: string) => toast.error(`#${id} ${t.admin.reject}`);
  const approveMission = (id: string) => toast.success(`#${id} ${t.admin.approve}`);
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
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-1">{t.admin.title}</h1>
        <p className="text-muted-foreground">{t.admin.subtitle}</p>
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
          <TabsTrigger value="missions">{t.admin.tabMissions}</TabsTrigger>
          <TabsTrigger value="members">{t.admin.tabMembers}</TabsTrigger>
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

        {/* Mission Approval */}
        <TabsContent value="missions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.admin.missionsPending} ({MISSIONS_PENDING.length})</CardTitle>
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
                          {t.admin.budget}: {m.budget.toLocaleString()} AP · {m.date}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white"
                        onClick={() => approveMission(m.id)}>{t.admin.approve}</Button>
                      <Button size="sm" variant="outline">{t.admin.reject}</Button>
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
                <CardTitle className="text-base">{t.admin.memberMgmt}</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={t.admin.search} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8" />
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
                          {member.status === "active" ? t.admin.active : t.admin.suspended}
                        </Badge>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        <span>TG: {member.telegramId}</span>
                        <span>{member.points.toLocaleString()} AP</span>
                        <span>{member.posts} posts</span>
                        <span>{member.joined}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">{t.admin.adjustPoints}</Button>
                      {member.status === "active" ? (
                        <Button size="sm" variant="destructive" onClick={() => suspendUser(member.id)}>{t.admin.suspend}</Button>
                      ) : (
                        <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white">{t.admin.restore}</Button>
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
    </div>
  );
}
