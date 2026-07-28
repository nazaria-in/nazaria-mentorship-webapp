// /scripts/seed/exitSurveyDemoSeeder.ts
//
// Run with: npx tsx scripts/seed/exitSurveyDemoSeeder.ts
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
//
// Creates a PM, mentor, and mentee account (real auth users — log in as
// each in separate browser profiles), a cohort, a pod, default mentor/
// mentee exit survey templates (activated), and one meeting between the
// mentor and mentee that has already "happened." Pending exit_surveys rows
// are created directly here (mirroring /app/api/meetings/route.ts's logic)
// since this script bypasses that route.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = "Demo1234!";

interface DemoAccount {
  email: string;
  fullName: string;
  role: "pm" | "mentor" | "mentee";
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "pm.demo@nazariacollective.test", fullName: "Priya PM", role: "pm" },
  { email: "mentor.demo@nazariacollective.test", fullName: "Rahul Mentor", role: "mentor" },
  { email: "mentee.demo@nazariacollective.test", fullName: "Aisha Mentee", role: "mentee" },
];

// Trimmed subset of the real mentor/mentee form content, in the new
// component-typed shape. Full templates should be built out via the
// /admin/exit-survey-templates editor — this is enough to exercise every
// component type (single_select, multi_select, rating, short_answer) in
// the demo without hand-typing all 13 questions from the original form.
function buildDefaultMentorQuestions() {
  return [
    { id: randomUUID(), component: "single_select" as const, question: "Did your meeting happen?", options: ["Yes", "Partially", "No"] },
    { id: randomUUID(), component: "rating" as const, question: "How engaged was your mentee today?", scale: 5 },
    {
      id: randomUUID(),
      component: "single_select" as const,
      question: "Did your mentee complete this week's assignment?",
      options: ["Completed fully", "Mostly completed", "Partially completed", "Not completed"],
    },
    {
      id: randomUUID(),
      component: "multi_select" as const,
      question: "Are there any concerns you'd like to flag?",
      options: ["Attendance", "Motivation", "Family situation", "Mental health / wellbeing", "No concerns"],
    },
    { id: randomUUID(), component: "short_answer" as const, question: "One win from today's session" },
  ];
}

function buildDefaultMenteeQuestions() {
  return [
    { id: randomUUID(), component: "single_select" as const, question: "Did your meeting happen?", options: ["Yes", "Partially", "No"] },
    { id: randomUUID(), component: "rating" as const, question: "How helpful was today's session?", scale: 5 },
    {
      id: randomUUID(),
      component: "multi_select" as const,
      question: "My mentor today...",
      options: ["Listened carefully", "Encouraged me", "Helped me solve problems", "Shared useful industry advice"],
    },
    {
      id: randomUUID(),
      component: "single_select" as const,
      question: "This week's assignment feels:",
      options: ["Very easy", "Manageable", "Challenging", "Very difficult"],
    },
    { id: randomUUID(), component: "short_answer" as const, question: "One thing I learnt today" },
  ];
}

async function getOrCreateAuthUser(email: string): Promise<string> {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });

  if (!createError && created.user) {
    return created.user.id;
  }

  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw new Error(`Failed to look up existing user for ${email}: ${listError.message}`);

  const existing = list.users.find((u) => u.email === email);
  if (!existing) {
    throw new Error(`User ${email} couldn't be created or found: ${createError?.message}`);
  }
  return existing.id;
}

