// /app/resources/[resourceId]/page.tsx

"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import { ResourceDetailsView } from "@/components/resources/ResourceDetailsView";

export default function ResourceDetailsPage() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const { role, permissionLevel } = useRole();
  const userId = useSessionStore((s) => s.userId);

  if (!userId) {
    return null;
  }

  return (
    <AppShell navItems={NAV_BY_PERMISSION[permissionLevel]} pageTitle="Resource">
      <ResourceDetailsView resourceId={resourceId} role={permissionLevel} currentUserId={userId} />
    </AppShell>
  );
}