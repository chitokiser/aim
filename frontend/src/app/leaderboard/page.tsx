"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, Trophy, Medal } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const ALL_DATA = [
  { rank: 1,  username: "aimaster_kim",   firstName: "MinJun Kim",       flag: "🇰🇷", points: 2450000, postCount: 89 },
  { rank: 2,  username: "alex_creator",   firstName: "Alex Johnson",      flag: "🇺🇸", points: 1980000, postCount: 67 },
  { rank: 3,  username: "nguyen_thanh",   firstName: "Nguyễn Thành",      flag: "🇻🇳", points: 1750000, postCount: 54 },
  { rank: 4,  username: "ivan_petrov",    firstName: "Ivan Petrov",       flag: "🇷🇺", points: 1540000, postCount: 48 },
  { rank: 5,  username: "sarah_wills",    firstName: "Sarah Williams",    flag: "🇬🇧", points: 1320000, postCount: 42 },
  { rank: 6,  username: "tran_van_ai",    firstName: "Trần Văn Minh",     flag: "🇻🇳", points: 1180000, postCount: 38 },
  { rank: 7,  username: "dmitri_pro",     firstName: "Dmitri Volkov",     flag: "🇷🇺", points:  960000, postCount: 31 },
  { rank: 8,  username: "james_chen_au",  firstName: "James Chen",        flag: "🇦🇺", points:  840000, postCount: 27 },
  { rank: 9,  username: "maria_santos",   firstName: "Maria Santos",      flag: "🇵🇭", points:  720000, postCount: 23 },
  { rank: 10, username: "aimaker_lee",    firstName: "Seo-Yeon Lee",      flag: "🇰🇷", points:  650000, postCount: 21 },
  { rank: 11, username: "somchai_th",     firstName: "Somchai Panya",     flag: "🇹🇭", points:  580000, postCount: 19 },
  { rank: 12, username: "yuki_tanaka",    firstName: "Yuki Tanaka",       flag: "🇯🇵", points:  520000, postCount: 17 },
  { rank: 13, username: "budi_creator",   firstName: "Budi Santoso",      flag: "🇮🇩", points:  460000, postCount: 15 },
  { rank: 14, username: "emma_ca",        firstName: "Emma Tremblay",     flag: "🇨🇦", points:  410000, postCount: 14 },
  { rank: 15, username: "pham_thi_lan",   firstName: "Phạm Thị Lan",      flag: "🇻🇳", points:  370000, postCount: 12 },
  { rank: 16, username: "carlos_mx",      firstName: "Carlos García",     flag: "🇲🇽", points:  330000, postCount: 11 },
  { rank: 17, username: "olga_smile",     firstName: "Olga Smirnova",     flag: "🇷🇺", points:  295000, postCount: 10 },
  { rank: 18, username: "fatima_sg",      firstName: "Fatima Rahman",     flag: "🇸🇬", points:  260000, postCount:  9 },
  { rank: 19, username: "anna_muller",    firstName: "Anna Müller",       flag: "🇩🇪", points:  230000, postCount:  8 },
  { rank: 20, username: "akira_yama",     firstName: "Akira Yamamoto",    flag: "🇯🇵", points:  200000, postCount:  7 },
];

const PERIOD_MULTIPLIERS: Record<string, number> = {
  daily:   0.05,
  weekly:  0.25,
  monthly: 0.65,
  all:     1.00,
};