async function upsertProfile(userId: string, account: DemoAccount): Promise<void> {
  const { error } = await supabase.from("users").upsert(
    {
      id: userId,
      email: account.email,
      full_name: account.fullName,
      role: account.role,
      approval_status: "approved",
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`Failed to upsert profile for ${account.email}: ${error.message}`);
}

async function getOrCreateCohort(name: string): Promise<string> {
  const { data: existing } = await supabase.from("cohorts").select("id").eq("name", name).maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("cohorts")
    .insert({ name, status: "active" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create cohort: ${error?.message}`);
  return data.id as string;
}

async function getOrCreatePod(name: string, cohortId: string): Promise<string> {
  const { data: existing } = await supabase.from("pods").select("id").eq("name", name).maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("pods")
    .insert({ name, cohort_id: cohortId })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create pod: ${error?.message}`);
  return data.id as string;
}

async function assignToPod(userId: string, podId: string): Promise<void> {
  await supabase.from("pod_members").delete().eq("user_id", userId);
  const { error } = await supabase.from("pod_members").insert({ user_id: userId, pod_id: podId });
  if (error) throw new Error(`Failed to assign user ${userId} to pod: ${error.message}`);
}

/**
 * Ensures an active template exists for the given role. If one's already
 * active, reuses it (idempotent re-runs). Otherwise creates the default
 * questions above and activates them, deactivating any prior active row
 * first (the DB's partial unique index requires this order).
 */
async function ensureActiveTemplate(
  role: "mentor" | "mentee",
  createdBy: string,
  questions: ReturnType<typeof buildDefaultMentorQuestions>
): Promise<{ id: string; questions: unknown }> {
  const { data: existingActive } = await supabase
    .from("exit_survey_templates")
    .select("id, questions")
    .eq("role", role)
    .eq("is_active", true)
    .maybeSingle();

  if (existingActive) {
    return { id: existingActive.id as string, questions: existingActive.questions };
  }

  const { data: created, error: createError } = await supabase
    .from("exit_survey_templates")
    .insert({ title: `Default ${role} exit form (seeded)`, role, questions, created_by: createdBy, is_active: false })
    .select("id, questions")
    .single();
  if (createError || !created) throw new Error(`Failed to create ${role} template: ${createError?.message}`);

  const { error: activateError } = await supabase
    .from("exit_survey_templates")
    .update({ is_active: true })
    .eq("id", created.id);
  if (activateError) throw new Error(`Failed to activate ${role} template: ${activateError.message}`);

  return { id: created.id as string, questions: created.questions };
}

async function createDemoMeeting(
  createdBy: string,
  mentorId: string,
  menteeId: string
): Promise<string> {
  const endsAt = new Date(Date.now() - 5 * 60 * 1000);
  const startsAt = new Date(endsAt.getTime() - 30 * 60 * 1000);

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      created_by: createdBy,
      title: "Weekly mentor check-in (demo)",
      description: "Seeded meeting for exit survey demo.",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "completed",
    })
    .select("id")
    .single();

  if (meetingError || !meeting) throw new Error(`Failed to create meeting: ${meetingError?.message}`);
  const meetingId = meeting.id as string;

  const { error: participantsError } = await supabase.from("meeting_participants").insert([
    { meeting_id: meetingId, user_id: mentorId, status: "accepted", invited_by: createdBy },
    { meeting_id: meetingId, user_id: menteeId, status: "accepted", invited_by: createdBy },
  ]);
  if (participantsError) {
    throw new Error(`Failed to add meeting participants: ${participantsError.message}`);
  }

  return meetingId;
}

async function createPendingExitSurveyRows(
  meetingId: string,
  mentorId: string,
  mentorTemplateId: string,
  mentorQuestions: unknown,
  menteeId: string,
  menteeTemplateId: string,
  menteeQuestions: unknown
): Promise<void> {
  const { error } = await supabase.from("exit_surveys").insert([
    {
      meeting_id: meetingId,
      user_id: menteeId,
      subject_user_id: menteeId,
      user_role: "mentee",
      template_id: menteeTemplateId,
      template_snapshot: menteeQuestions,
    },
    {
      meeting_id: meetingId,
      user_id: mentorId,
      subject_user_id: menteeId,
      user_role: "mentor",
      template_id: mentorTemplateId,
      template_snapshot: mentorQuestions,
    },
  ]);
  if (error) throw new Error(`Failed to create pending exit survey rows: ${error.message}`);
}

async function main() {
  console.log("Creating demo accounts...");
  const userIds: Record<string, string> = {};
  for (const account of DEMO_ACCOUNTS) {
    const userId = await getOrCreateAuthUser(account.email);
    await upsertProfile(userId, account);
    userIds[account.role] = userId;
    console.log(`  ${account.role.padEnd(6)} → ${account.email}`);
  }

  console.log("Creating cohort + pod...");
  const cohortId = await getOrCreateCohort("Demo Cohort 2026");
  const podId = await getOrCreatePod("Demo Pod", cohortId);
  await assignToPod(userIds.mentor, podId);
  await assignToPod(userIds.mentee, podId);

  console.log("Ensuring default exit survey templates are active...");
  const mentorTemplate = await ensureActiveTemplate("mentor", userIds.pm, buildDefaultMentorQuestions());
  const menteeTemplate = await ensureActiveTemplate("mentee", userIds.pm, buildDefaultMenteeQuestions());

  console.log("Creating meeting (already ended)...");
  const meetingId = await createDemoMeeting(userIds.pm, userIds.mentor, userIds.mentee);

  console.log("Creating pending exit survey rows...");
  await createPendingExitSurveyRows(
    meetingId,
    userIds.mentor,
    mentorTemplate.id,
    mentorTemplate.questions,
    userIds.mentee,
    menteeTemplate.id,
    menteeTemplate.questions
  );

  console.log("\nDone. Login credentials (same password for all):");
  console.log(`  Password: ${DEMO_PASSWORD}`);
  for (const account of DEMO_ACCOUNTS) {
    console.log(`  ${account.role.padEnd(6)} → ${account.email}`);
  }
  console.log(`\nMeeting id: ${meetingId}`);
  console.log("Log in as mentor or mentee and visit /exit-survey-demo — the pending");
  console.log("exit survey row should show up (mentor sees one entry for the mentee).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});