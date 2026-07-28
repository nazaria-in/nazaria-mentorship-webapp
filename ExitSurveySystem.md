# Exit Survey System — Context Doc

This file is the single source of truth for how the exit survey feature works.
Read this before touching any exit-survey-related file. It exists so a future
session (human or LLM) doesn't have to re-derive the architecture from git
history or chat logs.

## What this feature is

After a mentorship meeting, the mentee and mentor each fill out a short exit
form (radio/checkbox/rating/short-answer questions), can optionally record a
voice note, and self-report an overall "signal" (green/yellow/red). The voice
note is transcribed and analyzed by Gemini, which also produces a summary and
flags concern categories + follow-up urgency for PM/associate staff to triage.

Key design decisions, in order of how surprising they are if you haven't read
this doc:

1. **Exit survey rows are created at meeting-creation time, not at submit
   time.** When a meeting is created, one *pending* (unfilled) row is
   inserted per mentee (their own survey) and one per (mentor, mentee) pair
   in that meeting (the mentor's survey about that specific mentee). A
   mentor with 2 mentees in one meeting gets 2 rows. Submitting is an
   `UPDATE` on an existing row, never an `INSERT`.
2. **Question templates are DB rows, not code.** PM/associate edit them via
   `/admin/exit-survey-templates`. Only one template can be `is_active` per
   role at a time (DB-enforced via a partial unique index). When a meeting
   is created, whichever template is active *at that moment* gets its
   `questions` array copied verbatim into the new row's `template_snapshot`
   column. Editing a template later never changes already-created rows —
   each row is frozen at creation time.
3. **Every question has a stable `id` independent of its wording.** This is
   what lets PM edit question text without breaking in-flight forms — the
   form's answer state is keyed by question `id`, not by the question string.
4. **The action-item → pod-chat feature was removed.** An earlier version
   forwarded a mentee's "anything else" answer into `notifications` for pod
   messaging. This is gone. Do not re-add without being asked.
5. **The AI call is a single Gemini request** that returns transcript +
   summary + structured triage fields together, forced into JSON via
   `responseSchema` — not two separate calls, not prompt-and-hope parsing.

## Schema

### `exit_survey_templates`
| column | notes |
|---|---|
| `id` | pk |
| `title` | human label, e.g. "Default mentor exit form" |
| `role` | `mentor` \| `mentee` — which submitter role this template is for |
| `questions` | `ExitSurveyTemplateEntry[]` jsonb — see Types below |
| `is_active` | only one `true` per `role`, enforced by partial unique index `exit_survey_templates_one_active_per_role` |
| `created_by`, `created_at` | |

### `exit_surveys`
One row per (meeting, submitter, subject) — see decision #1 above.

| column | notes |
|---|---|
| `id` | pk — this is the id used in the `/exit-survey/[exitSurveyId]` route |
| `meeting_id` | fk → meetings |
| `user_id` | who is filling this out (the submitter) |
| `subject_user_id` | who the survey is **about** — same as `user_id` for a mentee's own survey, the specific mentee for a mentor's survey |
| `user_role` | `mentor` \| `mentee` — the submitter's role |
| `template_id` | fk → exit_survey_templates (which template this came from) |
| `template_snapshot` | frozen copy of that template's `questions` at creation time — **this is what the form renders**, never the live template |
| `answers` | `ExitSurveyEntry[]` jsonb, **nullable** — null until submitted |
| `signal` | `green` \| `yellow` \| `red`, nullable until submitted |
| `transcript`, `ai_summary` | nullable, filled by Gemini if a voice note was used |
| `concern_tags` | `text[]`, closed vocabulary — see `EXIT_SURVEY_CONCERN_TAGS` in types |
| `needs_follow_up` | boolean, AI-derived |
| `follow_up_urgency` | `none` \| `soon` \| `urgent`, AI-derived |
| `created_at` | when the **pending row** was created (meeting creation time) |
| `submitted_at` | **null = pending, non-null = submitted.** This is the field that determines pending vs. done everywhere in the codebase. |

Unique constraint: `(meeting_id, user_id, subject_user_id)`.

### `v_pending_exit_surveys` (view)
Read-only convenience view: `exit_surveys` rows where `submitted_at is null`,
joined to `meetings` (title/times) and `users` (subject's name). This is what
the "what do I still need to fill in" list queries — see
`fetchPendingExitSurveys()`.

## Types (`types/exit-survey.ts`)

```ts
type ExitSurveyTemplateEntry =
  | { id, question, component: "single_select", options: string[], showIf? }
  | { id, question, component: "multi_select", options: string[], showIf? }
  | { id, question, component: "rating", scale: number, showIf? }
  | { id, question, component: "short_answer", showIf? }

type ExitSurveyEntry = same shape as above + `selected` (string | string[] | number)

interface ExitSurveyRow {
  id, meetingId, userId, subjectUserId, userRole,
  templateId, templateSnapshot: ExitSurveyTemplateEntry[],
  answers: ExitSurveyEntry[] | null,
  signal: "green"|"yellow"|"red" | null,
  transcript, aiSummary,
  concernTags, needsFollowUp, followUpUrgency,
  createdAt, submittedAt: string | null,
}
```

`showIf: { questionId, equals }` makes a question conditional on a prior
answer in the same form (e.g. "why not?" only shown if the meeting didn't
fully happen).

## Data flow, end to end

1. **Meeting created** (`POST /api/meetings`) → after the meeting +
   participants are inserted, `createPendingExitSurveys()` in that route
   fetches the currently-active mentor/mentee templates and inserts one
   pending `exit_surveys` row per mentee (mentee's own) and per
   (mentor, mentee) pair (mentor's). If a role has no active template, that
   role's rows are silently skipped with a `console.warn` — meeting creation
   itself never fails because of this.
2. **User visits `/exit-survey`** → sees their pending rows (mentee/mentor)
   or the full dashboard (PM/associate).
3. **User opens `/exit-survey/[exitSurveyId]`** → if it's their own pending
   row, `ExitSurveyForm` renders from `templateSnapshot`. They answer,
   optionally record + transcribe a voice note, pick a signal, submit.
4. **Submit** (`submitExitSurvey`) → `UPDATE exit_surveys SET answers=...,
   signal=..., submitted_at=now() WHERE id = exitSurveyId`, then inserts a
   `notifications` row (reuses the `exit_survey_pending` enum value — see
   note below) so staff know a survey came in.
5. **Optional voice note** → `POST /api/exit-survey/transcribe` → Gemini
   (`analyzeExitSurveyAudio`) → `{ transcript, summary, concernTags,
   needsFollowUp, followUpUrgency }` in one call, forced JSON via
   `responseSchema`. Audio is never persisted — read into memory, sent,
   discarded.
6. **PM/associate dashboard** (`/exit-survey`) → escalations panel (urgent/
   soon + needs-follow-up, sorted to the top) + a filterable table of all
   submitted surveys (`SmartFilterBar`, see below).
7. **Individual report** (`/exit-survey/[exitSurveyId]` viewed by staff) →
   full read-only view including AI fields, regardless of who submitted it.

### Why `notifications.type` is reused instead of a new enum value
Adding a new Postgres enum value (`ALTER TYPE ... ADD VALUE`) can't be
referenced in the same transaction it's added in, which broke an early
migration. Rather than fight that, submission notifications reuse the
existing `exit_survey_pending` type — a pending *notification about* a
submitted survey is distinguished by `exit_survey_id` being set, not by a
separate enum value. If you want a dedicated value later, add it in its own
standalone migration, committed before anything references it.

## Access rules by role

| Route/action | mentee | mentor | pm / associate |
|---|---|---|---|
| Fill their own pending row | ✅ (own only) | ✅ (own only, one per mentee) | — (no template exists for these roles yet — open question, unresolved) |
| View their own submitted answers | ✅ (redacted — no AI fields) | ✅ (redacted — no AI fields) | — |
| View any survey's full report incl. AI analysis | ❌ | ❌ | ✅ |
| See dashboard / escalations / filter | ❌ | ❌ | ✅ |
| Edit templates | ❌ | ❌ | ✅ (UI-gated only — **not yet RLS-enforced**, flagged repeatedly, still open) |

"Redacted" for mentee/mentor's own submitted view means: they see their
answers and transcript, but not `concernTags` / `needsFollowUp` /
`followUpUrgency` / `aiSummary` — those are staff triage fields, not
feedback shown back to the person who submitted.

## File map

```
supabase/migrations/
  0001_redo_exit_surveys.sql              — original table (superseded by 0005 in spirit, kept for history)
  0002_exit_survey_ai_analysis.sql        — concern_tags / needs_follow_up / follow_up_urgency columns
  0004_pending_exit_surveys_view.sql      — v_pending_exit_surveys (superseded by 0005's version)
  0005_exit_survey_templates_and_pending_rows.sql  — THE important one: templates table,
                                              pending-row model, subject_user_id, new unique constraint

types/exit-survey.ts                      — all shared types, EXIT_SURVEY_CONCERN_TAGS vocab
lib/exit-survey/templates.ts              — DEPRECATED, do not use, kept only to fail stale imports loudly

lib/api/exit-survey-templates.ts          — template CRUD (fetch/create/update/activate)
lib/api/exit-surveys.ts                   — submit, fetch pending, fetch for staff, fetch by id
lib/api/exit-survey-transcribe.ts         — client → POST /api/exit-survey/transcribe
lib/google/gemini.ts                      — the actual Gemini call + responseSchema
lib/filtering/exit-survey-fields.ts       — SmartFilterBar field defs for the staff dashboard

app/api/meetings/route.ts                 — meeting creation; createPendingExitSurveys() lives here
app/api/exit-survey/transcribe/route.ts   — server route wrapping the Gemini call

app/exit-survey/page.tsx                  — role-branching landing page
app/exit-survey/[exitSurveyId]/page.tsx   — fill (own pending) / view (own submitted, redacted) / full report (staff)

components/exit-survey/ExitSurveyForm.tsx         — fill UI, driven by templateSnapshot
components/exit-survey/ExitSurveyReportView.tsx   — read-only view, `redacted` prop controls AI-field visibility
components/exit-survey/ExitSurveyMeetingSection.tsx — meeting-detail-page embed (all of the current user's rows for one meeting)
components/exit-survey/ExitSurveyStaffWidget.tsx  — small dashboard-widget version (superseded by the full /exit-survey page, may be redundant now)
components/admin/ExitSurveyTemplateEditor.tsx     — PM/associate template builder UI

hooks/use-audio-recorder.ts               — getUserMedia + MediaRecorder wrapper
```

## Known gaps (do not silently "fix" — ask first, these are tracked)

- **PM/associate exit survey submission**: unconfirmed with the client
  whether these roles submit their own survey at all. No template exists
  for them. `createPendingExitSurveys()` only handles mentor/mentee.
- **RLS not enforced** on template editing/activation or `users.role`
  updates — currently UI-gated only (button disabled for non-PM). Add
  policies before this goes past internal testing.
- **No pg_cron/edge function nudge** at 80%-elapsed-meeting-time. Access to
  the form today is purely via `/exit-survey`'s pending list — no proactive
  reminder yet.
- **`ExitSurveyStaffWidget.tsx`** predates the full `/exit-survey` dashboard
  page and may now be redundant — check before deleting, something might
  still embed it standalone.
- **Concern tags aren't filterable** in the staff dashboard's SmartFilterBar
  yet — `text[]` columns don't map cleanly onto any existing `FilterFieldDef`
  kind (would need a `computed` resolver or a supporting view; skipped for
  now, tags are shown as read-only badges only).

## Update log — structured AI, pod context, template editor UX, RLS

This section documents a significant follow-up pass. If anything above
contradicts this section, this section is newer.

- **AI summary is no longer shown to the submitter, anywhere, including
  during filling.** `ExitSurveyForm` used to show an "AI summary preview"
  panel right after transcribing — that was a leak, since the redaction
  logic in `ExitSurveyReportView` only applied to the *post-submit* read-only
  view, not the fill flow itself. Removed. AI fields are still computed and
  submitted, just never rendered back to mentee/mentor.
- **AI analysis is now fully structured**: `headline` (one-liner),
  `summary` (paragraph), `keyPoints` (string[]), `sentiment`
  (positive/neutral/negative, new filterable column), plus the pre-existing
  `concernTags`/`needsFollowUp`/`followUpUrgency`. One Gemini call, one
  `responseSchema`, all fields — see `lib/google/gemini.ts`.
- **Pod + mentor context**: `v_exit_survey_context` view resolves a survey
  subject's pod and that pod's mentor(s), merged client-side onto
  `ExitSurveyDetail` via `mergeContext()` in `lib/api/exit-surveys.ts`
  (there's no direct FK path for this, hence the separate view + merge
  rather than a single embedded select).
- **Pod filtering** on the staff dashboard is a plain `<select>` outside
  `SmartFilterBar`, filtering the already-fetched+merged rows — pod isn't a
  column on `exit_surveys` itself, so it can't use `applyFilters`.
- **Meeting-wise comparison**: `/exit-survey/meeting/[meetingId]`, staff
  only, shows every row (pending + submitted) for one meeting side by side.
- **Template editor rewritten**: card list instead of `<select>`, real
  add/remove-option buttons (the old comma-separated text input actively
  broke on typing a comma or space mid-edit — not just unpolished, genuinely
  buggy), a `showIf` builder (pick a prior single-choice question + which
  answer triggers this one), and a per-template `voice_prompt_label` field.
  **State management fix**: the editor now holds a local `WorkingTemplate`
  as the sole source of truth once a template is open, instead of deriving
  from the react-query cache — the old version appeared to "hang" on
  save/create because the panel rendered from cache data that hadn't
  refetched yet.
- **RLS enabled** on `exit_survey_templates` and `exit_surveys` for the
  first time (migration 0006) — previously had zero policies, meaning if
  RLS was ever toggled on at the project level, everything on these two
  tables would have silently denied, which is a very plausible explanation
  for both the "template save looked stuck" and "exit survey wasn't
  created" reports. Admin/service-role client (used for meeting creation and
  the backfill route) bypasses RLS regardless.
- **80%-elapsed visibility gate**: `v_pending_exit_surveys` now only
  surfaces a row once `now() >= starts_at + 0.8 * (ends_at - starts_at)`.
  Rows still exist from meeting-creation time — this only changes when they
  show up in the "you need to fill this in" list.
- **Provisioning logic extracted** to `lib/server/exit-survey-provisioning.ts`
  (`createPendingExitSurveys`), now reusable — used by both meeting creation
  and the new manual backfill endpoint,
  `POST /api/meetings/[meetingId]/backfill-exit-surveys` (staff only). Use
  this to fix any meeting that ended up with zero exit survey rows; it's
  upsert-based so it's safe to call on a meeting that already has some rows.
- **`/exit-survey/[exitSurveyId]`** and **`/exit-survey-demo`** both updated
  to pass `voicePromptLabel` through to `ExitSurveyForm`, and to use
  `getExitSurveyDetailById`/`ExitSurveyDetail` instead of the older
  `getExitSurveyById`/`ExitSurveyRow`-only fetch (which no longer exists).

### Still open
- Concern tags remain unfilterable in the dashboard (array column, no
  matching `FilterFieldDef` kind).
- Seeder (`scripts/seed/exitSurveyDemoSeeder.ts`) was not updated for
  `voice_prompt_label` — harmless (defaults to null → "Voice note"), but
  worth a pass if you want the seeded templates to exercise that field too.
- PM/associate submitting their own survey is still unconfirmed/unbuilt.

## Update log — nav wiring, richer showIf, notification handoff

- **Nav wired**: `/exit-survey` now appears in `NavConfig.ts` for mentee,
  mentor, and staff; `/admin/exit-survey-templates` for staff only. Icons:
  `ListChecks` and `Settings2` (lucide-react). Meeting comparison
  (`/exit-survey/meeting/[meetingId]`) is intentionally NOT in nav — it's
  reached by clicking through from a survey/meeting context, not a
  standalone destination.
- **`showIf` now supports all three enumerable parent types**, not just
  single_select:
  - single_select parent → `equals` (exact match)
  - multi_select parent → `equals` (answer array must include this value —
    labeled "includes" in the editor UI)
  - rating parent → `atLeast` (answer must be ≥ this number)
  - short_answer parents are still not supported as triggers (free text has
    no enumerable "the answer that triggers this")
  - Type is now `ExitSurveyShowIf` in `types/exit-survey.ts` (`equals` and
    `atLeast` both optional, exactly one should be set depending on parent).
  - Runtime evaluation lives in `evaluateShowIf()` in `ExitSurveyForm.tsx`.
  - Editor UI (`ExitSurveyTemplateEditor.tsx`) branches its "only show if"
    controls based on the selected parent's component type.
- **PM/associate exclusion confirmed, not changed** — `createPendingExitSurveys`
  already only iterates mentor/mentee participant ids; pm/associate were
  never getting rows. Added an explicit comment there so this doesn't get
  "fixed" into existence accidentally later.
- **Notification/reminder schedule (80% nudge, then 1h/1d/3d/1w
  post-meeting-end reminders) is NOT implemented here** — tracked in
  `docs/EXIT_SURVEY_NOTIFICATIONS_TODO.md`, to be picked up in a separate
  notification-system work session. Do not build this in the exit-survey
  context without also reading that file first, since it documents specific
  constraints (idempotency, stop-on-submit, recipient) that matter.
- **Full testing checklist**: `docs/EXIT_SURVEY_TESTING_CHECKLIST.md` —
  10 sections, run in order, covers everything built across this feature's
  entire history to date.