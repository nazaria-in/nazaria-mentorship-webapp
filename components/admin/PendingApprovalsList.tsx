// /components/admin/PendingApprovalsList.tsx

"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchUsersByApproval } from "@/lib/api/users";
import { PendingApprovalCard } from "@/components/admin/PendingApprovalCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import type { ApprovalStatus } from "@/types/users";

const TABS: { value: ApprovalStatus; label: string; bgClass: string; textClass: string }[] = [
  { 
    value: "pending", 
    label: "Pending", 
    bgClass: "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/10",
    textClass: "text-amber-600 dark:text-amber-400"
  },
  { 
    value: "approved", 
    label: "Approved", 
    bgClass: "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/10",
    textClass: "text-emerald-600 dark:text-emerald-400"
  },
  { 
    value: "rejected", 
    label: "Rejected", 
    bgClass: "bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/10",
    textClass: "text-rose-600 dark:text-rose-400"
  },
];

export function PendingApprovalsList() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<ApprovalStatus>("pending");

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ["users-by-approval", "mentor"] });
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-xl font-semibold text-text-primary">
          Mentor approvals
        </h1>
        <p className="text-sm text-text-primary/60">
          Review mentors who signed up and are waiting to be approved.
        </p>
      </div>

      {/* Mobile Tab Selector */}
      <div className="inline-flex w-fit rounded-full border border-border p-0.5 lg:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === tab.value
                ? "bg-primary text-primary-foreground"
                : "text-text-primary/60 hover:bg-surface-muted dark:hover:bg-white/5"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Layout Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        {TABS.map((tab) => (
          <div
            key={tab.value}
            className={cn(
              // The container wrapper with distinct background and border
              "flex flex-col gap-4 p-4 rounded-xl border min-h-[500px]",
              tab.bgClass,
              activeTab !== tab.value && "hidden lg:flex"
            )}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full currentColor bg-current", tab.textClass)} />
                <h2 className={cn("font-semibold capitalize text-sm tracking-wide", tab.textClass)}>
                  {tab.label}
                </h2>
              </div>
            </div>

            {/* List Content */}
            <ApprovalColumnList status={tab.value} onDataChange={refetchAll} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface ApprovalColumnListProps {
  status: ApprovalStatus;
  onDataChange: () => void;
}

function ApprovalColumnList({ status, onDataChange }: ApprovalColumnListProps) {
  const { data: mentors, isLoading } = useQuery({
    queryKey: ["users-by-approval", "mentor", status],
    queryFn: () => fetchUsersByApproval({ role: "mentor", status }),
  });

  if (isLoading) {
    return <div className="text-sm text-text-primary/40 animate-pulse px-2">Loading {status}…</div>;
  }

  if (!mentors || mentors.length === 0) {
    return (
      <div className="opacity-70 my-auto">
        <EmptyState
          title={status === "pending" ? "No pending mentors" : `No ${status} mentors`}
          description={status === "pending" ? "New mentor signups will show up here." : undefined}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 overflow-y-auto max-h-[70vh] pr-1">
      {mentors.map((mentor) => (
        <PendingApprovalCard 
          key={mentor.id} 
          user={mentor} 
          onChanged={onDataChange} 
        />
      ))}
    </div>
  );
}