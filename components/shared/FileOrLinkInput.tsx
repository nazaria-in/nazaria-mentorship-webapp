// /components/shared/FileOrLinkInput.tsx

"use client";

import * as React from "react";
import { Link2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export type FileOrLinkValue =
  | { kind: "link"; url: string }
  | { kind: "file"; file: File | null };

export interface FileOrLinkInputProps {
  value: FileOrLinkValue;
  onChange: (value: FileOrLinkValue) => void;
  accept?: "file" | "link" | "both";
}

export function FileOrLinkInput({ value, onChange, accept = "both" }: FileOrLinkInputProps) {
  const showToggle = accept === "both";
  const kind = accept === "both" ? value.kind : accept;

  return (
    <div className="flex flex-col gap-2">
      {showToggle && (
        <div className="inline-flex w-fit rounded-full border border-border p-0.5">
          <TabButton active={kind === "link"} onClick={() => onChange({ kind: "link", url: "" })} icon={Link2} label="Paste a link" />
          <TabButton active={kind === "file"} onClick={() => onChange({ kind: "file", file: null })} icon={Upload} label="Upload a file" />
        </div>
      )}

      {kind === "link" ? (
        <input
          type="url"
          value={value.kind === "link" ? value.url : ""}
          onChange={(e) => onChange({ kind: "link", url: e.target.value })}
          placeholder="https://…"
          className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-text-primary placeholder:text-text-primary/40 focus:outline-none dark:bg-white/5"
        />
      ) : (
        <input
          type="file"
          onChange={(e) => onChange({ kind: "file", file: e.target.files?.[0] ?? null })}
          className="w-full text-xs text-text-primary file:mr-2 file:rounded-full file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text-primary"
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Link2;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-text-primary/60 hover:bg-surface-muted"
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}