// /seeder.ts
/**
 * seeder.ts
 * --------------------------------------------------------------------------
 * Demo data seeder for the mentorship-platform schema (Next.js + Supabase).
 *
 * Reads ./seeddata.json (same folder as this file) and inserts:
 *   users -> cohorts -> pods -> pod_members -> assignments ->
 *   assignment_submission_slots -> mentee_assignments -> files ->
 *   mentee_submissions -> meeting_series -> meetings -> meeting_participants ->
 *   exit_surveys -> resources_and_courses -> resource_updates ->
 *   conversations -> conversation_participants -> messages ->
 *   notifications -> user_notifications
 *
 * Then seeds a fixed set of FRESH TEST ACCOUNTS (one mentor, one mentee, one
 * pod containing both) with known credentials — see FRESH_TEST_ACCOUNTS
 * below — so you always have a clean login to test from regardless of what
 * seeddata.json contains or how stale it's gotten.
 *
 * ENUM VALUES (confirmed via live DB introspection - keep this in sync with
 * the actual Postgres enums if you ever alter them):
 *   user_role                    : pm | associate | mentor | mentee
 *   approval_status               : pending | approved | rejected
 *   cohort_status                 : upcoming | active | completed
 *   link_type                     : file | image | document | other
 *   submission_status             : pending_review | revision_requested | approved
 *   meeting_status                : scheduled | completed | cancelled
 *   meeting_participant_status    : pending | accepted | declined
 *   recurrence_type                : none | daily | weekly | monthly
 *   resource_course_type          : handbook | toolkit | template | video | guide | external_course
 *   resource_status                : ongoing | paused | completed | abandoned
 *   notification_type             : meeting_invite | meeting_started | assignment_due |
 *                                    assignment_submitted | assignment_reviewed |
 *                                    exit_survey_pending | message | reminder | achievement
 *   notification_delivery_status  : pending | sent | failed
 *
 * WHY AUTH USERS ARE CREATED FIRST
 * `public.users.id` is a foreign key into `auth.users.id` (Supabase's
 * standard pattern). You can't just insert an arbitrary uuid into
 * `public.users` - the row has to already exist in `auth.users`. So this
 * script:
 *   1. Creates an auth user per entry in seeddata.json["users"] via the
 *      Admin API (supabase.auth.admin.createUser), using the seed `email`.
 *   2. Captures the REAL id Supabase generates for that auth user.
 *   3. Builds an idMap: seedData id -> real auth id.
 *   4. Remaps every user-id-shaped field (created_by, mentee_id, sender_id,
 *      reviewed_by, assigned_by, etc.) through idMap before inserting into
 *      any other table.
 *
 * All non-user tables use `gen_random_uuid()` as their default, but this
 * script explicitly inserts the ids from seeddata.json for THOSE tables too
 * (cohorts, pods, assignments, etc.) since Postgres happily accepts an
 * explicit uuid on insert, and doing so keeps every cross-reference in
 * seeddata.json 100% stable and human-readable.
 *
 * NOTIFICATIONS SEEDING — CHANGED
 * The previous version of steps 19-20 did a raw upsert of
 * seeddata.json["notifications"] / ["user_notifications"] verbatim. This
 * produced rows that don't match what the real app ever produces:
 *   - scheduled_for was whatever (or null) was authored in the JSON, but
 *     lib/api/notifications.ts's createNotification() ALWAYS sets it
 *     (defaults to now()) — so seeded rows with null scheduled_for could
 *     never occur through real app usage, and silently broke
 *     dispatch-notifications' `.lte("notifications.scheduled_for", ...)`
 *     filter (a null never satisfies lte).
 *   - user_notifications fanout was a hand-authored parallel array in
 *     seeddata.json, which can drift out of sync with the notification's
 *     actual recipients (e.g. a meeting's real participant list).
 * Fixed below: scheduled_for is always forced to a real timestamp, and
 * fanout is DERIVED from each notification's own foreign key (meeting_id ->
 * meeting_participants, mentee_assignment_id -> that assignment's mentee,
 * exit_survey_id -> that survey's user_id, message_id -> conversation
 * participants) instead of trusted from the JSON's separate array. This
 * mirrors exactly what createNotification()'s real recipientUserIds
 * resolution looks like at each call site.
 *
 * USAGE
 *   1. npm install @supabase/supabase-js dotenv tsx --save-dev
 *   2. Add to .env.local (or .env):
 *        NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=eyJ....   <-- service role, NOT anon key
 *   3. Run:
 *        npx tsx seeder.ts
 *      or add a script: "seed": "tsx seeder.ts"
 *
 * SAFE TO RE-RUN
 *   The script upserts everywhere it can (onConflict: 'id') and looks up
 *   existing auth users by email before creating new ones, so running it
 *   twice will not duplicate data or error out.
 * --------------------------------------------------------------------------
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

import { randomUUID } from "crypto";

dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Domain enums (mirrors the USER-DEFINED postgres enum columns, confirmed
// via live introspection - see header comment above)
// ---------------------------------------------------------------------------

type UserRole = "pm" | "associate" | "mentor" | "mentee";
type ApprovalStatus = "pending" | "approved" | "rejected";
type CohortStatus = "upcoming" | "active" | "completed";
type LinkType = "file" | "image" | "document" | "other";
type SubmissionStatus = "pending_review" | "revision_requested" | "approved";
type MeetingStatus = "scheduled" | "completed" | "cancelled";
type MeetingParticipantStatus = "pending" | "accepted" | "declined";
type RecurrenceType = "none" | "daily" | "weekly" | "monthly";
type ResourceCourseType =
  | "handbook"
  | "toolkit"
  | "template"
  | "video"
  | "guide"
  | "external_course";
type ResourceStatus = "ongoing" | "paused" | "completed" | "abandoned";
type NotificationType =
  | "meeting_invite"
  | "meeting_started"
  | "assignment_due"
  | "assignment_submitted"
  | "assignment_reviewed"
  | "exit_survey_pending"
  | "message"
  | "reminder"
  | "achievement";
type NotificationDeliveryStatus = "pending" | "sent" | "failed";

// ---------------------------------------------------------------------------
// Row shapes for seeddata.json (as authored, BEFORE id remapping)
// ---------------------------------------------------------------------------

interface SeedUser {
  id: string;
  email: string;
  role: UserRole;
  bio: string | null;
  background_notes: string | null;
  goals: string[] | null;
  interests: string[] | null;
  school_or_org: string | null;
  approval_status: ApprovalStatus;
}

interface SeedCohort {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: CohortStatus;
  description: string | null;
}

interface SeedPod {
  id: string;
  cohort_id: string;
  name: string;
  skill_level: string | null;
  description: string | null;
}

interface SeedPodMember {
  id: string;
  pod_id: string;
  user_id: string;
}

interface SeedAssignment {
  id: string;
  title: string;
  description: string;
  instructions: string | null;
  week_number: number | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_by: string;
}

interface SeedAssignmentSubmissionSlot {
  id: string;
  assignment_id: string;
  title: string;
  order_index: number;
  max_versions: number;
}

interface SeedMenteeAssignment {
  id: string;
  mentee_id: string;
  assignment_id: string;
  assigned_by: string;
  description: string | null;
  due_at: string;
  is_completed: boolean;
}

interface SeedFile {
  id: string;
  title: string | null;
  description: string | null;
  file_type: LinkType;
  url: string | null;
  created_by: string;
}

interface SeedMenteeSubmission {
  id: string;
  mentee_assignment_id: string;
  slot_id: string;
  file_id: string;
  version_number: number;
  status: SubmissionStatus;
  feedback: string | null;
  reviewed_by: string | null;
}

interface SeedMeetingSeries {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  recurrence: RecurrenceType;
  recurrence_until: string | null;
}

interface SeedMeeting {
  id: string;
  series_id: string | null;
  created_by: string;
  title: string;
  description: string | null;
  meet_link: string | null;
  starts_at: string;
  ends_at: string;
  status: MeetingStatus;
  notes: string | null;
}

interface SeedMeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  status: MeetingParticipantStatus;
  responded_at: string | null;
}

interface SeedExitSurvey {
  id: string;
  meeting_id: string;
  user_id: string;
  response: Record<string, unknown>;
}

interface SeedResourceOrCourse {
  id: string;
  type: ResourceCourseType | null;
  title: string;
  description: string | null;
  links: string[] | null;
  status: ResourceStatus;
  week_number: number | null;
  created_by: string;
  assigned_to: string | null;
}

interface SeedResourceUpdate {
  id: string;
  resource_id: string;
  mentee_id: string;
  progress_note: string;
  progress_percent: number | null;
  hours_spent: number | null;
  file_id: string | null;
}

interface SeedConversation {
  id: string;
  name: string | null;
  created_by: string;
  last_message_at: string | null;
}

interface SeedConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  can_message: boolean;
  last_read_at: string | null;
}

interface SeedMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
}

interface SeedNotification {
  id: string;
  created_by: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  mentee_assignment_id: string | null;
  exit_survey_id: string | null;
  message_id: string | null;
  meeting_id: string | null;
  scheduled_for: string | null;
}

interface SeedUserNotification {
  id: string;
  notification_id: string;
  user_id: string;
  status: NotificationDeliveryStatus;
  sent_at: string | null;
  read_at: string | null;
}

interface SeedData {
  users: SeedUser[];
  cohorts: SeedCohort[];
  pods: SeedPod[];
  pod_members: SeedPodMember[];
  assignments: SeedAssignment[];
  assignment_submission_slots: SeedAssignmentSubmissionSlot[];
  mentee_assignments: SeedMenteeAssignment[];
  files: SeedFile[];
  mentee_submissions: SeedMenteeSubmission[];
  meeting_series: SeedMeetingSeries[];
  meetings: SeedMeeting[];
  meeting_participants: SeedMeetingParticipant[];
  exit_surveys: SeedExitSurvey[];
  resources_and_courses: SeedResourceOrCourse[];
  resource_updates: SeedResourceUpdate[];
  conversations: SeedConversation[];
  conversation_participants: SeedConversationParticipant[];
  messages: SeedMessage[];
  notifications: SeedNotification[];
  user_notifications: SeedUserNotification[];
}

// A row that is guaranteed to carry an `id` field - the only thing our
// generic upsert/remap helpers need to know about.
interface HasId {
  id: string;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const SUPABASE_URL: string | undefined =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY: string | undefined =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_PASSWORD = "SeedPassword123!";

// seed id -> real auth id
const idMap = new Map<string, string>();

function mapId(id: string): string;
function mapId(id: string | null): string | null;
function mapId(id: string | null | undefined): string | null | undefined;
function mapId(id: string | null | undefined): string | null | undefined {
  if (id === null || id === undefined) return id;
  return idMap.get(id) ?? id;
}

/**
 * Remap every field listed in `fields` on `row` through idMap, returning a
 * shallow copy. `fields` must name keys of `T` whose value type is
 * `string | null` (or `string`) so the remap is type-safe end to end.
 */
