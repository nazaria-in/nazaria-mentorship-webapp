// components/shell/ConditionalShell.tsx
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";

const NO_SHELL_PREFIXES = ["/auth", "/onboarding"];

function titleFromPath(pathname: string): string {
  const seg = pathname.split("/")[1];
  if (!seg) return "Dashboard";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { permissionLevel } = useRole();

  const normalizedPathname =
    pathname && pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  const isIndexPage = normalizedPathname === "/";
  const skipShell = isIndexPage || NO_SHELL_PREFIXES.some((p) => normalizedPathname?.startsWith(p));

  if (skipShell) return <>{children}</>;

  return (
    <AppShell navItems={NAV_BY_PERMISSION[permissionLevel]} pageTitle={titleFromPath(normalizedPathname ?? "")}>
      {children}
    </AppShell>
  );
}