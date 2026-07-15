// /components/admin/PendingApprovalCard.tsx

"use client";

import { useMutation } from "@tanstack/react-query";
import { updateApprovalStatus } from "@/lib/api/users";
import { cn } from "@/lib/utils";
import type { AppUser, ApprovalStatus } from "@/types/users";

export interface PendingApprovalCardProps {
  user: AppUser;
  onChanged: () => void;
}

const STATUS_STYLES: Record<ApprovalStatus, string> = {
  pending: "bg-surface-muted text-text-primary",
  approved: "bg-secondary text-secondary-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

export function PendingApprovalCard({ user, onChanged }: PendingApprovalCardProps) {
  const mutation = useMutation({
    mutationFn: (status: ApprovalStatus) => updateApprovalStatus(user.id, status),
    onSuccess: onChanged,
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {/* users has no full_name/display name column — swap this for the real field once added */}
          <span className="truncate text-sm font-medium text-text-primary">
            {user.full_name ?? user.school_or_org ?? user.id}
          </span>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_STYLES[user.approval_status])}>
            {user.approval_status}
          </span>
        </div>
        {user.bio && <p className="mt-0.5 truncate text-xs text-text-primary/60">{user.bio}</p>}
        <p className="mt-0.5 text-[11px] text-text-primary/40">
          Signed up {new Date(user.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <div className="flex shrink-0 gap-1.5">
        {user.approval_status !== "approved" && (
          <button
            type="button"
            onClick={() => mutation.mutate("approved")}
            disabled={mutation.isPending}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Approve
          </button>
        )}
        {user.approval_status !== "rejected" && (
          <button
            type="button"
            onClick={() => mutation.mutate("rejected")}
            disabled={mutation.isPending}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted disabled:opacity-50"
          >
            Reject
          </button>
        )}
      </div>
    </div>
  );
}