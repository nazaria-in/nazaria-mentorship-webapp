// /components/resources/ResourceUpdateCard.tsx

import { File as FileIcon } from "lucide-react";
import type { ResourceUpdateWithFile } from "@/types/resources";

export interface ResourceUpdateCardProps {
  update: ResourceUpdateWithFile;
}

export function ResourceUpdateCard({ update }: ResourceUpdateCardProps) {
  return (
    <div className="surface-card-alt flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-primary/50">{formatDateTime(update.created_at)}</span>
        {update.progress_percent !== null && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
            {update.progress_percent}%
          </span>
        )}
      </div>

      <p className="whitespace-pre-wrap text-sm text-text-primary">{update.progress_note}</p>

      <div className="flex items-center gap-3 text-xs text-text-primary/50">
        {update.hours_spent !== null && <span>{update.hours_spent}h logged</span>}
        {update.file && (
          <a
            href={update.file.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-text-accent hover:underline"
          >
            <FileIcon className="h-3.5 w-3.5" />
            {update.file.title ?? "Attachment"}
          </a>
        )}
      </div>
    </div>
  );
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}