function remap<T extends HasId, K extends keyof T>(row: T, fields: K[]): T {
  const copy: T = { ...row };
  for (const field of fields) {
    const value = copy[field] as unknown as string | null;
    copy[field] = mapId(value) as unknown as T[K];
  }
  return copy;
}

async function upsert<T extends HasId>(
  table: string,
  rows: T[],
  label?: string
): Promise<void> {
  if (!rows || rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) {
    console.error(`  ✗ ${label ?? table} failed:`, error.message);
    throw error;
  }
  console.log(`  ✓ ${label ?? table}: ${rows.length} rows`);
}

// ---------------------------------------------------------------------------
// Step 1: auth users -> public.users
// ---------------------------------------------------------------------------

interface PublicUserRow {
  id: string;
  role: UserRole;
  bio: string | null;
  background_notes: string | null;
  goals: string[] | null;
  interests: string[] | null;
  school_or_org: string | null;
  approval_status: ApprovalStatus;
}

/** Shared by seedUsers() and seedFreshTestAccounts() — looks up an existing
 *  auth user by email, or creates one, and returns its real id. */
async function resolveOrCreateAuthUser(
  email: string,
  role: UserRole,
  emailToId: Map<string, string>
): Promise<string> {
  const existing = emailToId.get(email);
  if (existing) return existing;

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { role, seeded: true },
  });
  if (createErr) throw createErr;
  if (!created.user) {
    throw new Error(`Auth user creation returned no user for ${email}`);
  }
  emailToId.set(email, created.user.id);
  return created.user.id;
}

