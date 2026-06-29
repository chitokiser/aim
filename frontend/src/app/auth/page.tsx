"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bot, Shield, Zap, Coins } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "AIM_Hub_bot";

export default function AuthPage() {
  const router = useRouter();
  const { setUser, setToken } = useAuthStore();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [refCode, setRefCode] = useState("");
  const { t } = useLanguage();

  // Auto-fill referral code from URL ?ref= parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setRefCode(ref.trim().toUpperCase());
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      // Try backend exchange (registers user in DB, returns custom JWT)
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${API}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, refCode: refCode || undefined }),
          signal: controller.signal,
        });
        clearTimeout(tid);

        if (res.ok) {
          const data = await res.json() as { token: string; user: Parameters<typeof setUser>[0] };
          setToken(data.token);
          setUser(data.user);
          router.push("/");
          return;
        }
      } catch {
        // Backend unavailable — fall back to Firebase client auth below
      }

      // Fallback: use Firebase user directly with Firebase ID token
      const fbUser = result.user;
      const nameParts = (fbUser.displayName ?? "").split(" ");
      setToken(idToken);
      setUser({
        id: fbUser.uid,
        googleId: fbUser.uid,
        email: fbUser.email ?? undefined,
        username: fbUser.email?.split("@")[0] ?? fbUser.uid,
        firstName: nameParts[0] ?? "",
        lastName: nameParts.slice(1).join(" ") || undefined,
        photoUrl: fbUser.photoURL ?? null,
        points: 0,
        referralCode: "",
        createdAt: new Date(),
      });
      router.push("/");
    } catch (err) {
      console.error("Google login error:", err);
      toast.error("Google login failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };


  const features = [
    { icon: Shield, text: t.auth.feature1 },
    { icon: Zap, text: t.auth.feature2 },
    { icon: Coins, text: t.auth.feature3 },
    { icon: Bot, text: t.auth.feature4 },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center text-white">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-xl">
              <span className="text-2xl font-black">AIM</span>
            </div>
          </div>
          <h1 className="text-3xl font-black mb-2">AI119</h1>
          <p className="text-slate-400">{t.auth.subtitle}</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur text-white">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">{t.auth.cardTitle}</CardTitle>
            <CardDescription className="text-slate-400">{t.auth.cardDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Referral code */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">{t.auth.refCodeLabel}</label>
              <Input
                value={refCode}
                onChange={(e) => setRefCode(e.target.value.trim().toUpperCase())}
                placeholder={t.auth.refCodePlaceholder}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            {/* Primary: Telegram Bot login (works without BotFather domain setup) */}
            <a
              href={`https://t.me/${BOT_USERNAME}?start=login`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 rounded-md bg-[#2AABEE] hover:bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
              </svg>
              Login with Telegram Bot
            </a>

            <p className="text-center text-xs text-slate-500">
              Opens the bot → send <code className="text-slate-400">/login</code> → tap the link to sign in
            </p>

            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-slate-600" />
              <span className="text-xs text-slate-500">{t.auth.orDivider}</span>
              <div className="flex-1 border-t border-slate-600" />
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 rounded-md border border-slate-600 bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                <path fill="#FFC107" d="M43.6 20.2H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.8z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16.1 18.9 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8H6.3C9.7 35.7 16.3 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.2H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.8z"/>
              </svg>
              {googleLoading ? "..." : t.auth.googleLogin}
            </button>

            <div className="border-t border-slate-700 pt-4 space-y-3">
              {features.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-slate-300">
                  <Icon className="h-4 w-4 text-violet-400 shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-slate-500">
          {t.auth.agreePrefix}{" "}
          <a href="/terms" className="text-violet-400 hover:underline">{t.auth.terms}</a>
          {" "}{t.auth.and}{" "}
          <a href="/privacy" className="text-violet-400 hover:underline">{t.auth.privacy}</a>
        </div>

        <div className="text-center text-xs text-slate-600">
          <span>Use Telegram bot? Send </span>
          <code className="text-slate-500">/login</code>
          <span> to get a sign-in link directly.</span>
        </div>
      </div>
    </div>
  );
}
