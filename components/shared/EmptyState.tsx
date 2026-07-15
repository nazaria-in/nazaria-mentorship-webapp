// /components/shared/EmptyState.tsx

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-6 text-center", className)}>
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description && <p className="text-xs text-text-primary/60">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}