async function seedUsers(users: SeedUser[]): Promise<Map<string, string>> {
  console.log("Seeding auth users + public.users...");

  const { data: existingList, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) throw listErr;

  const emailToId = new Map<string, string>();
  for (const authUser of existingList.users) {
    if (authUser.email) emailToId.set(authUser.email, authUser.id);
  }

  for (const seedUser of users) {
    const realId = await resolveOrCreateAuthUser(seedUser.email, seedUser.role, emailToId);
    idMap.set(seedUser.id, realId);
  }

  const publicUsersRows: PublicUserRow[] = users.map((u) => ({
    id: mapId(u.id),
    role: u.role,
    bio: u.bio,
    background_notes: u.background_notes,
    goals: u.goals,
    interests: u.interests,
    school_or_org: u.school_or_org,
    approval_status: u.approval_status,
  }));

  await upsert<PublicUserRow>("users", publicUsersRows, "public.users");

  return emailToId;
}

// ---------------------------------------------------------------------------
// Fresh test accounts — fixed emails/passwords, always available regardless
// of seeddata.json's contents. One mentor + one mentee + one pod containing
// both, in a dedicated "Test Cohort" so they don't get mixed into whatever
// pods your real seed data sets up.
// ---------------------------------------------------------------------------

const FRESH_TEST_ACCOUNTS = {
  cohortId: "00000000-0000-0000-0000-000000000f01",
  podId: "00000000-0000-0000-0000-000000000f02",
  mentor: {
    id: "00000000-0000-0000-0000-000000000f03",
    email: "test.mentor@nazariacollective.in",
    password: "TestMentor123!",
  },
  mentee: {
    id: "00000000-0000-0000-0000-000000000f04",
    email: "test.mentee@nazariacollective.in",
    password: "TestMentee123!",
  },
} as const;

