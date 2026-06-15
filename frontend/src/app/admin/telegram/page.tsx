"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bot, Users, Radio, Smartphone, Save, Eye, EyeOff,
  CheckCircle2, XCircle, ArrowLeft, Copy,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface TelegramSettings {
  botToken?: string;
  botUsername?: string;
  miniAppUrl?: string;
  groupId?: string;
  groupInviteLink?: string;
  groupName?: string;
  channelId?: string;
  channelUsername?: string;
  channelName?: string;
  tonWalletAddress?: string;
}

function StatusBadge({ value }: { value?: string }) {
  return value ? (
    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 gap-1">
      <CheckCircle2 className="h-3 w-3" /> Configured
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1">
      <XCircle className="h-3 w-3" /> Not set
    </Badge>
  );
}

export default function TelegramSettingsPage() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const [settings, setSettings] = useState<TelegramSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/users/admin/telegram-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as TelegramSettings;
        setSettings(data);
      }
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!user) { router.push("/auth"); return; }
    void load();
  }, [user, load, router]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/users/admin/telegram-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      toast.success("Telegram settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof TelegramSettings, value: string) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="text-muted-foreground">Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Admin
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-black">Telegram Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure Bot, Mini App, Group, and Channel
          </p>
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving…" : "Save All"}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Bot */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-violet-500" />
                <CardTitle className="text-base">Telegram Bot</CardTitle>
              </div>
              <StatusBadge value={settings.botToken} />
            </div>
            <CardDescription>
              Bot token from @BotFather. Keep this secret — never share it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Bot Token</Label>
              <div className="flex gap-2">
                <Input
                  type={showToken ? "text" : "password"}
                  placeholder="1234567890:AAHxxxx..."
                  value={settings.botToken ?? ""}
                  onChange={(e) => set("botToken", e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowToken((v) => !v)}
                  title={showToken ? "Hide token" : "Show token"}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Bot Username (without @)</Label>
              <Input
                placeholder="ai_bootcamp_hub_bot"
                value={settings.botUsername ?? ""}
                onChange={(e) => set("botUsername", e.target.value)}
              />
            </div>
            {settings.botUsername && (
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <p className="font-medium">Bot links</p>
                <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span>https://t.me/{settings.botUsername}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => copyToClipboard(`https://t.me/${settings.botUsername}`)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mini App */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-cyan-500" />
                <CardTitle className="text-base">Telegram Mini App</CardTitle>
              </div>
              <StatusBadge value={settings.miniAppUrl} />
            </div>
            <CardDescription>
              The Mini App URL set up via @BotFather → Edit Bot → Bot Menu Button.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Mini App URL</Label>
              <Input
                type="url"
                placeholder="https://t.me/YourBot/app"
                value={settings.miniAppUrl ?? ""}
                onChange={(e) => set("miniAppUrl", e.target.value)}
              />
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-semibold">Setup instructions</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Go to @BotFather → /mybots → Select your bot</li>
                <li>Bot Settings → Menu Button → Configure menu button</li>
                <li>Set button text (e.g. "🚀 Open AI119") and paste the URL above</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Group */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-base">Telegram Group</CardTitle>
              </div>
              <StatusBadge value={settings.groupId} />
            </div>
            <CardDescription>
              The main community group. Members auto-register when they join via the invite link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Group Name</Label>
              <Input
                placeholder="AI119 Official Community"
                value={settings.groupName ?? ""}
                onChange={(e) => set("groupName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Group Chat ID</Label>
              <Input
                placeholder="-100123456789"
                value={settings.groupId ?? ""}
                onChange={(e) => set("groupId", e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Add @userinfobot to your group to get the Chat ID, or forward a message from the group to the bot.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Default Invite Link</Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://t.me/+xxxxxxxx"
                  value={settings.groupInviteLink ?? ""}
                  onChange={(e) => set("groupInviteLink", e.target.value)}
                />
                {settings.groupInviteLink && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(settings.groupInviteLink!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Channel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-green-500" />
                <CardTitle className="text-base">Telegram Channel</CardTitle>
              </div>
              <StatusBadge value={settings.channelId} />
            </div>
            <CardDescription>
              Announcement channel for missions, events, and rewards.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Channel Name</Label>
              <Input
                placeholder="AI119 Announcements"
                value={settings.channelName ?? ""}
                onChange={(e) => set("channelName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Channel ID</Label>
              <Input
                placeholder="-100987654321"
                value={settings.channelId ?? ""}
                onChange={(e) => set("channelId", e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Channel Username (without @)</Label>
              <Input
                placeholder="ai119_announcements"
                value={settings.channelUsername ?? ""}
                onChange={(e) => set("channelUsername", e.target.value)}
              />
            </div>
            {settings.channelUsername && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted font-mono text-xs text-muted-foreground">
                <span>https://t.me/{settings.channelUsername}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => copyToClipboard(`https://t.me/${settings.channelUsername}`)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TON Wallet */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">💎</span>
                <CardTitle className="text-base">TON Payment Wallet</CardTitle>
              </div>
              <StatusBadge value={settings.tonWalletAddress} />
            </div>
            <CardDescription>
              Platform TON wallet address. Advertisers send TON with their Telegram ID as memo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>TON Wallet Address</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="EQD...abc"
                  value={settings.tonWalletAddress ?? ""}
                  onChange={(e) => set("tonWalletAddress", e.target.value)}
                  className="font-mono text-sm"
                />
                {settings.tonWalletAddress && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(settings.tonWalletAddress!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Advertiser must include their Telegram ID as the transfer comment/memo for manual verification.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-2">
          <Button
            onClick={save}
            disabled={saving}
            size="lg"
            className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving…" : "Save All Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
