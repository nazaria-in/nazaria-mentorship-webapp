// components/shell/AppShell.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image"; // Imported to handle image loading seamlessly
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
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

function resolveBadge(
  item: NavItem,
  unreadNotifCount = 0,
  unreadMessageCount = 0
) {
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
  onOpenNotifications,
  onOpenMessages,
  avatar,
  globalSearch,
}: AppShellProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { role } = useRole();

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
          {/* Logo container pointing to public/logo.webp */}
          <div className="mb-5 flex h-8 w-8 items-center justify-center rounded-full bg-transparent dark:bg-white dark:p-1 overflow-hidden">
            <Image
              src="/logo.webp" // Resolves automatically to the /public/logo.webp path
              alt="Logo"
              width={32}
              height={32}
              className="object-contain"
              priority // Prevents layout shift; loads instantly on mount
            />
          </div>

          <nav className="flex flex-col items-center gap-1.5" aria-label={`${role} navigation`}>
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
                    "relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
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
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 dark:border-white/10 dark:bg-surface">
          <h1 className="truncate font-heading text-lg font-semibold text-text-primary">
            {pageTitle}
          </h1>

          {globalSearch && (
            <div className="hidden flex-1 justify-center sm:flex">{globalSearch}</div>
          )}

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <RoleSwitcher />
            </div>
            {headerExtra}
            <button
              type="button"
              onClick={onOpenMessages}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-surface-muted dark:hover:bg-white/5"
              aria-label="Messages"
            >
              <MessageIcon />
              {unreadMessageCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
              )}
            </button>
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-surface-muted dark:hover:bg-white/5"
              aria-label="Notifications"
            >
              <BellIcon />
              {unreadNotifCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
              )}
            </button>
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
        {navItems.map((item) => {
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
              {badge > 0 && (
                <span className="absolute right-1 top-0.5 h-2 w-2 rounded-full bg-destructive" />
              )}
            </Link>
          );
        })}
      </nav>

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