async function seedFreshTestAccounts(emailToId: Map<string, string>): Promise<void> {
  console.log("Seeding fresh test accounts (mentor + mentee + pod)...");

  // Auth users — created directly with their own fixed passwords rather than
  // DEFAULT_PASSWORD, so they're easy to remember and distinct from the bulk
  // seed accounts.
  async function resolveOrCreateWithOwnPassword(
    email: string,
    password: string,
    role: UserRole
  ): Promise<string> {
    const existing = emailToId.get(email);
    if (existing) return existing;

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, seeded: true, freshTestAccount: true },
    });
    if (createErr) throw createErr;
    if (!created.user) throw new Error(`Auth user creation returned no user for ${email}`);
    emailToId.set(email, created.user.id);
    return created.user.id;
  }

  const mentorAuthId = await resolveOrCreateWithOwnPassword(
    FRESH_TEST_ACCOUNTS.mentor.email,
    FRESH_TEST_ACCOUNTS.mentor.password,
    "mentor"
  );
  const menteeAuthId = await resolveOrCreateWithOwnPassword(
    FRESH_TEST_ACCOUNTS.mentee.email,
    FRESH_TEST_ACCOUNTS.mentee.password,
    "mentee"
  );

  await upsert<PublicUserRow>(
    "users",
    [
      {
        id: mentorAuthId,
        role: "mentor",
        bio: "Fresh test mentor account.",
        background_notes: null,
        goals: null,
        interests: null,
        school_or_org: null,
        approval_status: "approved",
      },
      {
        id: menteeAuthId,
        role: "mentee",
        bio: "Fresh test mentee account.",
        background_notes: null,
        goals: null,
        interests: null,
        school_or_org: null,
        approval_status: "approved",
      },
    ],
    "fresh test users"
  );

  await upsert<SeedCohort>(
    "cohorts",
    [
      {
        id: FRESH_TEST_ACCOUNTS.cohortId,
        name: "Test Cohort (fresh accounts)",
        start_date: null,
        end_date: null,
        status: "active",
        description: "Reserved cohort for the fixed fresh-account mentor/mentee used in manual testing.",
      },
    ],
    "test cohort"
  );

  await upsert<SeedPod>(
    "pods",
    [
      {
        id: FRESH_TEST_ACCOUNTS.podId,
        cohort_id: FRESH_TEST_ACCOUNTS.cohortId,
        name: "Test Pod (fresh accounts)",
        skill_level: null,
        description: "Reserved pod for the fixed fresh-account mentor/mentee used in manual testing.",
      },
    ],
    "test pod"
  );

  await upsert<{ id: string; pod_id: string; user_id: string }>(
    "pod_members",
    [
      { id: "00000000-0000-0000-0000-000000000f05", pod_id: FRESH_TEST_ACCOUNTS.podId, user_id: mentorAuthId },
      { id: "00000000-0000-0000-0000-000000000f06", pod_id: FRESH_TEST_ACCOUNTS.podId, user_id: menteeAuthId },
    ],
    "test pod_members"
  );

  console.log("  ✓ Fresh test accounts ready:");
  console.log(`      mentor -> ${FRESH_TEST_ACCOUNTS.mentor.email} / ${FRESH_TEST_ACCOUNTS.mentor.password}`);
  console.log(`      mentee -> ${FRESH_TEST_ACCOUNTS.mentee.email} / ${FRESH_TEST_ACCOUNTS.mentee.password}`);
}

