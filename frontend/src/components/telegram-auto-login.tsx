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
  const { user, setUser, setToken } = useAuthStore();
  const attempted = useRef(false);

  useEffect(() => {
    const tgToken = searchParams.get("tg");
    if (!tgToken) return;

    // Already logged in — just clean the URL
    if (user) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tg");
      const newUrl = params.size ? `${pathname}?${params}` : pathname;
      router.replace(newUrl);
      return;
    }

    if (attempted.current) return;
    attempted.current = true;

    (async () => {
      const toastId = toast.loading("Signing in with Telegram…");
      try {
        const res = await fetch(`${API}/api/auth/bot-token?token=${encodeURIComponent(tgToken)}`);

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const message = (errBody as { message?: string }).message ?? `Server error ${res.status}`;
          toast.error(`Login failed: ${message}`, { id: toastId });
          return;
        }

        const data: { token: string; user: Record<string, unknown> } = await res.json();
        setToken(data.token);
        setUser(data.user as unknown as Parameters<typeof setUser>[0]);

        toast.success("Signed in via Telegram!", { id: toastId });

        // Remove ?tg=... from URL without full reload
        const params = new URLSearchParams(searchParams.toString());
        params.delete("tg");
        const newUrl = params.size ? `${pathname}?${params}` : pathname;
        router.replace(newUrl);
      } catch (err) {
        toast.error(`Login error: ${err instanceof Error ? err.message : "Network error"}`, { id: toastId });
      }
    })();
  }, [searchParams, user, setUser, setToken, router, pathname]);

  return null;
}
