"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function TelegramAutoLogin() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { setUser, setToken } = useAuthStore();
  const attempted = useRef(false);

  useEffect(() => {
    const tgToken = searchParams.get("tg");
    if (!tgToken) return;

    if (attempted.current) return;
    attempted.current = true;

    (async () => {
      const toastId = toast.loading("텔레그램 자동 로그인 중…");
      try {
        const res = await fetch(`${API}/api/auth/bot-token?token=${encodeURIComponent(tgToken)}`);

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const message = (errBody as { message?: string }).message ?? `서버 오류 ${res.status}`;
          toast.error(`로그인 실패: ${message}`, { id: toastId });
          // Clean URL even on failure so user can retry manually
          const params = new URLSearchParams(searchParams.toString());
          params.delete("tg");
          const newUrl = params.size ? `${pathname}?${params}` : pathname;
          router.replace(newUrl);
          return;
        }

        const data: { token: string; user: Record<string, unknown> } = await res.json();
        setToken(data.token);
        setUser(data.user as unknown as Parameters<typeof setUser>[0]);

        toast.success("✅ 로그인 성공!", { id: toastId });

        // Remove ?tg=... from URL without full reload
        const params = new URLSearchParams(searchParams.toString());
        params.delete("tg");
        const newUrl = params.size ? `${pathname}?${params}` : pathname;
        router.replace(newUrl);
      } catch (err) {
        toast.error(
          `로그인 오류: ${err instanceof Error ? err.message : "네트워크 연결을 확인해주세요"}`,
          { id: toastId },
        );
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}