// ---------------------------------------------------------------------------
// Steps 19-20: notifications + user_notifications, fanout DERIVED from each
// notification's real foreign key rather than trusted from seeddata.json's
// separate user_notifications array. See header comment for why.
// ---------------------------------------------------------------------------

interface RemappedSeedNotification extends Omit<SeedNotification, "scheduled_for"> {
  scheduled_for: string;
}

async function resolveRecipientsForNotification(
  notification: SeedNotification
): Promise<string[]> {
  if (notification.meeting_id) {
    const { data, error } = await supabase
      .from("meeting_participants")
      .select("user_id")
      .eq("meeting_id", notification.meeting_id);
    if (error) throw error;
    return (data ?? []).map((r) => r.user_id as string);
  }

  if (notification.mentee_assignment_id) {
    const { data, error } = await supabase
      .from("mentee_assignments")
      .select("mentee_id")
      .eq("id", notification.mentee_assignment_id)
      .maybeSingle();
    if (error) throw error;
    return data ? [data.mentee_id as string] : [];
  }

  if (notification.exit_survey_id) {
    const { data, error } = await supabase
      .from("exit_surveys")
      .select("user_id")
      .eq("id", notification.exit_survey_id)
      .maybeSingle();
    if (error) throw error;
    return data ? [data.user_id as string] : [];
  }

  if (notification.message_id) {
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("conversation_id, sender_id")
      .eq("id", notification.message_id)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!message) return [];

    const { data: participants, error: participantsError } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", message.conversation_id as string)
      .is("left_at", null)
      .neq("user_id", message.sender_id as string);
    if (participantsError) throw participantsError;
    return (participants ?? []).map((r) => r.user_id as string);
  }

  // No FK to derive recipients from (e.g. a generic "reminder" with only
  // resource_id) — fall back to whatever seeddata.json's parallel array
  // says for this specific notification id, since there's genuinely no
  // other source of truth for it.
  return [];
}

