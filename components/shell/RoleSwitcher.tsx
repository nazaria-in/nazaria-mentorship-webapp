// /components/shell/RoleSwitcher.tsx

"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole, ROLE_LABELS, type Role } from "@/providers/role-provider";

export function RoleSwitcher() {
  const { role, setRole, canSwitchRole, availableRoles } = useRole();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!canSwitchRole) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Switch role"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-text-primary",
          "hover:bg-surface-muted dark:hover:bg-white/5"
        )}
      >
        {ROLE_LABELS[role]}
        <ChevronDown className="h-3.5 w-3.5 text-text-primary/50" />
      </button>

      {open && (
        <div 
          className={cn(
            "absolute z-30 min-w-[180px] rounded-2xl border border-border bg-surface p-1.5 shadow-lg dark:shadow-black/40",
            // Mobile (FAB context): Fly upwards above the button, anchored right
            "bottom-full right-0 mb-1.5",
            // Desktop (Header context): Reset to drop down below the button
            "sm:bottom-auto sm:top-full sm:right-0 sm:mt-1 sm:mb-0"
          )}
        >
          <p className="px-2 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-text-primary/40">
            View as
          </p>
          {availableRoles.map((r) => (
            <RoleOption 
              key={r} 
              role={r} 
              active={r === role} 
              onSelect={() => { 
                setRole(r); 
                setOpen(false); 
              }} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoleOption({ role, active, onSelect }: { role: Role; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-text-primary hover:bg-surface-muted dark:hover:bg-white/5"
      )}
    >
      {ROLE_LABELS[role]}
      {active && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
    </button>
  );
}