"use client";

import { useState } from "react";
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
  Users, Eye, MousePointerClick, Tag
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

export default function AdvertiserPage() {
  const { user } = useAuthStore();
  const { t } = useLanguage();
  const [balance] = useState(500000);
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

  const handleMissionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const budget = parseInt(missionForm.budget);
    if (budget > balance) {
      toast.error(t.advertiser.chargeTitle);
      return;
    }
    toast.success(t.advertiser.submitMission);
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
          <TabsTrigger value="create">{t.advertiser.tabCreate}</TabsTrigger>
          <TabsTrigger value="ai-content">{t.advertiser.tabAI}</TabsTrigger>
          <TabsTrigger value="my-missions">{t.advertiser.tabMyMissions}</TabsTrigger>
          <TabsTrigger value="charge">{t.advertiser.tabCharge}</TabsTrigger>
          <TabsTrigger value="stats">{t.advertiser.tabStats}</TabsTrigger>
        </TabsList>

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

        {/* Charge */}
        <TabsContent value="charge">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.advertiser.chargeTitle}</CardTitle>
              <CardDescription>{t.advertiser.chargeDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { method: "Telegram Stars", icon: "⭐", desc: "Quick payment via Telegram", color: "border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20" },
                  { method: "TON", icon: "💎", desc: "Connect TON wallet", color: "border-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/20" },
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
                <Label>{t.advertiser.chargeAmount} (USD)</Label>
                <div className="flex gap-2 flex-wrap">
                  {[10, 50, 100, 500, 1000].map((amt) => (
                    <Badge key={amt} variant="outline" className="cursor-pointer px-3 py-2 text-sm">
                      ${amt} = {(amt * 10000).toLocaleString()} AP
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input type="number" placeholder="Custom (USD)" />
                  <Button className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90 whitespace-nowrap">
                    {t.advertiser.chargeBtn}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
