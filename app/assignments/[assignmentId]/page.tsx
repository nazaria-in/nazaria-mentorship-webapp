// /app/assignments/[assignmentId]/page.tsx

"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import { AssignmentDetailsView } from "@/components/assignments/AssignmentDetailsView";

export default function AssignmentDetailPage() {
  const params = useParams<{ assignmentId: string }>();
  const { permissionLevel, isDebug } = useRole();
  const sessionUserId = useSessionStore((s) => s.userId);

  // Fallback to a fake mock ID during development/debug mode if not logged in
  const userId = sessionUserId || (isDebug ? "demo-user-id" : null);

  if (!userId) {
    return <div className="p-4 text-sm text-text-primary/50">Loading session…</div>;
  }

  return (
    <AppShell navItems={NAV_BY_PERMISSION[permissionLevel]} pageTitle="Assignment">
      <AssignmentDetailsView
        assignmentId={params.assignmentId}
        role={permissionLevel}
        currentUserId={userId}
      />
    </AppShell>
  );
}