"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, Trophy, Medal } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const LEADERBOARD_DATA = [
  { rank: 1, username: "aimaster_kim", firstName: "김민준", points: 2450000, postCount: 89 },
  { rank: 2, username: "creative_lee", firstName: "이서연", points: 1980000, postCount: 67 },
  { rank: 3, username: "tonhunter", firstName: "박도현", points: 1750000, postCount: 54 },
  { rank: 4, username: "aiguru_choi", firstName: "최지우", points: 1540000, postCount: 48 },
  { rank: 5, username: "creator_han", firstName: "한예준", points: 1320000, postCount: 42 },
  { rank: 6, username: "aiartist_jung", firstName: "정수빈", points: 1180000, postCount: 38 },
  { rank: 7, username: "mission_pro", firstName: "강하은", points: 960000, postCount: 31 },
  { rank: 8, username: "tonearner_yoon", firstName: "윤지호", points: 840000, postCount: 27 },
  { rank: 9, username: "aimaker_lim", firstName: "임채원", points: 720000, postCount: 23 },
  { rank: 10, username: "creator_oh", firstName: "오소연", points: 650000, postCount: 21 },
];

const RANK_CONFIG: Record<number, { color: string; icon?: React.ReactNode }> = {
  1: { color: "text-amber-500", icon: <Trophy className="h-5 w-5 text-amber-500" /> },
  2: { color: "text-slate-400", icon: <Medal className="h-5 w-5 text-slate-400" /> },
  3: { color: "text-amber-700", icon: <Medal className="h-5 w-5 text-amber-700" /> },
};

export default function LeaderboardPage() {
  const [period, setPeriod] = useState("weekly");
  const { t } = useLanguage();

  const top3 = LEADERBOARD_DATA.slice(0, 3);

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-black mb-3">{t.leaderboard.title}</h1>
        <p className="text-muted-foreground">{t.leaderboard.subtitle}</p>
      </div>

      <Tabs value={period} onValueChange={setPeriod} className="mb-8">
        <TabsList className="w-full">
          <TabsTrigger value="daily" className="flex-1">{t.leaderboard.daily}</TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1">{t.leaderboard.weekly}</TabsTrigger>
          <TabsTrigger value="monthly" className="flex-1">{t.leaderboard.monthly}</TabsTrigger>
          <TabsTrigger value="all" className="flex-1">{t.leaderboard.all}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* 2nd */}
        <div className="flex flex-col items-center pt-8">
          <Avatar className="h-14 w-14 ring-2 ring-slate-300 mb-2">
            <AvatarFallback className="bg-slate-200 text-slate-600 font-bold">
              {top3[1].firstName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="font-bold text-sm">{top3[1].firstName}</p>
            <p className="text-xs text-muted-foreground">@{top3[1].username}</p>
            <div className="flex items-center gap-1 justify-center mt-1">
              <Coins className="h-3 w-3 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">
                {(top3[1].points / 10000).toFixed(0)}만 AP
              </span>
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg flex items-center justify-center py-3 font-black text-2xl text-slate-400">
            2
          </div>
        </div>

        {/* 1st */}
        <div className="flex flex-col items-center">
          <div className="text-2xl mb-1">👑</div>
          <Avatar className="h-16 w-16 ring-4 ring-amber-400 mb-2">
            <AvatarFallback className="bg-amber-100 text-amber-700 font-black text-lg">
              {top3[0].firstName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="font-black text-sm">{top3[0].firstName}</p>
            <p className="text-xs text-muted-foreground">@{top3[0].username}</p>
            <div className="flex items-center gap-1 justify-center mt-1">
              <Coins className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-semibold text-amber-600">
                {(top3[0].points / 10000).toFixed(0)}만 AP
              </span>
            </div>
          </div>
          <div className="mt-3 w-full bg-amber-400 rounded-t-lg flex items-center justify-center py-4 font-black text-2xl text-white">
            1
          </div>
        </div>

        {/* 3rd */}
        <div className="flex flex-col items-center pt-12">
          <Avatar className="h-12 w-12 ring-2 ring-amber-700 mb-2">
            <AvatarFallback className="bg-amber-50 text-amber-800 font-bold">
              {top3[2].firstName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="font-bold text-sm">{top3[2].firstName}</p>
            <p className="text-xs text-muted-foreground">@{top3[2].username}</p>
            <div className="flex items-center gap-1 justify-center mt-1">
              <Coins className="h-3 w-3 text-amber-700" />
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-600">
                {(top3[2].points / 10000).toFixed(0)}만 AP
              </span>
            </div>
          </div>
          <div className="mt-3 w-full bg-amber-700/80 rounded-t-lg flex items-center justify-center py-2 font-black text-2xl text-white">
            3
          </div>
        </div>
      </div>

      {/* Rest of Rankings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.leaderboard.allRankings}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {LEADERBOARD_DATA.map((entry) => {
              const rankConf = RANK_CONFIG[entry.rank];
              return (
                <div
                  key={entry.rank}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-8 text-center">
                    {rankConf?.icon ?? (
                      <span className="text-sm font-bold text-muted-foreground">{entry.rank}</span>
                    )}
                  </div>
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-gradient-to-br from-violet-400 to-cyan-400 text-white text-xs font-bold">
                      {entry.firstName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{entry.firstName}</p>
                    <p className="text-xs text-muted-foreground">@{entry.username}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Coins className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                        {entry.points.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{entry.postCount}{t.leaderboard.posts}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
