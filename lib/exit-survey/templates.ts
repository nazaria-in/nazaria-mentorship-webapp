// /lib/exit-survey/templates.ts
//
// DEPRECATED as of migration 0005 — exit survey templates now live in the
// exit_survey_templates DB table, editable via /admin/exit-survey-templates
// and lib/api/exit-survey-templates.ts. Meeting creation snapshots the
// active template's questions into each exit_surveys row at creation time
// (see /app/api/meetings/route.ts). This file is kept only so any stale
// import fails loudly at compile time rather than silently using stale
// content — delete it once you've confirmed nothing still imports from here.
export {};