async function seedNotifications(
  notifications: SeedNotification[],
  fallbackUserNotifications: SeedUserNotification[]
): Promise<void> {
  if (!notifications || notifications.length === 0) return;

  const remapped: RemappedSeedNotification[] = notifications.map((n) => ({
    ...remap(n, ["created_by"]),
    // ALWAYS force a real timestamp — matches what createNotification() does
    // in the real app. A null here can never happen through real usage and
    // silently breaks dispatch-notifications' scheduled_for filter.
    scheduled_for: n.scheduled_for ?? new Date().toISOString(),
  }));

  await upsert<RemappedSeedNotification>("notifications", remapped, "notifications");

  const fanoutByNotificationId = new Map<string, SeedUserNotification[]>();
  for (const row of fallbackUserNotifications) {
    const list = fanoutByNotificationId.get(row.notification_id) ?? [];
    list.push(row);
    fanoutByNotificationId.set(row.notification_id, list);
  }

  const fanoutRows: SeedUserNotification[] = [];
  let derivedCount = 0;
  let fallbackCount = 0;

  for (const notification of notifications) {
    const derivedRecipients = await resolveRecipientsForNotification(notification);

    if (derivedRecipients.length > 0) {
      derivedCount += derivedRecipients.length;
      derivedRecipients.forEach((userId, index) => {
        fanoutRows.push({
          id: randomUUID(),
          notification_id: notification.id,
          user_id: mapId(userId),
          status: "pending",
          sent_at: null,
          read_at: null,
        });
      });
      continue;
    }

    // No derivable FK — use whatever seeddata.json authored for this one,
    // remapped through idMap.
    const fallback = fanoutByNotificationId.get(notification.id) ?? [];
    fallbackCount += fallback.length;
    for (const row of fallback) {
      fanoutRows.push(remap(row, ["user_id", "notification_id"]));
    }
  }

  await upsert<SeedUserNotification>("user_notifications", fanoutRows, "user_notifications");
  console.log(`    (fanout: ${derivedCount} derived from FKs, ${fallbackCount} from seeddata.json fallback)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const jsonPath = join(__dirname, "seeddata.json");
  const raw: string = readFileSync(jsonPath, "utf-8");
  const data: SeedData = JSON.parse(raw) as SeedData;

  console.log(`Loaded seeddata.json from ${jsonPath}\n`);

  // 1. Users (auth + public), builds idMap for everything below
  const emailToId = await seedUsers(data.users);

  // 2. Cohorts (no user FK to remap)
  await upsert<SeedCohort>("cohorts", data.cohorts, "cohorts");

  // 3. Pods (cohort_id is not a user id, no remap needed)
  await upsert<SeedPod>("pods", data.pods, "pods");

  // 4. Pod members (user_id needs remap)
  await upsert<SeedPodMember>(
    "pod_members",
    data.pod_members.map((r) => remap(r, ["user_id"])),
    "pod_members"
  );

  // 5. Assignments (created_by is a user)
  await upsert<SeedAssignment>(
    "assignments",
    data.assignments.map((r) => remap(r, ["created_by"])),
    "assignments"
  );

  // 6. Assignment submission slots (no user FK)
  await upsert<SeedAssignmentSubmissionSlot>(
    "assignment_submission_slots",
    data.assignment_submission_slots,
    "assignment_submission_slots"
  );

  // 7. Mentee assignments (mentee_id, assigned_by are users)
  await upsert<SeedMenteeAssignment>(
    "mentee_assignments",
    data.mentee_assignments.map((r) => remap(r, ["mentee_id", "assigned_by"])),
    "mentee_assignments"
  );

  // 8. Files (created_by is a user)
  await upsert<SeedFile>(
    "files",
    data.files.map((r) => remap(r, ["created_by"])),
    "files"
  );

  // 9. Mentee submissions (reviewed_by is a user)
  await upsert<SeedMenteeSubmission>(
    "mentee_submissions",
    data.mentee_submissions.map((r) => remap(r, ["reviewed_by"])),
    "mentee_submissions"
  );

  // 10. Meeting series (created_by is a user)
  await upsert<SeedMeetingSeries>(
    "meeting_series",
    data.meeting_series.map((r) => remap(r, ["created_by"])),
    "meeting_series"
  );

  // 11. Meetings (created_by is a user)
  await upsert<SeedMeeting>(
    "meetings",
    data.meetings.map((r) => remap(r, ["created_by"])),
    "meetings"
  );

  // 12. Meeting participants (user_id)
  await upsert<SeedMeetingParticipant>(
    "meeting_participants",
    data.meeting_participants.map((r) => remap(r, ["user_id"])),
    "meeting_participants"
  );

  // 13. Exit surveys (user_id)
  await upsert<SeedExitSurvey>(
    "exit_surveys",
    data.exit_surveys.map((r) => remap(r, ["user_id"])),
    "exit_surveys"
  );

  // 14. Resources & courses (created_by, assigned_to are users)
  await upsert<SeedResourceOrCourse>(
    "resources_and_courses",
    data.resources_and_courses.map((r) => remap(r, ["created_by", "assigned_to"])),
    "resources_and_courses"
  );

  // 15. Resource updates (mentee_id is a user)
  await upsert<SeedResourceUpdate>(
    "resource_updates",
    data.resource_updates.map((r) => remap(r, ["mentee_id"])),
    "resource_updates"
  );

  // 16. Conversations (created_by is a user)
  await upsert<SeedConversation>(
    "conversations",
    data.conversations.map((r) => remap(r, ["created_by"])),
    "conversations"
  );

  // 17. Conversation participants (user_id)
  await upsert<SeedConversationParticipant>(
    "conversation_participants",
    data.conversation_participants.map((r) => remap(r, ["user_id"])),
    "conversation_participants"
  );

  // 18. Messages (sender_id is a user)
  await upsert<SeedMessage>(
    "messages",
    data.messages.map((r) => remap(r, ["sender_id"])),
    "messages"
  );

  // 19 + 20. Notifications + user_notifications — see seedNotifications()
  // header comment for why this is no longer a plain remap+upsert pair.
  console.log("Seeding notifications (scheduled_for forced, fanout derived from FKs)...");
  await seedNotifications(
    data.notifications.map((r) => remap(r, ["created_by"])),
    data.user_notifications
  );

  // 21. Fresh, fixed-credential test accounts — independent of seeddata.json.
  await seedFreshTestAccounts(emailToId);

  console.log("\n✅ Seeding complete.");
  console.log(`   Bulk seed user password: ${DEFAULT_PASSWORD}`);
  console.log(`   Fresh mentor: ${FRESH_TEST_ACCOUNTS.mentor.email} / ${FRESH_TEST_ACCOUNTS.mentor.password}`);
  console.log(`   Fresh mentee: ${FRESH_TEST_ACCOUNTS.mentee.email} / ${FRESH_TEST_ACCOUNTS.mentee.password}`);
}

main().catch((err: unknown) => {
  console.error("\n❌ Seeding failed:", err);
  process.exit(1);
});