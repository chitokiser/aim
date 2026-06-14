"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function TelegramAutoLogin() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, setToken } = useAuthStore();
  const attempted = useRef(false);

  useEffect(() => {
    const tgToken = searchParams.get("tg");
    if (!tgToken || user || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        const res = await fetch(`${API}/auth/bot-token?token=${encodeURIComponent(tgToken)}`);
        if (!res.ok) return;
        const data: { token: string; user: Record<string, unknown> } = await res.json();
        setToken(data.token);
        setUser(data.user as unknown as Parameters<typeof setUser>[0]);

        // Remove ?tg=... from URL without full reload
        const params = new URLSearchParams(searchParams.toString());
        params.delete("tg");
        const newUrl = params.size ? `${pathname}?${params}` : pathname;
        router.replace(newUrl);
      } catch {
        // Silently ignore — user can still log in manually
      }
    })();
  }, [searchParams, user, setUser, setToken, router, pathname]);

  return null;
}
