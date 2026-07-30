// /app/admin/exit-survey-templates/page.tsx
"use client";

import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import { ExitSurveyTemplateEditor } from "@/components/admin/ExitSurveyTemplateEditor";
import { EmptyState } from "@/components/shared/EmptyState";

export default function ExitSurveyTemplatesPage() {
  const { permissionLevel } = useRole();
  const userId = useSessionStore((state) => state.userId);

  if (permissionLevel !== "staff" || !userId) {
    return (
        <div className="p-4">
          <EmptyState title="Staff only" description="This page is only available to associates and program managers." />
        </div>
    );
  }

  return (
      <div className="p-4 md:p-6">
        <ExitSurveyTemplateEditor currentUserId={userId} />
      </div>
  );
}