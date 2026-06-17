"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useLanguage, type Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Coins, Trophy, Target, Home, LayoutDashboard, Megaphone, Menu, X, Send, LogOut, Zap, Store, Sparkles, Gavel } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const LANG_OPTIONS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "ko", label: "한" },
  { code: "vi", label: "VI" },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { lang, setLang, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const navLinks = [
    { href: "/", label: t.nav.home, icon: Home },
    { href: "/missions", label: t.nav.missions, icon: Target },
    { href: "/advertiser", label: t.nav.advertiser, icon: Megaphone },
    { href: "/marketplace", label: t.nav.marketplace, icon: Store },
    { href: "/creative-market", label: t.nav.creativeMarket, icon: Sparkles },
    { href: "/auction", label: t.nav.auction, icon: Gavel },
    { href: "/leaderboard", label: t.nav.leaderboard, icon: Trophy },
    { href: "/topup", label: t.nav.topup, icon: Zap },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/aimlogo.png"
            alt="AIM Logo"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <span className="hidden font-bold text-lg sm:block">AI119</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === href ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <div className="flex items-center gap-0.5 rounded-full border px-1 py-0.5">
            {LANG_OPTIONS.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold transition-colors",
                  lang === code
                    ? "bg-violet-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {(mounted && user) ? (
            <>
              {/* Telegram ID + Points Badge */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-full bg-muted border px-2.5 py-1">
                  <Send className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-mono text-muted-foreground">{user.telegramId}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-200 dark:border-violet-800 px-3 py-1">
                  <Coins className="h-4 w-4 text-violet-600" />
                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                    {user.points.toLocaleString()} AP
                  </span>
                </div>
              </div>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.photoUrl ?? undefined} alt={user.username ?? undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-violet-500 to-cyan-500 text-white text-xs font-bold">
                        {user.firstName?.[0]?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center gap-2 p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.photoUrl ?? undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-violet-500 to-cyan-500 text-white text-xs">
                        {user.firstName?.[0]?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{user.firstName}</span>
                      <span className="text-xs text-muted-foreground">@{user.username}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground/70 mt-0.5">
                        <Send className="h-2.5 w-2.5" />
                        ID: {user.telegramId}
                      </span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile">{t.nav.myProfile}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile/posts">{t.nav.myPosts}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile/points">{t.nav.pointHistory}</Link>
                  </DropdownMenuItem>
                  {user.isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          {t.nav.admin}
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/advertiser">
                      <Megaphone className="mr-2 h-4 w-4" />
                      {t.nav.advertiser}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400">
                    {t.nav.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link href="/auth">
              <Button className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90 text-sm">
                &gt; 시작하기
              </Button>
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-background px-4 py-3 space-y-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
                pathname === href ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {(mounted && user) && (
            <div className="pt-2 border-t mt-2 space-y-1">
              <div className="flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-950/20 px-3 py-1.5 w-fit mb-2">
                <Coins className="h-4 w-4 text-violet-600" />
                <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                  {user.points.toLocaleString()} AP
                </span>
              </div>
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
              >
                {t.nav.myProfile}
              </Link>
              {user.isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-violet-600 hover:bg-accent transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  {t.nav.admin}
                </Link>
              )}
              <Link
                href="/marketplace"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-green-600 hover:bg-accent transition-colors"
              >
                <Store className="h-4 w-4" />
                {t.nav.marketplace}
              </Link>
              <Link
                href="/creative-market"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-pink-600 hover:bg-accent transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                {t.nav.creativeMarket}
              </Link>
              <Link
                href="/auction"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-amber-600 hover:bg-accent transition-colors"
              >
                <Gavel className="h-4 w-4" />
                {t.nav.auction}
              </Link>
              <Link
                href="/advertiser"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-cyan-600 hover:bg-accent transition-colors"
              >
                <Megaphone className="h-4 w-4" />
                {t.nav.advertiser}
              </Link>
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t.nav.logout}
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
