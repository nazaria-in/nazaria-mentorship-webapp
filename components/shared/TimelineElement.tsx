// /components/shared/TimelineElement.tsx

"use client";

import * as React from "react";

export interface TimelineElementProps {
  title: string;
  timeLabel: string;
  statusLabel?: string;
  isMuted?: boolean;
  onShowDetails: () => void;
  /** compact = absolutely-positioned inside an hour-grid slot. non-compact = a stacked chip or row bar. */
  compact?: boolean;
  /** Architecture variant supporting the structural segregation of data types */
  variant?: "meeting" | "assignment" | "month-summary";
  /** Structural duration layouts to optimize vertical space (e.g., 'short' <= 30m, 'standard' >= 60m) */
  durationVariant?: "short" | "standard";
  /** Multi-day assignment attributes for horizontal grid placement */
  assignmentSpanDays?: number;
  isDeadlineNode?: boolean;
  children?: React.ReactNode;
}

export function TimelineElement({
  title,
  timeLabel,
  statusLabel,
  isMuted = false,
  onShowDetails,
  compact = true,
  variant = "meeting",
  durationVariant = "standard",
  assignmentSpanDays = 1,
  isDeadlineNode = false,
  children,
}: TimelineElementProps): React.JSX.Element {
  
  // Base Layout Engine Class Assignment
  let variantClasses = "";
  
  if (variant === "assignment") {
    // Structural multi-day horizon style layout
    variantClasses = "h-8 items-center flex-row justify-between px-3 py-1 rounded-md border border-dashed text-ellipsis";
  } else if (variant === "month-summary") {
    // Executive summary architecture for month day cells
    variantClasses = "w-full justify-between items-center flex-row px-2 py-0.5 text-left border-b last:border-0";
  } else {
    // Standard and short meeting layouts inside the timeline track
    variantClasses = compact 
      ? `h-full p-1.5 ${durationVariant === "short" ? "flex-row items-center gap-2 justify-between" : "flex-col items-start gap-0.5"}` 
      : "px-2 py-1 flex-col items-start gap-0.5";
  }

  return (
    <button
      type="button"
      onClick={onShowDetails}
      style={
        variant === "assignment" && assignmentSpanDays > 1 
          ? { gridColumnEnd: `span ${assignmentSpanDays}` } 
          : undefined
      }
      className={`surface-card-strong flex w-full overflow-hidden text-left transition hover:border-border-strong ${variantClasses} ${
        isMuted ? "opacity-50 line-through" : ""
      }`}
    >
      {/* Structural Data Rendering Split Logic */}
      {variant === "assignment" ? (
        <>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs font-bold shrink-0">[✏️]</span>
            <p className="truncate text-xs font-semibold text-text-primary">{title}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <p className="text-[11px] text-text-muted hidden sm:block">{timeLabel}</p>
            {isDeadlineNode && (
              <span className="text-[10px] font-bold bg-error text-error-foreground px-1.5 py-0.2 rounded animate-pulse">
                🎯 Due
              </span>
            )}
          </div>
        </>
      ) : variant === "month-summary" ? (
        <>
          <p className="truncate text-xs text-text-primary font-medium">{title}</p>
          <p className="text-[10px] text-text-muted shrink-0 ml-1.5">{timeLabel}</p>
        </>
      ) : (
        /* Standard Timeline Meeting Layout */
        <>
          {durationVariant === "short" ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <p className="truncate text-xs font-semibold text-text-primary">{title}</p>
              <p className="truncate text-[11px] text-text-muted">({timeLabel})</p>
            </div>
          ) : (
            <>
              <p className="w-full truncate text-xs font-semibold text-text-primary">{title}</p>
              <p className="w-full truncate text-[11px] text-text-muted">{timeLabel}</p>
            </>
          )}

          {/* Render status metrics conditionally based on length space boundaries */}
          {statusLabel && durationVariant !== "short" && (
            <span className="inline-block rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground mt-0.5">
              {statusLabel}
            </span>
          )}
        </>
      )}
      
      {children}
    </button>
  );
}