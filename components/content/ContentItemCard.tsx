// /components/content/ContentItemCard.tsx

"use client";

import Link from "next/link";
import { BookOpen, ClipboardList, FileBox, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ContentItemWithMeta } from "@/types/content";

const TYPE_ICON = { assignment: ClipboardList, course: BookOpen, resource: FileBox } as const;

interface ContentItemCardProps {
  item: ContentItemWithMeta;
  href: string;
  onEdit?: () => void;
  onDelete?: () => Promise<void> | void;
}

export function ContentItemCard({ item, href, onEdit, onDelete }: ContentItemCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const Icon = TYPE_ICON[item.content_type];

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setMenuOpen(false);
    }
  }

  return (
    <div className="surface-card group relative flex flex-col gap-3 dark:surface-card">
      <Link href={href} className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground">
            <Icon className="h-4 w-4" />
          </span>
          {item.week && (
            <span className="rounded-full bg-card-alt px-2 py-0.5 text-[11px] font-medium text-text-muted dark:bg-card-alt dark:text-text-muted">
              {item.week.name}
            </span>
          )}
        </div>
        <h3 className="font-heading text-base font-medium leading-snug text-text-primary dark:text-text-primary">
          {item.title || "Untitled"}
        </h3>
        {item.description && (
          <p className="line-clamp-2 text-sm text-text-muted dark:text-text-muted">{item.description}</p>
        )}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted dark:border-border dark:text-text-muted"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </Link>

      {(onEdit || onDelete) && (
        <div className="absolute right-3 top-3">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Item actions"
            className="rounded-full bg-card p-1.5 text-text-muted opacity-0 transition-opacity hover:text-text-primary group-hover:opacity-100 dark:bg-card dark:text-text-muted dark:hover:text-text-primary"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="surface-card-strong absolute right-0 top-9 z-10 flex w-36 flex-col gap-1 p-1.5 dark:surface-card-strong">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-text-primary hover:bg-card-alt dark:text-text-primary dark:hover:bg-card-alt"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-destructive hover:bg-card-alt disabled:opacity-50 dark:text-destructive dark:hover:bg-card-alt"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}