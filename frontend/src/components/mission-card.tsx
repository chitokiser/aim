"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Coins, Users, Tag, Video, FileText, Music, Star, ExternalLink, ThumbsUp, Megaphone, Send, Zap } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const MISSION_TYPE_ICONS = {
  cf_video: { icon: Video, color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  blog_post: { icon: FileText, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  sns_post: { icon: Star, color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  cm_song: { icon: Music, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  review: { icon: Star, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  signup: { icon: ExternalLink, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  youtube_sub: { icon: ThumbsUp, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  sns_banner: { icon: Megaphone, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  telegram_join: { icon: Send, color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  follow_join: { icon: Send, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  jumpdao: { icon: Zap, color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
};

interface MissionCardProps {
  mission: {
    id: string;
    title: string;
    description: string;
    reward: number;
    remainingBudget: number;
    totalBudget: number;
    requiredTags: string[];
    participantCount: number;
    missionType: keyof typeof MISSION_TYPE_ICONS;
    status: "active" | "ended" | "pending";
    advertiserName: string;
  };
  onJoin?: (mission: MissionCardProps["mission"]) => void;
  joined?: boolean;
}

export function MissionCard({ mission, onJoin, joined }: MissionCardProps) {
  const { t } = useLanguage();
  const mc = t.missionCard;
  const mf = t.missions;
  const typeIcons = MISSION_TYPE_ICONS[mission.missionType] ?? { icon: Zap, color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" };
  const Icon = typeIcons.icon;
  const TYPE_LABELS: Record<keyof typeof MISSION_TYPE_ICONS, string> = {
    cf_video: mf.filterCF,
    blog_post: mf.filterBlog,
    sns_post: mf.filterSNS,
    cm_song: mf.filterCM,
    review: mf.filterReview,
    signup: mf.filterSignup,
    youtube_sub: mf.filterYoutubeSub,
    sns_banner: mf.filterSnsBanner,
    telegram_join: mf.filterTelegramJoin,
    follow_join: mf.filterFollowJoin,
    jumpdao: mf.filterJumpdao,
  };
  const isJumpdao = mission.missionType === "jumpdao";
  const budgetUsed = mission.totalBudget > 0
    ? ((mission.totalBudget - mission.remainingBudget) / mission.totalBudget) * 100
    : 0;

  return (
    <Card className={`flex flex-col hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 shadow-sm ${isJumpdao ? "border-2 border-yellow-400 dark:border-yellow-500 shadow-yellow-200 dark:shadow-yellow-900/40" : "border-0"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Badge className={`${typeIcons.color} border-0 font-medium text-xs`}>
            <Icon className="h-3 w-3 mr-1" />
            {TYPE_LABELS[mission.missionType]}
          </Badge>
          {isJumpdao ? (
            <Badge className="border-0 font-bold text-xs bg-gradient-to-r from-yellow-400 to-amber-500 text-white">
              ✨ SPECIAL
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {mission.advertiserName}
            </Badge>
          )}
        </div>
        <h3 className="font-bold text-base mt-2 leading-snug">{mission.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {mission.description}
        </p>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 pb-3">
        {/* Reward */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-violet-50 to-cyan-50 dark:from-violet-950/20 dark:to-cyan-950/20">
          <span className="text-sm text-muted-foreground">{mc.reward}</span>
          <div className="flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-violet-600" />
            <span className="font-black text-violet-700 dark:text-violet-400">
              {mission.reward.toLocaleString("en-US")} AP
            </span>
          </div>
        </div>

        {/* Budget Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{mc.budget}</span>
            <span>{Math.round(budgetUsed)}%</span>
          </div>
          <Progress value={budgetUsed} className="h-1.5" />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{mission.remainingBudget.toLocaleString("en-US")} AP</span>
            <span className="text-muted-foreground">{mission.totalBudget.toLocaleString("en-US")} AP</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {mission.requiredTags.map((tag) => (
            <div key={tag} className="flex items-center gap-1 text-xs bg-muted rounded-md px-2 py-1">
              <Tag className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono">{tag}</span>
            </div>
          ))}
        </div>

        {/* Meta */}
        <div className="flex items-center text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>{mission.participantCount.toLocaleString("en-US")} {mc.participants}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          className={`w-full text-white hover:opacity-90 font-semibold ${joined ? "bg-gradient-to-r from-green-500 to-emerald-500" : isJumpdao ? "bg-gradient-to-r from-yellow-400 to-amber-500" : "bg-gradient-to-r from-violet-600 to-cyan-500"}`}
          disabled={mission.status !== "active" || joined}
          onClick={() => mission.status === "active" && !joined && onJoin?.(mission)}
        >
          {joined ? mc.joined : mission.status === "active" ? mc.join : mc.ended}
        </Button>
      </CardFooter>
    </Card>
  );
}
