"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Coins, Users, Clock, Tag, Video, FileText, Music, Star, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

const MISSION_TYPE_CONFIG = {
  cf_video: { label: "CF 영상", icon: Video, color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  blog_post: { label: "블로그", icon: FileText, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  sns_post: { label: "SNS", icon: Star, color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  cm_song: { label: "CM송", icon: Music, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  review: { label: "리뷰", icon: Star, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  signup: { label: "가입", icon: ExternalLink, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
};

interface MissionCardProps {
  mission: {
    id: string;
    title: string;
    description: string;
    reward: number;
    remainingBudget: number;
    totalBudget: number;
    endDate: Date;
    requiredTags: string[];
    participantCount: number;
    missionType: keyof typeof MISSION_TYPE_CONFIG;
    status: "active" | "ended" | "pending";
    advertiserName: string;
  };
}

export function MissionCard({ mission }: MissionCardProps) {
  const typeConfig = MISSION_TYPE_CONFIG[mission.missionType];
  const Icon = typeConfig.icon;
  const budgetUsed = ((mission.totalBudget - mission.remainingBudget) / mission.totalBudget) * 100;
  const daysLeft = formatDistanceToNow(new Date(mission.endDate), { locale: ko, addSuffix: true });

  return (
    <Card className="flex flex-col hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Badge className={`${typeConfig.color} border-0 font-medium text-xs`}>
            <Icon className="h-3 w-3 mr-1" />
            {typeConfig.label}
          </Badge>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {mission.advertiserName}
          </Badge>
        </div>
        <h3 className="font-bold text-base mt-2 leading-snug">{mission.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {mission.description}
        </p>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 pb-3">
        {/* Reward */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-violet-50 to-cyan-50 dark:from-violet-950/20 dark:to-cyan-950/20">
          <span className="text-sm text-muted-foreground">미션 보상</span>
          <div className="flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-violet-600" />
            <span className="font-black text-violet-700 dark:text-violet-400">
              {mission.reward.toLocaleString()} AP
            </span>
          </div>
        </div>

        {/* Budget Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>예산 소진</span>
            <span>{Math.round(budgetUsed)}%</span>
          </div>
          <Progress value={budgetUsed} className="h-1.5" />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">잔여 {mission.remainingBudget.toLocaleString()} AP</span>
            <span className="text-muted-foreground">총 {mission.totalBudget.toLocaleString()} AP</span>
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
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>{mission.participantCount.toLocaleString()}명 참여</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>마감 {daysLeft}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Link href={`/missions/${mission.id}`} className="w-full">
          <Button
            className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90 font-semibold"
            disabled={mission.status !== "active"}
          >
            {mission.status === "active" ? "미션 참여하기" : "마감된 미션"}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
