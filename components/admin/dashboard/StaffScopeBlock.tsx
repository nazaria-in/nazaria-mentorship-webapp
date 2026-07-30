// components/admin/dashboard/StaffScopeBlock.tsx
"use client";

import Link from "next/link";

export function StaffScopeBlock() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center dark:border-border dark:bg-card">
      <p className="text-sm text-text-primary dark:text-text-primary">
        This user is not a mentor or mentee.
      </p>
      <Link
        href="/admin"
        className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Back to admin dashboard
      </Link>
    </div>
  );
}