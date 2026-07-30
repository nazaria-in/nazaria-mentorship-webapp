// components/admin/dashboard/StatusStrip.tsx
"use client";

import Link from "next/link";

export interface StatusTile {
  label: string;
  value: string;
  alert?: boolean;
  href?: string;
}

export function StatusStrip({ tiles }: { tiles: StatusTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => {
        const content = (
          <div
            className={`flex flex-col gap-1 rounded-xl border p-4 ${
              tile.alert
                ? "bg-card-strong border-border-strong dark:bg-card-strong dark:border-border-strong"
                : "bg-card border-border dark:bg-card dark:border-border"
            }`}
          >
            <span
              className={`font-heading text-2xl font-semibold ${
                tile.alert ? "text-text-accent dark:text-text-accent" : "text-text-primary dark:text-text-primary"
              }`}
            >
              {tile.value}
            </span>
            <span className="text-xs text-text-muted dark:text-text-muted">{tile.label}</span>
          </div>
        );

        return tile.href ? (
          <Link key={tile.label} href={tile.href} className="block transition-opacity hover:opacity-80">
            {content}
          </Link>
        ) : (
          <div key={tile.label}>{content}</div>
        );
      })}
    </div>
  );
}