// /components/resources/ResourceDetailsView.tsx

"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Linkify from "linkify-react";
import { Link2 } from "lucide-react";
import { fetchResource, updateResource } from "@/lib/api/resources";
import { ResourceUpdateForm } from "@/components/resources/ResourceUpdateForm";
import { ResourceUpdatesList } from "@/components/resources/ResourceUpdatesList";
import { EmptyState } from "@/components/shared/EmptyState";
import { RESOURCE_STATUS_OPTIONS } from "@/lib/filtering/resource-fields";
import type { PermissionLevel } from "@/providers/role-provider";
import type { ResourceStatus } from "@/types/resources";

export interface ResourceDetailsViewProps {
  resourceId: string;
  role: PermissionLevel;
  currentUserId: string;
}

export function ResourceDetailsView({ resourceId, role, currentUserId }: ResourceDetailsViewProps) {
  const queryClient = useQueryClient();

  const { data: resource, isLoading } = useQuery({
    queryKey: ["resource", resourceId],
    queryFn: () => fetchResource(resourceId),
  });

  const statusMutation = useMutation({
    mutationFn: (status: ResourceStatus) => updateResource(resourceId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource", resourceId] });
      queryClient.invalidateQueries({ queryKey: ["resources", "list"] });
    },
  });

  if (isLoading) {
    return <div className="p-4 text-sm text-text-primary/50">Loading resource…</div>;
  }

  if (!resource) {
    return <EmptyState title="Resource not found" description="It may have been removed." />;
  }

  const isOwnerMentee = role === "mentee" && resource.assigned_to === currentUserId;
  const canManageStatus = isOwnerMentee || role === "mentor" || role === "staff";

  return (
    <div className="flex flex-col gap-6 p-4">
      <header className="surface-card flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-heading text-xl font-semibold text-text-primary">{resource.title}</h1>
          {canManageStatus && (
            <select
              value={resource.status}
              onChange={(e) => statusMutation.mutate(e.target.value as ResourceStatus)}
              className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-text-primary outline-none focus:border-ring dark:bg-white/5 dark:border-white/10"
            >
              {RESOURCE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <p className="text-sm text-text-primary/70">{resource.description}</p>

        {resource.week_number !== null && <span className="text-xs text-text-primary/50">Week {resource.week_number}</span>}

        {resource.links && resource.links.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
            <Linkify
              options={{
                attributes: {
                  class: "flex items-center gap-1.5 text-sm text-text-accent underline hover:text-text-accent/80",
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
                render: ({ attributes, content }) => (
                  <a {...attributes}>
                    <Link2 className="h-3.5 w-3.5 shrink-0" />
                    {content}
                  </a>
                ),
              }}
            >
              {resource.links.join("\n")}
            </Linkify>
          </div>
        )}

        {resource.files.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
            <span className="text-xs font-medium text-text-primary/60">Attachments</span>
            {resource.files.map((f) => (
              <a
                key={f.id}
                href={f.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-text-accent underline hover:text-text-accent/80"
              >
                {f.title ?? f.url}
              </a>
            ))}
          </div>
        )}
      </header>

      {isOwnerMentee && <ResourceUpdateForm resourceId={resourceId} menteeId={currentUserId} />}

      <ResourceUpdatesList resourceId={resourceId} />
    </div>
  );
}