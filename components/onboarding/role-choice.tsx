"use client";

import { useEffect, useRef, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Loader2, ShieldCheck, Users } from "lucide-react";

import { setUserRole } from "@/lib/api/auth";
import { useSessionStore } from "@/store/session-store";
import { cn } from "@/lib/utils";

import type { UserRole } from "@/types/users";

const ROLES_REQUIRING_APPROVAL: readonly UserRole[] = ["mentor", "associate"];
const VALID_ROLES: readonly UserRole[] = ["mentee", "mentor", "associate"];

const SESSION_RETRY_INTERVAL_MS = 500;
const SESSION_RETRY_MAX_ATTEMPTS = 10;
const ROLE_PARAM = "role";

function parseRoleParam(value: string | null): UserRole | null {
  if (!value) return null;
  return (VALID_ROLES as readonly string[]).includes(value) ? (value as UserRole) : null;
}

export interface RoleChoiceProps {
  disabled?: boolean;
}

export function RoleChoice({ disabled = false }: RoleChoiceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleFromUrl = parseRoleParam(searchParams.get(ROLE_PARAM));

  const userId = useSessionStore((s) => s.userId);
  const hydrated = useSessionStore((s) => s.hydrated);
  const setRole = useSessionStore((s) => s.setRole);

  // Fixed TypeScript error: using typeof roleFromUrl or explicit UserRole union type
  const [selected, setSelected] = useState<UserRole | null>(roleFromUrl);
  const [submitting, setSubmitting] = useState(false);
  const [waitingForSession, setWaitingForSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [resumed, setResumed] = useState(false);
  const retryTokenRef = useRef(0);

  async function saveRole(uid: string, role: UserRole) {
    setSubmitting(true);
    setError(null);
    try {
      await setUserRole(uid, role);
      setRole(role);
      router.push(
        ROLES_REQUIRING_APPROVAL.includes(role)
          ? "/onboarding/not-approved"
          : "/onboarding/profile"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
      setSubmitting(false);
    }
  }

  // Wrapped the state update in startTransition to prevent cascading render warnings
  useEffect(() => {
    if (resumed) return;
    if (!roleFromUrl || !hydrated || !userId) return;

    startTransition(() => {
      setResumed(true);
    });

    const timer = setTimeout(() => {
      void saveRole(userId, roleFromUrl);
    }, 0);

    return () => clearTimeout(timer);
  }, [roleFromUrl, hydrated, userId, resumed]);

  function handleContinue() {
    if (!selected) return;

    const currentUserId = useSessionStore.getState().userId;
    if (currentUserId) {
      void saveRole(currentUserId, selected);
      return;
    }

    const token = ++retryTokenRef.current;
    setWaitingForSession(true);
    setError(null);

    const role = selected;
    let attempts = 0;
    const interval = window.setInterval(() => {
      if (retryTokenRef.current !== token) {
        window.clearInterval(interval);
        return;
      }

      attempts += 1;
      const uid = useSessionStore.getState().userId;

      if (uid) {
        window.clearInterval(interval);
        setWaitingForSession(false);
        void saveRole(uid, role);
        return;
      }

      if (attempts >= SESSION_RETRY_MAX_ATTEMPTS) {
        window.clearInterval(interval);
        setWaitingForSession(false);
        const url = new URL(window.location.href);
        url.searchParams.set(ROLE_PARAM, role);
        window.location.href = url.toString();
      }
    }, SESSION_RETRY_INTERVAL_MS);
  }

  useEffect(() => {
    return () => {
      retryTokenRef.current += 1;
    };
  }, []);

  const isResuming = Boolean(roleFromUrl) && !resumed;

  return (
    <div
      className={cn(
        "w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm transition-opacity dark:border-border dark:bg-card dark:shadow-none",
        disabled && "pointer-events-none opacity-60"
      )}
      aria-busy={disabled}
    >
      <h1 className="text-lg font-heading text-text-primary dark:text-text-primary">
        How will you be joining?
      </h1>
      <p className="mt-1.5 text-sm text-text-muted dark:text-text-muted">
        You can&apos;t change this later without contacting your program manager.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <RoleCard
          icon={<GraduationCap className="h-5 w-5" />}
          title="I'm a student"
          description="Join a cohort, get assignments, and track your progress."
          active={selected === "mentee"}
          disabled={disabled}
          onClick={() => setSelected("mentee")}
        />
        <RoleCard
          icon={<Users className="h-5 w-5" />}
          title="I want to mentor"
          description="Apply to guide a team. Requires PM approval before you get access."
          active={selected === "mentor"}
          disabled={disabled}
          onClick={() => setSelected("mentor")}
        />
        <RoleCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="I'm an associate"
          description="Help run the program. Requires PM approval before you get access."
          active={selected === "associate"}
          disabled={disabled}
          onClick={() => setSelected("associate")}
        />
      </div>

      {(waitingForSession || isResuming) && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-2 rounded-lg bg-card-alt px-3 py-2 text-sm text-text-muted dark:bg-card-alt dark:text-text-muted"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for your session to load…
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive dark:bg-destructive/15 dark:text-destructive">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={disabled || !selected || submitting || waitingForSession || isResuming || !hydrated}
        onClick={handleContinue}
        className="mt-7 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
      >
        {!hydrated || isResuming
          ? "Loading your session…"
          : waitingForSession
          ? "Waiting for session…"
          : submitting
          ? "Saving…"
          : "Continue"}
      </button>
    </div>
  );
}

function RoleCard({
  icon,
  title,
  description,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed",
        active
          ? "border-ring bg-card-alt ring-2 ring-ring/30 dark:border-ring dark:bg-card-alt"
          : "border-border hover:bg-card-alt/50 dark:border-border dark:hover:bg-card-alt/50"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          active
            ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
            : "bg-card-alt text-text-accent dark:bg-card-alt dark:text-text-accent"
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-medium text-text-primary dark:text-text-primary">{title}</span>
      <span className="text-xs leading-relaxed text-text-muted dark:text-text-muted">{description}</span>
    </button>
  );
}