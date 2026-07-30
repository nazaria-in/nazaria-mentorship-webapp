// components/shell/AppShell.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Moon, Sun, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "@/components/shell/RoleSwitcher";
import { useRole } from "@/providers/role-provider";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "unreadNotifs" | "unreadMessages" | string;
}

export interface AppShellProps {
  navItems: NavItem[];
  pageTitle: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  unreadNotifCount?: number;
  unreadMessageCount?: number;
  onOpenNotifications?: () => void;
  onOpenMessages?: () => void;
  avatar?: React.ReactNode;
  globalSearch?: React.ReactNode;
}

// Bottom nav fits 4 icon+label items comfortably at mobile widths before
// crowding. Beyond that, the 5th slot becomes a "More" button that opens
// the rest in a sheet — rather than shrinking everything to fit, which
// makes labels unreadable.
const MOBILE_VISIBLE_LIMIT = 4;

function resolveBadge(item: NavItem, unreadNotifCount = 0, unreadMessageCount = 0) {
  if (item.badgeKey === "unreadNotifs") return unreadNotifCount;
  if (item.badgeKey === "unreadMessages") return unreadMessageCount;
  return 0;
}

export function AppShell({
  navItems,
  pageTitle,
  headerExtra,
  children,
  unreadNotifCount = 0,
  unreadMessageCount = 0,
  avatar,
  globalSearch,
}: AppShellProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { role } = useRole();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const overflow = navItems.length > MOBILE_VISIBLE_LIMIT;
  const mobileVisible = overflow ? navItems.slice(0, MOBILE_VISIBLE_LIMIT - 1) : navItems;
  const mobileOverflowItems = overflow ? navItems.slice(MOBILE_VISIBLE_LIMIT - 1) : [];
  const overflowHasActive = mobileOverflowItems.some((item) => pathname?.startsWith(item.href));

  return (
    <div className="flex h-dvh w-full bg-background text-foreground">
      {/* Desktop icon sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col items-center justify-between",
          "w-14 shrink-0 py-4 border-r border-border dark:border-white/10",
          "bg-surface dark:bg-surface"
        )}
      >
        <div className="flex flex-col items-center gap-1.5">
          <div className="mb-5 flex h-8 w-8 items-center justify-center rounded-full bg-transparent dark:bg-white dark:p-1 overflow-hidden">
            <Image src="/logo.webp" alt="Logo" width={32} height={32} className="object-contain" priority />
          </div>

          {/* overflow-y-auto: desktop sidebar is fixed-height, and staff
              now has 8 items — scrolls instead of clipping on short
              viewports rather than assuming vertical space is unlimited. */}
          <nav className="flex max-h-[70dvh] flex-col items-center gap-1.5 overflow-y-auto" aria-label={`${role} navigation`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname?.startsWith(item.href);
              const badge = resolveBadge(item, unreadNotifCount, unreadMessageCount);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-text-primary/70 hover:bg-surface-muted hover:text-text-accent dark:text-text-primary/60 dark:hover:bg-white/5"
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                  {badge > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-surface dark:ring-surface" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col items-center gap-3.5">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-primary/70 transition-colors hover:bg-surface-muted dark:text-text-primary/60 dark:hover:bg-white/5"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {avatar}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 dark:border-white/10 dark:bg-surface">
          <h1 className="truncate font-heading text-lg font-semibold text-text-primary">{pageTitle}</h1>

          {globalSearch && <div className="hidden flex-1 justify-center sm:flex">{globalSearch}</div>}

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <RoleSwitcher />
            </div>
            {headerExtra}
            <Link
              href="/chat"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-surface-muted dark:hover:bg-white/5"
              aria-label="Messages"
            >
              <MessageIcon />
              {unreadMessageCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />}
            </Link>
            <Link
              href="/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-surface-muted dark:hover:bg-white/5"
              aria-label="Notifications"
            >
              <BellIcon />
              {unreadNotifCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />}
            </Link>
            <span className="md:hidden">{avatar}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-center justify-around border-t border-border bg-surface md:hidden dark:border-white/10 dark:bg-surface"
        aria-label={`${role} navigation`}
      >
        {mobileVisible.map((item) => {
          const Icon = item.icon;
          const active = pathname?.startsWith(item.href);
          const badge = resolveBadge(item, unreadNotifCount, unreadMessageCount);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-2 py-1 text-[11px]",
                active ? "text-text-accent" : "text-text-primary/60 dark:text-text-primary/50"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              {item.label}
              {badge > 0 && <span className="absolute right-1 top-0.5 h-2 w-2 rounded-full bg-destructive" />}
            </Link>
          );
        })}

        {overflow && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More navigation options"
            className={cn(
              "relative flex flex-col items-center gap-0.5 px-2 py-1 text-[11px]",
              overflowHasActive ? "text-text-accent" : "text-text-primary/60 dark:text-text-primary/50"
            )}
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={overflowHasActive ? 2.25 : 1.75} />
            More
            {mobileOverflowItems.some((item) => resolveBadge(item, unreadNotifCount, unreadMessageCount) > 0) && (
              <span className="absolute right-1 top-0.5 h-2 w-2 rounded-full bg-destructive" />
            )}
          </button>
        )}
      </nav>

      {/* Mobile "More" sheet — remaining nav items as a full-width list */}
      {overflow && moreOpen && (
        <div className="fixed inset-0 z-30 flex items-end md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          <div className="relative w-full rounded-t-2xl border-t border-border bg-surface p-4 pb-8 dark:border-white/10 dark:bg-surface">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold text-text-primary dark:text-text-primary">More</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted dark:text-text-muted dark:hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {mobileOverflowItems.map((item) => {
                const Icon = item.icon;
                const active = pathname?.startsWith(item.href);
                const badge = resolveBadge(item, unreadNotifCount, unreadMessageCount);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-text-primary hover:bg-surface-muted dark:text-text-primary dark:hover:bg-white/5"
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" strokeWidth={active ? 2.25 : 1.75} />
                    {item.label}
                    {badge > 0 && <span className="ml-auto h-2 w-2 rounded-full bg-destructive" />}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile-only role switcher */}
      <div className="fixed bottom-20 right-3 z-20 sm:hidden">
        <RoleSwitcher />
      </div>
    </div>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}