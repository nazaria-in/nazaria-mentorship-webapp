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