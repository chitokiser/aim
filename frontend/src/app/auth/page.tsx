"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Shield, Zap, Coins } from "lucide-react";

declare global {
  interface Window {
    TelegramLoginWidget?: {
      dataOnauth: (user: TelegramUser) => void;
    };
  }
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export default function AuthPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "AIM_Hub_bot";

    window.TelegramLoginWidget = {
      dataOnauth: async (telegramUser: TelegramUser) => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/auth/telegram`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(telegramUser),
          });

          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
            router.push("/");
          } else {
            console.error("Auth failed");
          }
        } catch (err) {
          console.error("Auth error:", err);
          // Demo fallback
          const demoUser = {
            id: String(telegramUser.id),
            telegramId: String(telegramUser.id),
            username: telegramUser.username || `user${telegramUser.id}`,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
            photoUrl: telegramUser.photo_url,
            points: 5000,
            referralCode: `REF${telegramUser.id}`,
            createdAt: new Date(),
          };
          setUser(demoUser);
          router.push("/");
        }
      },
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "TelegramLoginWidget.dataOnauth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;

    if (widgetRef.current) {
      widgetRef.current.innerHTML = "";
      widgetRef.current.appendChild(script);
    }

    return () => {
      if (widgetRef.current) {
        widgetRef.current.innerHTML = "";
      }
    };
  }, [router, setUser]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center text-white">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-xl">
              <span className="text-2xl font-black">AIM</span>
            </div>
          </div>
          <h1 className="text-3xl font-black mb-2">AI Money Makers Hub</h1>
          <p className="text-slate-400">AI 창작으로 TON코인을 버세요</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur text-white">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">텔레그램으로 시작하기</CardTitle>
            <CardDescription className="text-slate-400">
              텔레그램 계정으로 안전하게 로그인하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Telegram Widget */}
            <div className="flex justify-center">
              <div ref={widgetRef} className="telegram-login-widget" />
            </div>

            <div className="border-t border-slate-700 pt-4 space-y-3">
              {[
                { icon: Shield, text: "텔레그램 공식 인증 · 개인정보 안전" },
                { icon: Zap, text: "즉시 미션 참여 가능" },
                { icon: Coins, text: "포인트 → TON코인 개인 지갑 직접 출금" },
                { icon: Bot, text: "AIM 봇으로 자동 검수 및 보상 지급" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-slate-300">
                  <Icon className="h-4 w-4 text-violet-400 shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-slate-500">
          가입 시{" "}
          <a href="/terms" className="text-violet-400 hover:underline">이용약관</a>
          {" "}및{" "}
          <a href="/privacy" className="text-violet-400 hover:underline">개인정보처리방침</a>
          에 동의합니다
        </div>
      </div>
    </div>
  );
}
