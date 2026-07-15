// /components/resources/ResourceUpdatesList.tsx

import { useQuery } from "@tanstack/react-query";
import { fetchResourceUpdates } from "@/lib/api/resources";
import { ResourceUpdateCard } from "@/components/resources/ResourceUpdateCard";
import { EmptyState } from "@/components/shared/EmptyState";

export interface ResourceUpdatesListProps {
  resourceId: string;
}

export function ResourceUpdatesList({ resourceId }: ResourceUpdatesListProps) {
  const { data: updates, isLoading } = useQuery({
    queryKey: ["resource-updates", resourceId],
    queryFn: () => fetchResourceUpdates(resourceId),
  });

  if (isLoading) {
    return <p className="text-sm text-text-primary/50">Loading updates…</p>;
  }

  if (!updates || updates.length === 0) {
    return <EmptyState title="No updates yet" description="Progress logs will show up here." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {updates.map((u) => (
        <ResourceUpdateCard key={u.id} update={u} />
      ))}
    </div>
  );
}