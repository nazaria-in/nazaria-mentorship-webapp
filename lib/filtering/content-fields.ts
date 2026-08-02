// /lib/filtering/content-fields.ts

"use client";

import { useMemo } from "react";
import type { FilterFieldDef } from "@/lib/filtering/types";
import type { Week, Tag } from "@/types/content";

/**
 * Week + tags options come from the DB, so the field defs can't be a static
 * module-level array like most SmartFilterBar usages — they're built from
 * whatever weeks/tags are currently loaded. Still memoized so it isn't
 * recreated every render (rule of thumb #4 in the filter guide).
 *
 * NOTE: the "tags" relation field needs `content_item_tags!inner(...)` in
 * the select for the filter clause to actually narrow results (see
 * SmartFilterBar guide). Our default list query does NOT use `!inner`
 * (it would silently hide untagged items), so tag filtering only takes
 * effect where the fetch function opts into the inner embed — see the
 * TODO in lib/api/content-items.ts.
 */
export function useContentFieldDefs(weeks: Week[], tags: Tag[]): FilterFieldDef[] {
  return useMemo<FilterFieldDef[]>(
    () => [
      { key: "search", kind: "text", columns: ["title", "description"], searchable: true },
      {
        key: "week",
        kind: "entity",
        label: "Week",
        column: "week_id",
        options: weeks
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
          .map((w) => ({ value: w.id, label: w.name })),
      },
      {
        key: "tags",
        kind: "relation",
        label: "Tags",
        relation: { table: "content_item_tags", column: "tag_id" },
        options: tags.map((t) => ({ value: t.id, label: t.name })),
      },
    ],
    [weeks, tags]
  );
}