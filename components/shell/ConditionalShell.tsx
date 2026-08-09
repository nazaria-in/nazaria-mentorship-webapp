// components/shell/ConditionalShell.tsx
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";

const NO_SHELL_PREFIXES = ["/auth", "/onboarding"];
const REQUIRES_APPROVAL_ROLES = ["mentor", "associate", "pm"];

function titleFromPath(pathname: string): string {
  const seg = pathname.split("/")[1];
  if (!seg) return "Dashboard";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

// Inline component to render auth/status warnings without wrapping in AppShell
function StatusCard({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center bg-gray-50/50">
      <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <div className="text-sm text-gray-600 mb-6">{description}</div>
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-primary/90 transition-colors"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { permissionLevel, role, approvalStatus, isAuthenticated, isDebug } = useRole();
  const hydrated = useSessionStore((s) => s.hydrated);

  const normalizedPathname =
    pathname && pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  const isIndexPage = normalizedPathname === "/";
  const skipShell = isIndexPage || NO_SHELL_PREFIXES.some((p) => normalizedPathname?.startsWith(p));

  // 1. Unprotected / auth routes render raw children without AppShell
  if (skipShell) {
    return <>{children}</>;
  }

  // 2. Wait until store hydration finishes to avoid UI flashing
  if (!hydrated && !isDebug) {
    return null;
  }

  // 3. Not Logged In Guard: Show Login Prompt Card instead of AppShell
  if (!isAuthenticated) {
    return (
      <StatusCard
        title="Authentication Required"
        description="You need to be logged in to view this page. Please sign in to continue."
        actionLabel="Log In"
        actionHref="/auth/login"
      />
    );
  }

  // 4. Approval Status Guard: Show Pending/Rejected Card for restricted roles
  if (role && REQUIRES_APPROVAL_ROLES.includes(role)) {
    if (approvalStatus !== "approved" && !isDebug) {
      return (
        <StatusCard
          title="Account Pending Approval"
          description={
            <>
              Your account status is currently{" "}
              <span className="font-semibold capitalize text-amber-600">
                {approvalStatus ?? "pending"}
              </span>
              . Access to this page requires administrator approval.
            </>
          }
          actionLabel="Return to HomePage"
          actionHref="/"
        />
      );
    }
  }

  // 5. Authenticated & Approved Users reach AppShell
  return (
    <AppShell
      navItems={NAV_BY_PERMISSION[permissionLevel]}
      pageTitle={titleFromPath(normalizedPathname ?? "")}
    >
      {children}
    </AppShell>
  );
}