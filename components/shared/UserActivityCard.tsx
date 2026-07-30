// components/shared/UserActivityCard.tsx
"use client";

import type { ApprovalStatus, UserRole } from "@/types/admin";

// INTEGRATION NOTE: swap the <span> role badge below for your real
// components/admin/RoleBadge.tsx — I don't have its props, this is a
// minimal stand-in with the same intent.

interface UserActivityCardProps {
  userId: string;
  fullName: string;
  role: UserRole;
  schoolOrOrg: string | null;
  approvalStatus: ApprovalStatus;
  onViewDetails: (userId: string) => void;
  variant?: "default" | "escalation";
}

export function UserActivityCard({
  userId,
  fullName,
  role,
  schoolOrOrg,
  approvalStatus,
  onViewDetails,
  variant = "default",
}: UserActivityCardProps) {
  const isEscalation = variant === "escalation";

  return (
    <button
      type="button"
      onClick={() => onViewDetails(userId)}
      className={
        isEscalation
          ? "w-full text-left bg-card-strong text-text-primary border border-border-strong rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow dark:bg-card-strong dark:border-border-strong"
          : "w-full text-left bg-card text-text-primary border border-border rounded-xl p-4 hover:border-border-strong transition-colors dark:bg-card dark:border-border"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading font-semibold text-text-primary dark:text-text-primary">
            {fullName}
          </p>
          {schoolOrOrg && (
            <p className="text-sm text-text-muted dark:text-text-muted">
              {schoolOrOrg}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium text-text-muted dark:border-border dark:bg-surface dark:text-text-muted">
          {role}
        </span>
      </div>

      {approvalStatus !== "approved" && (
        <span className="mt-3 inline-block rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground dark:bg-accent dark:text-accent-foreground">
          {approvalStatus}
        </span>
      )}
    </button>
  );
}