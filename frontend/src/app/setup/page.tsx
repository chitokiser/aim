"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Lock } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function SetupPage() {
  const router = useRouter();
  const { user: currentUser, setUser, setToken } = useAuthStore();
  const [setupToken, setSetupToken] = useState("");
  const [firstName, setFirstName] = useState(currentUser?.firstName ?? "");
  const [username, setUsername] = useState(currentUser?.username ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "daguri75@gmail.com");
  const [telegramId, setTelegramId] = useState(currentUser?.telegramId ?? "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupToken.trim() || !firstName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/bootstrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupToken: setupToken.trim(),
          firstName: firstName.trim(),
          username: username.trim() || undefined,
          email: email.trim() || undefined,
          telegramId: telegramId.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        if (res.status === 403) {
          toast.error("Invalid setup token or admin already exists.");
        } else {
          toast.error(err.message ?? "Setup failed");
        }
        return;
      }

      const data = await res.json() as { token: string; user: Parameters<typeof setUser>[0] };
      setToken(data.token);
      setUser(data.user);
      toast.success("Admin account created! Welcome.");
      router.push("/admin");
    } catch {
      toast.error("Network error — is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center text-white">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-xl">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-black mb-2">First-Time Setup</h1>
          <p className="text-slate-400">Create the initial admin account</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur text-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-4 w-4 text-violet-400" />
              Bootstrap Admin
            </CardTitle>
            <CardDescription className="text-slate-400">
              Enter the <code className="text-violet-300">SETUP_SECRET</code> from your backend{" "}
              <code className="text-slate-300">.env</code> file. This only works once — if an admin
              already exists, this form will be rejected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Setup Secret</Label>
                <Input
                  type="password"
                  placeholder="Enter SETUP_SECRET value"
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Your Name</Label>
                <Input
                  placeholder="e.g. Admin"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">
                  Telegram ID{" "}
                  <span className="text-violet-400 text-xs">(권장 — 텔레그램 로그인 유저 승격)</span>
                </Label>
                <Input
                  placeholder="e.g. 123456789"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
                {currentUser?.telegramId && (
                  <p className="text-xs text-violet-400">
                    현재 로그인: <code>{currentUser.telegramId}</code> ({currentUser.firstName})
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Google Email <span className="text-slate-500">(구글 로그인 매칭용)</span></Label>
                <Input
                  type="email"
                  placeholder="your@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Username <span className="text-slate-500">(optional)</span></Label>
                <Input
                  placeholder="e.g. admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !setupToken || !firstName}
                className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
              >
                {loading ? "Creating admin…" : "Create Admin Account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-slate-500 space-y-1">
          <p>After setup, go to <code className="text-violet-400">/admin/telegram</code> to configure your bot.</p>
          <p>Remove or blank out <code className="text-slate-400">SETUP_SECRET</code> in .env when done.</p>
        </div>
      </div>
    </div>
  );
}
