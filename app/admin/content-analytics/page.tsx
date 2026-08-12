// /app/admin/content-analytics/page.tsx — if kept as a standalone route

"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { useRole } from "@/providers/role-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { fetchAnalyticsRollup } from "@/lib/api/content-analytics";
import { ContentAnalyticsSection } from "@/components/admin/dashboard/ContentAnalyticsSection";

export default function ContentAnalyticsPage() {
  const { permissionLevel } = useRole();
  const canView = permissionLevel === "mentor" || permissionLevel === "staff";

  const { data: rollup, isLoading } = useQuery({
    queryKey: ["content-analytics-rollup"],
    queryFn: fetchAnalyticsRollup,
    enabled: canView,
  });

  if (!canView) {
    return (
      <div className="p-4">
        <EmptyState title="Not available" description="This view is only available to mentors and staff." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-text-accent dark:text-text-accent" />
        <h1 className="font-heading text-lg font-medium text-text-primary dark:text-text-primary">
          Content analytics
        </h1>
      </div>
      <ContentAnalyticsSection rollup={rollup ?? []} isLoading={isLoading} />
    </div>
  );
}