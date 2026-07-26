// /components/exit-survey/ExitSurveyReportView.tsx

import type { ExitSurveyDetail } from "@/lib/api/exit-surveys";

interface ExitSurveyReportViewProps {
  detail: ExitSurveyDetail;
  /** true = submitter viewing their own past answers (no AI triage fields shown) */
  redacted: boolean;
}

const SIGNAL_LABEL: Record<string, string> = {
  green: "🟢 On track",
  yellow: "🟡 Facing some challenges",
  red: "🔴 Needs a check-in",
};

const URGENCY_LABEL: Record<string, string> = {
  none: "No follow-up needed",
  soon: "Follow up soon",
  urgent: "Follow up urgently",
};

export function ExitSurveyReportView({ detail, redacted }: ExitSurveyReportViewProps) {
  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 dark:border-border dark:bg-card">
      <div>
        <h2 className="font-heading text-xl text-text-primary dark:text-text-primary">
          {detail.meetingTitle}
        </h2>
        <p className="text-sm text-text-muted dark:text-text-muted">
          {detail.userRole === "mentor" ? "Mentor" : "Mentee"} survey
          {detail.userRole === "mentor" && detail.subjectFullName ? ` — about ${detail.subjectFullName}` : ""}
          {!redacted && detail.submitterFullName ? ` — filled by ${detail.submitterFullName}` : ""}
        </p>
        {detail.submittedAt && (
          <p className="text-xs text-text-muted dark:text-text-muted">
            Submitted {new Date(detail.submittedAt).toLocaleString()}
          </p>
        )}
      </div>

      {detail.signal && (
        <div className="w-fit rounded-lg bg-card-alt px-3 py-2 text-sm text-text-primary dark:bg-card-alt dark:text-text-primary">
          {SIGNAL_LABEL[detail.signal] ?? detail.signal}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {(detail.answers ?? []).map((entry) => (
          <div key={entry.id} className="flex flex-col gap-1">
            <p className="text-sm font-medium text-text-primary dark:text-text-primary">{entry.question}</p>
            <p className="text-sm text-text-muted dark:text-text-muted">{formatAnswer(entry)}</p>
          </div>
        ))}
      </div>

      {detail.transcript && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text-primary dark:text-text-primary">Voice note transcript</p>
          <p className="rounded-lg bg-card-alt p-3 text-sm text-text-muted dark:bg-card-alt dark:text-text-muted">
            {detail.transcript}
          </p>
        </div>
      )}

      {!redacted && (
        <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-card-alt p-4 dark:border-border-strong dark:bg-card-alt">
          <p className="text-sm font-medium text-text-primary dark:text-text-primary">Staff triage</p>

          {detail.aiSummary && (
            <p className="text-sm text-text-primary dark:text-text-primary">{detail.aiSummary}</p>
          )}

          <p className="text-sm text-text-muted dark:text-text-muted">
            {URGENCY_LABEL[detail.followUpUrgency] ?? detail.followUpUrgency}
            {detail.needsFollowUp ? " — flagged for follow-up" : ""}
          </p>

          {detail.concernTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {detail.concernTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground dark:bg-accent dark:text-accent-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatAnswer(entry: NonNullable<ExitSurveyDetail["answers"]>[number]): string {
  switch (entry.component) {
    case "single_select":
      return entry.selected || "No answer";
    case "multi_select":
      return entry.selected.length > 0 ? entry.selected.join(", ") : "None selected";
    case "rating":
      return `${entry.selected} / ${entry.scale}`;
    case "short_answer":
      return entry.selected || "—";
  }
}