// /components/shared/uploadbox/UploadBox.tsx

"use client";

import * as React from "react";
import { File as FileIcon, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadBoxFileType = "file" | "image" | "document" | "other";

export interface UploadedFileRef {
  id: string;
  name: string;
  url: string;
  fileType: UploadBoxFileType;
  sizeLabel: string;
}

export interface UploadBoxProps {
  value: UploadedFileRef[];
  onChange: (files: UploadedFileRef[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
  helperText?: string;
  className?: string;
}

function guessFileType(file: File): UploadBoxFileType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.type.includes("document") || file.type.includes("text")) {
    return "document";
  }
  return "file";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Demo upload box — no real storage backend yet. Files are held as local
 * object URLs (`URL.createObjectURL`), which only work in this browser
 * session and aren't persisted anywhere. Good enough to build and test the
 * resources UI end-to-end; replace `simulateUpload` with a real upload
 * call (e.g. Supabase Storage) when that's wired up.
 */
export function UploadBox({ value, onChange, multiple = true, accept, label = "Attach files", helperText, className }: UploadBoxProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = React.useState(0);

  function simulateUpload(file: File): Promise<UploadedFileRef> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          url: URL.createObjectURL(file),
          fileType: guessFileType(file),
          sizeLabel: formatSize(file.size),
        });
      }, 500);
    });
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploadingCount((c) => c + files.length);
    try {
      const uploaded = await Promise.all(files.map(simulateUpload));
      onChange(multiple ? [...value, ...uploaded] : uploaded.slice(0, 1));
    } finally {
      setUploadingCount((c) => Math.max(0, c - files.length));
    }
  }

  function removeFile(id: string) {
    onChange(value.filter((f) => f.id !== id));
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-xs font-medium text-text-primary/70">{label}</span>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-4 text-sm text-text-primary/60 transition-colors hover:border-ring hover:text-text-primary dark:bg-white/5"
      >
        {uploadingCount > 0 ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Click to upload{multiple ? " files" : " a file"}
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {helperText && <span className="text-[11px] text-text-primary/45">{helperText}</span>}

      {value.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {value.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary"
            >
              {f.fileType === "image" ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <FileIcon className="h-3.5 w-3.5 shrink-0" />}
              <span className="flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-text-primary/40">{f.sizeLabel}</span>
              <button
                type="button"
                onClick={() => removeFile(f.id)}
                aria-label={`Remove ${f.name}`}
                className="shrink-0 rounded-full p-0.5 text-text-primary/40 hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}