"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useCartStore } from "@/lib/cart-store";
import { useLanguage, type Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Coins, Trophy, Target, Home, LayoutDashboard, Megaphone,
  Menu, X, Send, LogOut, Zap, Store, Sparkles, Gavel, ChevronDown, Mic, Bot, Film, Music,
  ArrowLeftRight, ShoppingBag, Package, Star, FileText, ShoppingCart, Tag,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const LANG_OPTIONS: { code: Lang; flag: string; label: string }[] = [
  { code: "en", flag: "🇺🇸", label: "EN" },
  { code: "ko", flag: "🇰🇷", label: "한" },
  { code: "vi", flag: "🇻🇳", label: "VI" },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, logout, token, setUser } = useAuthStore();
  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const { lang, setLang, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Refresh AP balance from Firestore on mount so nav always shows live value
  useEffect(() => {
    if (!token) return;
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    fetch(`${API}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setUser(data); })
      .catch(() => {});
  }, [token, setUser]);

  const primaryLinks = [
    { href: "/", label: t.nav.home, icon: Home },
    { href: "/missions", label: t.nav.missions, icon: Target },
    { href: "/leaderboard", label: t.nav.leaderboard, icon: Trophy },
  ];

  const chargeLinks = [
    { href: "/topup", label: t.nav.apCharge, icon: Zap },
    { href: "/profile?tab=withdrawal", label: t.nav.apExchange, icon: ArrowLeftRight },
  ];

  const serviceLinks = [
    { href: "/advertiser", label: t.nav.advertiser, icon: Megaphone },
    { href: "/marketplace", label: t.nav.marketplace, icon: Store },
    { href: "/creative-market", label: t.nav.creativeMarket, icon: Sparkles },
    { href: "/auction", label: t.nav.auction, icon: Gavel },
    { href: "/coupang", label: "트렌드픽", icon: ShoppingBag },
    { href: "/affiliate", label: t.nav.affiliate, icon: Tag },
    { href: "/blog", label: t.nav.blog, icon: FileText },
  ];

  const shopCategories: { value: string; label: string }[] = [
    { value: "all", label: t.shop.categories.all },
    { value: "fashion", label: t.shop.categories.fashion },
    { value: "beachClothing", label: t.shop.categories.beachClothing },
    { value: "womenClothing", label: t.shop.categories.womenClothing },
    { value: "menClothing", label: t.shop.categories.menClothing },
    { value: "beauty", label: t.shop.categories.beauty },
    { value: "electronics", label: t.shop.categories.electronics },
    { value: "smartphone", label: t.shop.categories.smartphone },
    { value: "household", label: t.shop.categories.household },
    { value: "kitchen", label: t.shop.categories.kitchen },
    { value: "kids", label: t.shop.categories.kids },
    { value: "pet", label: t.shop.categories.pet },
    { value: "jewelry", label: t.shop.categories.jewelry },
    { value: "watches", label: t.shop.categories.watches },
    { value: "optical", label: t.shop.categories.optical },
    { value: "bagsShoes", label: t.shop.categories.bagsShoes },
    { value: "carAccessories", label: t.shop.categories.carAccessories },
    { value: "lighting", label: t.shop.categories.lighting },
    { value: "homeDecor", label: t.shop.categories.homeDecor },
    { value: "sportsOutdoor", label: t.shop.categories.sportsOutdoor },
    { value: "toysHobby", label: t.shop.categories.toysHobby },
    { value: "art", label: t.shop.categories.art },
  ];

  const aiServiceLinks = [
    { href: "/tts", label: t.nav.tts, icon: Mic },
    { href: "/music-video", label: t.nav.musicVideo, icon: Film },
    { href: "/music-gen", label: t.nav.musicGen, icon: Music },
  ];

  const formatCompact = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const isServiceActive =
    serviceLinks.some((l) => pathname === l.href) ||
    aiServiceLinks.some((l) => pathname === l.href) ||
    pathname === "/shop";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/aimlogo.png"
            alt="AI119 Logo"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <span className="hidden font-bold text-lg sm:block">AI119</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {primaryLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === href ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}

          {/* Services dropdown — Shop, Advertiser services, and AI tools all live here */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isServiceActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                )}
              >
                {t.nav.services}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link href="/shop" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {t.nav.shop}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {t.nav.shopCategories}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                  {shopCategories.map(({ value, label }) => (
                    <DropdownMenuItem key={value} asChild>
                      <Link href={value === "all" ? "/shop" : `/shop?category=${value}`}>
                        {label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  {t.nav.aiServices}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {aiServiceLinks.map(({ href, label, icon: Icon }) => (
                    <DropdownMenuItem key={href} asChild>
                      <Link href={href} className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              {serviceLinks.map(({ href, label, icon: Icon }) => (
                <DropdownMenuItem key={href} asChild>
                  <Link href={href} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <div className="flex items-center gap-0.5 rounded-full border px-1 py-0.5">
            {LANG_OPTIONS.map(({ code, flag, label }) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                title={label}
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-base leading-none transition-all",
                  lang === code
                    ? "bg-violet-600 ring-2 ring-violet-400 ring-offset-1 scale-110"
                    : "opacity-50 hover:opacity-100"
                )}
              >
                {flag}
              </button>
            ))}
          </div>

          {/* Cart icon — always visible once mounted so guests can see it too */}
          {mounted && (
            <Link href="/shop/cart" className="relative">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ShoppingCart className="h-4 w-4" />
              </Button>
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          )}

          {(mounted && user) ? (
            <>
              {/* AP / EXP Badge — visible at every breakpoint so mobile users see their balance too */}
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="hidden sm:flex items-center gap-1 rounded-full bg-muted border px-2.5 py-1">
                  <Send className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-mono text-muted-foreground">{user.telegramId}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-200 dark:border-violet-800 px-2 py-0.5 sm:px-3 sm:py-1">
                  <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-violet-700 dark:text-violet-400 whitespace-nowrap">
                    <span className="sm:hidden">{formatCompact(user.points)}</span>
                    <span className="hidden sm:inline">{user.points.toLocaleString()} AP</span>
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200 dark:border-amber-800 px-2 py-0.5 sm:px-3 sm:py-1">
                  <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                    <span className="sm:hidden">{formatCompact(user.exp ?? 0)}</span>
                    <span className="hidden sm:inline">Lv.{user.level ?? 1} · {(user.exp ?? 0).toLocaleString()} EXP</span>
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
                  {chargeLinks.map(({ href, label, icon: Icon }) => (
                    <DropdownMenuItem key={href} asChild>
                      <Link href={href}>
                        <Icon className="mr-2 h-4 w-4" />
                        {label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
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
                &gt; {t.nav.getStarted}
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
          {primaryLinks.map(({ href, label, icon: Icon }) => (
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
          <div className="pt-1 border-t mt-1">
            <p className="px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              {t.nav.topup}
            </p>
            {chargeLinks.map(({ href, label, icon: Icon }) => (
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
          </div>
          <div className="pt-1 border-t mt-1">
            <Link
              href="/shop"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
                pathname === "/shop" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <Package className="h-4 w-4" />
              {t.nav.shop}
            </Link>
            <p className="px-3 pt-1 pb-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
              {t.nav.shopCategories}
            </p>
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              {shopCategories.map(({ value, label }) => (
                <Link
                  key={value}
                  href={value === "all" ? "/shop" : `/shop?category=${value}`}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="pt-1 border-t mt-1">
            {serviceLinks.map(({ href, label, icon: Icon }) => (
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
          </div>
          <div className="pt-1 border-t mt-1">
            <p className="px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              {t.nav.aiServices}
            </p>
            {aiServiceLinks.map(({ href, label, icon: Icon }) => (
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
          </div>
          {(mounted && user) && (
            <div className="pt-2 border-t mt-2 space-y-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-950/20 px-3 py-1.5 w-fit">
                  <Coins className="h-4 w-4 text-violet-600" />
                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                    {user.points.toLocaleString()} AP
                  </span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 w-fit">
                  <Star className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    Lv.{user.level ?? 1} · {(user.exp ?? 0).toLocaleString()} EXP
                  </span>
                </div>
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
