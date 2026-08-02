// components/shell/PageDescriptionShell.tsx
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useRole } from "@/providers/role-provider";
import { resolvePageDescription } from "@/lib/page-descriptions";

export interface PageDescriptionShellProps {
  /**
   * Optional override — pass explicit children to bypass the config
   * lookup entirely for a one-off page. Most pages should NOT pass
   * this; add an entry to lib/page-descriptions.ts instead.
   */
  children?: React.ReactNode;
}

/**
 * Renders directly inside AppShell's scrollable <main>, above the page
 * content — NOT inside the fixed <header>. Resolves its own copy from
 * lib/page-descriptions.ts based on the current path + role, so any
 * page gets a description automatically just by adding a config entry.
 */
export function PageDescriptionShell({ children }: PageDescriptionShellProps) {
  const pathname = usePathname();
  const { permissionLevel } = useRole();

  const resolved = children ?? resolvePageDescription(pathname ?? "", permissionLevel);

  if (!resolved) return null;

  return (
    <div className="border-b border-border bg-surface px-4 py-3 text-sm text-text-muted dark:border-white/10 dark:bg-surface">
      {resolved}
    </div>
  );
}