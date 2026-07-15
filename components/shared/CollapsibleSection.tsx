// /components/shared/CollapsibleSection.tsx

"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  accentClassName?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  accentClassName,
  headerRight,
  children,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <section className={cn("flex flex-col rounded-2xl border border-border bg-surface", className)}>
      {/* Header Container: Holds the absolute toggle button 
        and the visual layout layer.
      */}
      <div className="group relative flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border/10 select-none">
        
        {/* The Invisible Giant Button:
          Stretches to 100% of the parent's width and height.
          No gaps, no dead zones, and matches the top corner border radius.
        */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="absolute inset-0 h-full w-full rounded-t-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
        />

        {/* Visual Content Layer:
          Uses `pointer-events-none` so that clicking on text/chevron 
          passes right through to trigger the overlay button beneath.
        */}
        <div className="pointer-events-none z-10 flex flex-1 min-w-0 items-center gap-2.5">
          <ChevronDown 
            className={cn(
              "h-4 w-4 shrink-0 text-text-primary/50 transition-transform duration-200 group-hover:text-text-primary", 
              open && "rotate-180"
            )} 
          />
          <span className={cn("h-2 w-2 shrink-0 rounded-full", accentClassName ?? "bg-primary")} />
          
          <h2 className="truncate font-heading text-base font-semibold text-text-primary group-hover:text-text-accent transition-colors">
            {title}
          </h2>

          {typeof count === "number" && (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              {count}
            </span>
          )}
        </div>

        {/* Interactive Actions Layer:
          Has `z-20` and `pointer-events-auto` so buttons/menus here 
          intercept clicks cleanly without collapsing/expanding the section.
        */}
        {headerRight && (
          <div className="relative z-20 shrink-0 flex items-center pointer-events-auto">
            {headerRight}
          </div>
        )}
      </div>

      {/* Collapsible Content Section */}
      {open && (
        <div className="flex flex-col gap-3 p-4 pt-3.5 border-t border-border/45 animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </section>
  );
}