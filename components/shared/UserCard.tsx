// components/shared/UserCard.tsx
"use client";

import Link from "next/link";
import { RoleBadge } from "@/components/admin/RoleBadge";
import type { UserRole, ApprovalStatus } from "@/lib/api/admin-users";

export interface UserCardPerson {
  id: string;
  fullName: string | null;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  schoolOrOrg?: string | null;
  email?: string | null;
}

export interface UserCardProps {
  person: UserCardPerson;
  view: "list" | "card";
  /**
   * Whether the name links through to `/admin?id=<id>`. The card doesn't
   * decide this itself — the caller (always PeopleGrid) computes it from
   * the viewer's permission level + this person's role.
   */
  clickable: boolean;
  /** One action element: approve/reject buttons, a role dropdown, a pod
   *  dropdown, a remove button — whatever the calling context needs.
   *  Ignored when `onToggleSelect` is set — picker mode owns the action
   *  slot for its own remove-committed button instead (see PeopleGrid). */
  children?: React.ReactNode;
  /** Picker mode: renders a checkbox and puts the card in selection mode.
   *  When set, `onToggleSelect` fires on checkbox click AND on clicking
   *  the row itself (not just the tiny checkbox target). */
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Shows an "Already assigned" tag next to the name — this member has
   *  a committed relationship elsewhere (e.g. an existing
   *  mentee_assignments row) that removal must go through a warning for. */
  committed?: boolean;
}

export function UserCard({
  person,
  view,
  clickable,
  children,
  selected,
  onToggleSelect,
  committed,
}: UserCardProps) {
  const name = person.fullName ?? person.id;
  const isSelectable = onToggleSelect !== undefined;

  const nameEl = clickable ? (
    <Link
      href={`/admin?id=${person.id}`}
      onClick={(e) => e.stopPropagation()}
      className="font-medium text-text-primary hover:text-text-accent hover:underline dark:text-text-primary dark:hover:text-text-accent"
    >
      {name}
    </Link>
  ) : (
    <span className="font-medium text-text-primary dark:text-text-primary">{name}</span>
  );

  const committedTag = committed && (
    <span className="ml-auto shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground dark:bg-secondary dark:text-secondary-foreground">
      Already assigned
    </span>
  );

  const checkbox = isSelectable && (
    <input
      type="checkbox"
      checked={selected ?? false}
      onChange={onToggleSelect}
      onClick={(e) => e.stopPropagation()}
      className="h-3.5 w-3.5 shrink-0 accent-[var(--color-nazaria-burgundy)]"
    />
  );

  if (view === "list") {
    return (
      <div
        onClick={isSelectable ? onToggleSelect : undefined}
        className={`flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-3 py-2.5 dark:bg-card dark:border-border ${
          isSelectable ? "cursor-pointer" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {checkbox}
          <RoleBadge role={person.role} />
          <div className="min-w-0">
            {nameEl}
            <p className="truncate text-xs text-text-muted dark:text-text-muted">
              {person.schoolOrOrg ?? "—"}
              {person.approvalStatus !== "approved" ? ` · ${person.approvalStatus}` : ""}
            </p>
          </div>
        </div>
        {isSelectable ? committedTag : children && <div className="shrink-0 flex items-center gap-2">{children}</div>}
      </div>
    );
  }

  return (
    <div
      onClick={isSelectable ? onToggleSelect : undefined}
      className={`flex flex-col gap-2 bg-card border border-border rounded-xl p-4 dark:bg-card dark:border-border ${
        isSelectable ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {checkbox}
          <div className="min-w-0">
            {nameEl}
            {person.schoolOrOrg && (
              <p className="truncate text-xs text-text-muted dark:text-text-muted">{person.schoolOrOrg}</p>
            )}
          </div>
        </div>
        <RoleBadge role={person.role} />
      </div>
      {person.approvalStatus !== "approved" && (
        <p className="text-xs text-text-muted dark:text-text-muted">{person.approvalStatus}</p>
      )}
      {isSelectable ? (
        committedTag && <div className="pt-1">{committedTag}</div>
      ) : (
        children && <div className="pt-1 flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}