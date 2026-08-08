// components/onboarding/role-choice.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, ShieldCheck, Users } from "lucide-react";

import { setUserRole } from "@/lib/api/auth";
import { useSessionStore } from "@/store/session-store";
import { cn } from "@/lib/utils";

import type { UserRole } from "@/types/users";

// Roles that require PM approval before the user gets product access.
// Both mentor and associate applications are reviewed manually — only
// mentee signups skip straight to profile setup.
const ROLES_REQUIRING_APPROVAL: readonly UserRole[] = ["mentor", "associate"];

export function RoleChoice() {
  const router = useRouter();
  const userId = useSessionStore((s) => s.userId);
  const hydrated = useSessionStore((s) => s.hydrated);
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setRole = useSessionStore((s) => s.setRole);

  async function handleContinue() {
    if (!selected) return;

    if (!userId) {
      setError(
        "We couldn't find your session yet. Wait a moment and try again, or refresh the page."
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await setUserRole(userId, selected);
      setRole(selected);

      router.push(
        ROLES_REQUIRING_APPROVAL.includes(selected)
          ? "/onboarding/not-approved"
          : "/onboarding/profile"
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't save that. Try again."
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm dark:shadow-none">
      <h1 className="text-lg font-heading text-text-primary">How will you be joining?</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        You can&apos;t change this later without contacting your program manager.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <RoleCard
          icon={<GraduationCap className="h-5 w-5" />}
          title="I'm a student"
          description="Join a cohort, get assignments, and track your progress."
          active={selected === "mentee"}
          onClick={() => setSelected("mentee")}
        />
        <RoleCard
          icon={<Users className="h-5 w-5" />}
          title="I want to mentor"
          description="Apply to guide a team. Requires PM approval before you get access."
          active={selected === "mentor"}
          onClick={() => setSelected("mentor")}
        />
        <RoleCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="I'm an associate"
          description="Help run the program. Requires PM approval before you get access."
          active={selected === "associate"}
          onClick={() => setSelected("associate")}
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive dark:bg-destructive/15">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!selected || submitting || !hydrated}
        onClick={handleContinue}
        className="mt-7 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!hydrated ? "Loading your session…" : submitting ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}

function RoleCard({
  icon,
  title,
  description,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-colors",
        active
          ? "border-ring bg-surface-muted ring-2 ring-ring/30 dark:bg-white/10"
          : "border-border hover:bg-surface-muted/50 dark:border-white/10 dark:hover:bg-white/5",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-surface-muted text-text-accent dark:bg-white/10",
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-medium text-text-primary">{title}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
    </button>
  );
}