function formatAP(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const RANK_CONFIG: Record<number, { color: string; icon?: React.ReactNode }> = {
  1: { color: "text-amber-500", icon: <Trophy className="h-5 w-5 text-amber-500" /> },
  2: { color: "text-slate-400", icon: <Medal  className="h-5 w-5 text-slate-400" /> },
  3: { color: "text-amber-700", icon: <Medal  className="h-5 w-5 text-amber-700" /> },
};

export default function LeaderboardPage() {
  const [period, setPeriod] = useState("weekly");
  const { t } = useLanguage();

  const mult = PERIOD_MULTIPLIERS[period] ?? 1;
  const data = ALL_DATA.map((u) => ({
    ...u,
    points: Math.round(u.points * mult),
    postCount: Math.round(u.postCount * mult),
  }));

  const top3 = data.slice(0, 3);
  const rest  = data.slice(3);

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-black mb-3">{t.leaderboard.title}</h1>
        <p className="text-muted-foreground">{t.leaderboard.subtitle}</p>
      </div>

      <Tabs value={period} onValueChange={setPeriod} className="mb-8">
        <TabsList className="w-full">
          <TabsTrigger value="daily"   className="flex-1">{t.leaderboard.daily}</TabsTrigger>
          <TabsTrigger value="weekly"  className="flex-1">{t.leaderboard.weekly}</TabsTrigger>
          <TabsTrigger value="monthly" className="flex-1">{t.leaderboard.monthly}</TabsTrigger>
          <TabsTrigger value="all"     className="flex-1">{t.leaderboard.all}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* 2nd */}
        <div className="flex flex-col items-center pt-8">
          <div className="relative mb-2">
            <Avatar className="h-14 w-14 ring-2 ring-slate-300">
              <AvatarFallback className="bg-slate-200 text-slate-600 font-bold text-lg">
                {top3[1].firstName[0]}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 text-base leading-none">{top3[1].flag}</span>
          </div>
          <div className="text-center">
            <p className="font-bold text-sm">{top3[1].firstName}</p>
            <p className="text-xs text-muted-foreground">@{top3[1].username}</p>
            <div className="flex items-center gap-1 justify-center mt-1">
              <Coins className="h-3 w-3 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">{formatAP(top3[1].points)} AP</span>
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg flex items-center justify-center py-3 font-black text-2xl text-slate-400">
            2
          </div>
        </div>

        {/* 1st */}
        <div className="flex flex-col items-center">
          <div className="text-2xl mb-1">👑</div>
          <div className="relative mb-2">
            <Avatar className="h-16 w-16 ring-4 ring-amber-400">
              <AvatarFallback className="bg-amber-100 text-amber-700 font-black text-xl">
                {top3[0].firstName[0]}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 text-lg leading-none">{top3[0].flag}</span>
          </div>
          <div className="text-center">
            <p className="font-black text-sm">{top3[0].firstName}</p>
            <p className="text-xs text-muted-foreground">@{top3[0].username}</p>
            <div className="flex items-center gap-1 justify-center mt-1">
              <Coins className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-semibold text-amber-600">{formatAP(top3[0].points)} AP</span>
            </div>
          </div>
          <div className="mt-3 w-full bg-amber-400 rounded-t-lg flex items-center justify-center py-4 font-black text-2xl text-white">
            1
          </div>
        </div>

        {/* 3rd */}
        <div className="flex flex-col items-center pt-12">
          <div className="relative mb-2">
            <Avatar className="h-12 w-12 ring-2 ring-amber-700">
              <AvatarFallback className="bg-amber-50 text-amber-800 font-bold">
                {top3[2].firstName[0]}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 text-sm leading-none">{top3[2].flag}</span>
          </div>
          <div className="text-center">
            <p className="font-bold text-sm">{top3[2].firstName}</p>
            <p className="text-xs text-muted-foreground">@{top3[2].username}</p>
            <div className="flex items-center gap-1 justify-center mt-1">
              <Coins className="h-3 w-3 text-amber-700" />
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-600">{formatAP(top3[2].points)} AP</span>
            </div>
          </div>
          <div className="mt-3 w-full bg-amber-700/80 rounded-t-lg flex items-center justify-center py-2 font-black text-2xl text-white">
            3
          </div>
        </div>
      </div>

      {/* Rankings 4–20 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.leaderboard.allRankings}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {/* Top 3 rows first */}
            {data.map((entry) => {
              const rankConf = RANK_CONFIG[entry.rank];
              return (
                <div
                  key={entry.rank}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-7 text-center shrink-0">
                    {rankConf?.icon ?? (
                      <span className="text-sm font-bold text-muted-foreground">{entry.rank}</span>
                    )}
                  </div>
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-gradient-to-br from-violet-400 to-cyan-400 text-white text-xs font-bold">
                        {entry.firstName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">{entry.flag}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{entry.firstName}</p>
                    <p className="text-xs text-muted-foreground">@{entry.username}</p>
                  </div>
                  <div className="text-right shrink-0">
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

      {/* Country legend */}
      <div className="mt-6 p-4 rounded-xl bg-muted/40 text-xs text-muted-foreground">
        <p className="font-semibold mb-2">🌏 Global Community</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {[
            ["🇰🇷", "Korea"], ["🇺🇸", "USA"], ["🇻🇳", "Vietnam"],
            ["🇷🇺", "Russia"], ["🇬🇧", "UK"], ["🇦🇺", "Australia"],
            ["🇵🇭", "Philippines"], ["🇹🇭", "Thailand"], ["🇯🇵", "Japan"],
            ["🇮🇩", "Indonesia"], ["🇨🇦", "Canada"], ["🇲🇽", "Mexico"],
            ["🇸🇬", "Singapore"], ["🇩🇪", "Germany"],
          ].map(([flag, name]) => (
            <span key={name}>{flag} {name}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
