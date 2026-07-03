"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function DailyVisitTracker() {
  const { token } = useAuthStore();
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        const res = await fetch(`${API}/api/users/daily-visit`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        const data: { awarded: boolean; exp: number } = await res.json();
        if (data.awarded) {
          toast.success(`✨ +${data.exp.toLocaleString()} EXP (daily visit bonus)`);
        }
      } catch {
        // Silent — daily visit bonus is a non-critical background action
      }
    })();
  }, [token]);

  return null;
}
