// /lib/api/content-analytics.ts

import { supabase } from "@/lib/supabase/client";
import type { AdditionalQuestionAnswerValue } from "@/types/content";

interface RawAnalyticsAnswerRow {
  metric_key: string;
  value: AdditionalQuestionAnswerValue;
  content_item_id: string;
  content_item: { title: string } | null;
}

export interface MetricRollupRow {
  metricKey: string;
  totalAnswers: number;
  /** Present when every answer under this metric key was a plain number (rating questions). */
  numericStats: { avg: number; min: number; max: number } | null;
  /** Present otherwise — a histogram of answer values (single/multi-select, short answer text as-is). */
  valueCounts: Record<string, number> | null;
  /** Distinct content items that contributed at least one answer to this metric key, for drill-down links. */
  contentItems: { id: string; title: string }[];
}

/**
 * Groups all content_analytics_answers by metric_key — this is the whole
 * point of the metricKey convention (see the "Track in analytics" tooltip
 * in ContentSubmissionTemplateEditor): two questions on two different
 * content items with the same metric_key show up as one combined row
 * here, not two separate ones.
 *
 * Aggregation happens client-side after one fetch rather than in SQL,
 * since `value` is jsonb holding three different shapes (number | string |
 * string[]) — a single SQL aggregate can't cleanly branch on that. Fine at
 * current scale; if this table grows large, the numeric branch in
 * particular (avg/min/max) would be cheap to push into a SQL view keyed on
 * `(value)::numeric` for rows where that cast succeeds.
 */
export async function fetchAnalyticsRollup(): Promise<MetricRollupRow[]> {
  const { data, error } = await supabase
    .from("content_analytics_answers")
    .select("metric_key, value, content_item_id, content_item:content_items(title)");
  if (error) throw error;

  const rows = (data ?? []) as unknown as RawAnalyticsAnswerRow[];

  const byMetricKey = new Map<string, RawAnalyticsAnswerRow[]>();
  for (const row of rows) {
    const bucket = byMetricKey.get(row.metric_key) ?? [];
    bucket.push(row);
    byMetricKey.set(row.metric_key, bucket);
  }

  return Array.from(byMetricKey.entries()).map(([metricKey, answers]) => {
    const allNumeric = answers.every((a) => typeof a.value === "number");

    let numericStats: MetricRollupRow["numericStats"] = null;
    let valueCounts: MetricRollupRow["valueCounts"] = null;

    if (allNumeric) {
      const values = answers.map((a) => a.value as number);
      numericStats = {
        avg: values.reduce((sum, v) => sum + v, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    } else {
      valueCounts = {};
      for (const answer of answers) {
        const labels = Array.isArray(answer.value) ? answer.value : [String(answer.value)];
        for (const label of labels) {
          valueCounts[label] = (valueCounts[label] ?? 0) + 1;
        }
      }
    }

    const contentItemsById = new Map<string, string>();
    for (const answer of answers) {
      if (!contentItemsById.has(answer.content_item_id)) {
        contentItemsById.set(answer.content_item_id, answer.content_item?.title ?? "Untitled");
      }
    }

    return {
      metricKey,
      totalAnswers: answers.length,
      numericStats,
      valueCounts,
      contentItems: Array.from(contentItemsById.entries()).map(([id, title]) => ({ id, title })),
    };
  });
}