// components/admin/dashboard/CompletionRow.tsx
"use client";

import Link from "next/link";

export interface CompletionRowProps {
  name: string;
  subtitle: string;
  completed: number;
  total: number;
  escalationCount?: number;
  href?: string;
}

export function CompletionRow({
  name,
  subtitle,
  completed,
  total,
  escalationCount = 0,
  href,
}: CompletionRowProps) {
  const hasData = total > 0;
  const pct = hasData ? Math.round((completed / total) * 100) : 0;
  const hasEscalations = escalationCount > 0;

  const nameEl = href ? (
    <Link
      href={href}
      className="truncate font-medium text-text-primary hover:text-text-accent hover:underline dark:text-text-primary dark:hover:text-text-accent"
    >
      {name}
    </Link>
  ) : (
    <span className="truncate font-medium text-text-primary dark:text-text-primary">
      {name}
    </span>
  );

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:gap-4 ${
        hasEscalations
          ? "bg-card-strong border-border-strong dark:bg-card-strong dark:border-border-strong"
          : "bg-card border-border dark:bg-card dark:border-border"
      }`}
    >
      {/* Name and Subtitle */}
      <div className="min-w-0 flex-1 sm:w-48 sm:flex-none">
        <div className="flex items-center gap-2">
          {nameEl}
          {/* Mobile Escalation Badge (visible inline next to name on mobile) */}
          {hasEscalations && (
            <span className="inline-flex flex-shrink-0 items-center rounded-full bg-text-accent/15 px-2 py-0.5 text-xs font-semibold text-text-accent sm:hidden dark:bg-text-accent/20 dark:text-text-accent">
              {escalationCount} esc
            </span>
          )}
        </div>
        <p className="truncate text-xs text-text-muted dark:text-text-muted">
          {subtitle}
        </p>
      </div>

      {/* Progress Bar and Percentage */}
      <div className="flex flex-1 items-center gap-3">
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-card-alt dark:bg-card-alt">
          <div
            className="h-full rounded-full bg-primary transition-[width] dark:bg-primary"
            style={{ width: hasData ? `${pct}%` : "0%" }}
          />
        </div>
        <div className="w-10 flex-shrink-0 text-right text-sm font-medium text-text-primary dark:text-text-primary">
          {hasData ? `${pct}%` : "—"}
        </div>
      </div>

      {/* Desktop Escalation Badge */}
      {hasEscalations && (
        <span className="hidden flex-shrink-0 rounded-full bg-text-accent/15 px-2.5 py-1 text-xs font-semibold text-text-accent sm:inline-block dark:bg-text-accent/20 dark:text-text-accent">
          {escalationCount} {escalationCount === 1 ? "escalation" : "escalations"}
        </span>
      )}
    </div>
  );
}