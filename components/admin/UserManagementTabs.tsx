// /components/admin/UserManagementTabs.tsx
"use client";

import { useState } from "react";
import { PendingApprovalsList } from "@/components/admin/PendingApprovalsList";
import { UserRolesTab } from "@/components/admin/UserRolesTab";
import { UserPodsTab } from "@/components/admin/UserPodsTab";

type Tab = "approvals" | "roles" | "pods";

const TABS: { value: Tab; label: string }[] = [
  { value: "approvals", label: "Approvals" },
  { value: "roles", label: "Roles" },
  { value: "pods", label: "Pods" },
];

export function UserManagementTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("approvals");

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="inline-flex w-fit rounded-full border border-border p-0.5 dark:border-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors dark:text-text-primary ${
              activeTab === tab.value
                ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
                : "text-text-primary/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "approvals" && <PendingApprovalsList />}
      {activeTab === "roles" && <UserRolesTab />}
      {activeTab === "pods" && <UserPodsTab />}
    </div>
  );
}