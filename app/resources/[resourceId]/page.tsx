// /app/resources/[resourceId]/page.tsx

"use client";

import { useParams, useRouter } from "next/navigation";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import { ResourceDetailsView } from "@/components/resources/ResourceDetailsView";
import { useEffect } from "react";

export default function ResourceDetailsPage() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const { role, permissionLevel } = useRole();
  const userId = useSessionStore((s) => s.userId);
  const router = useRouter();

  // Handle side-effect redirects inside a useEffect
  useEffect(() => {
    if (!userId) {
      router.replace("/auth/login");
    }
  }, [userId, router]);

  // Prevent rendering if unauthorized or while waiting for redirection
  if (!userId || !permissionLevel) {
    return null; 
  }

  return (
      <ResourceDetailsView resourceId={resourceId} role={permissionLevel} currentUserId={userId} />
  );
}