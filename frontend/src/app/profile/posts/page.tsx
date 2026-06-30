"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, ExternalLink } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Submission {
  id: string;
  missionTitle: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export default function ProfilePostsPage() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const { t } = useLanguage();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    if (!token) return;
    fetch(`${API}/api/missions/my-submissions`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .then((data) => setSubmissions(Array.isArray(data) ? data : []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, [user, token, router]);

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-green-500 text-white text-xs">승인</Badge>;
    if (status === "rejected") return <Badge variant="destructive" className="text-xs">거절</Badge>;
    return <Badge variant="secondary" className="text-xs">검토 중</Badge>;
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black mb-1 flex items-center gap-2">
          <FileText className="h-6 w-6 text-violet-500" />
          {t.nav.myPosts}
        </h1>
        <p className="text-sm text-muted-foreground">내가 제출한 미션 게시물 내역입니다.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">불러오는 중...</span>
        </div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-4 opacity-20" />
            <p className="text-sm">제출한 게시물이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{s.missionTitle}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {statusBadge(s.status)}
                  <a
                    href={`/missions`}
                    className="text-xs text-violet-500 hover:underline flex items-center gap-1"
                  >
                    미션 보기 <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
