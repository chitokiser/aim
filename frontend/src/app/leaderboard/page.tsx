"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Trophy, Medal, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  firstName: string;
  photoUrl: string | null;
  points: number;
  missionsCompleted: number;
}

const RANK_CONFIG: Record<number, { color: string; icon?: React.ReactNode }> = {
  1: { color: "text-amber-500", icon: <Trophy className="h-5 w-5 text-amber-500" /> },
  2: { color: "text-slate-400", icon: <Medal  className="h-5 w-5 text-slate-400" /> },
  3: { color: "text-amber-700", icon: <Medal  className="h-5 w-5 text-amber-700" /> },
};

export default function LeaderboardPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/users/leaderboard/list`)
      .then((r) => r.json())
      .then((rows: LeaderboardEntry[]) => setData(rows))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const top3 = data.slice(0, 3);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">
        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>아직 미션 완료 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-black mb-3">{t.leaderboard.title}</h1>
        <p className="text-muted-foreground">{t.leaderboard.subtitle}</p>
      </div>

      {/* Top 3 Podium */}
      {top3.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* 2nd */}
          <div className="flex flex-col items-center pt-8">
            <div className="relative mb-2">
              <Avatar className="h-14 w-14 ring-2 ring-slate-300">
                <AvatarFallback className="bg-slate-200 text-slate-600 font-bold text-lg">
                  {(top3[1].firstName || top3[1].username || "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="text-center">
              <p className="font-bold text-sm">{top3[1].firstName || top3[1].username}</p>
              {top3[1].username && <p className="text-xs text-muted-foreground">@{top3[1].username}</p>}
              <div className="flex items-center gap-1 justify-center mt-1">
                <CheckCircle className="h-3 w-3 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">{top3[1].missionsCompleted} {t.leaderboard.posts}</span>
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
                  {(top3[0].firstName || top3[0].username || "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="text-center">
              <p className="font-black text-sm">{top3[0].firstName || top3[0].username}</p>
              {top3[0].username && <p className="text-xs text-muted-foreground">@{top3[0].username}</p>}
              <div className="flex items-center gap-1 justify-center mt-1">
                <CheckCircle className="h-3 w-3 text-amber-500" />
                <span className="text-xs font-semibold text-amber-600">{top3[0].missionsCompleted} {t.leaderboard.posts}</span>
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
                  {(top3[2].firstName || top3[2].username || "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="text-center">
              <p className="font-bold text-sm">{top3[2].firstName || top3[2].username}</p>
              {top3[2].username && <p className="text-xs text-muted-foreground">@{top3[2].username}</p>}
              <div className="flex items-center gap-1 justify-center mt-1">
                <CheckCircle className="h-3 w-3 text-amber-700" />
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-600">{top3[2].missionsCompleted} {t.leaderboard.posts}</span>
              </div>
            </div>
            <div className="mt-3 w-full bg-amber-700/80 rounded-t-lg flex items-center justify-center py-2 font-black text-2xl text-white">
              3
            </div>
          </div>
        </div>
      )}

      {/* Full rankings list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.leaderboard.allRankings}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.map((entry) => {
              const rankConf = RANK_CONFIG[entry.rank];
              return (
                <div
                  key={entry.userId}
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
                        {(entry.firstName || entry.username || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{entry.firstName || entry.username}</p>
                    {entry.username && <p className="text-xs text-muted-foreground">@{entry.username}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <CheckCircle className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                        {entry.missionsCompleted}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.leaderboard.posts}</p>
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
