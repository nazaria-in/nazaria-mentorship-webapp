// scripts/seed/chatSeeder.ts
/**
 * Seeds a DM, a pod conversation, and a broadcast conversation involving
 * two known users, each with a short back-and-forth of messages.
 *
 * Idempotent: safe to run more than once. Each conversation is looked up
 * before it's created — a pod can only ever have one conversation
 * (conversations_pod_unique), so re-running this reuses the existing pod
 * conversation instead of colliding with it. Same treatment for the DM
 * (matched by exact 2-person participant set) and the broadcast (matched
 * by name). Messages are only added the first time a conversation is
 * created, not on every rerun.
 *
 * Users seeded:
 *   Brian Allen         fcb3947e-46f7-41ed-a2ba-006f1d4599e9
 *   Joseph Kakkassery   16a4b42e-40d2-4812-89dc-bb12926f5f5c
 *
 * Run with:
 *   npx tsx scripts/seed/chatSeeder.ts
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";

type ConversationInsert = Database["public"]["Tables"]["conversations"]["Insert"];
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type ConversationParticipantInsert =
  Database["public"]["Tables"]["conversation_participants"]["Insert"];
type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type CohortInsert = Database["public"]["Tables"]["cohorts"]["Insert"];
type CohortRow = Database["public"]["Tables"]["cohorts"]["Row"];
type PodInsert = Database["public"]["Tables"]["pods"]["Insert"];
type PodRow = Database["public"]["Tables"]["pods"]["Row"];
type PodMemberInsert = Database["public"]["Tables"]["pod_members"]["Insert"];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment."
  );
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BRIAN_ALLEN_ID = "fcb3947e-46f7-41ed-a2ba-006f1d4599e9";
const JOSEPH_KAKKASSERY_ID = "16a4b42e-40d2-4812-89dc-bb12926f5f5c";

/** Minutes-ago helper so message timestamps read as a believable, ordered thread. */
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

async function findOrCreateCohort(): Promise<CohortRow> {
  const { data: existing, error: findError } = await supabase
    .from("cohorts")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing;

  const cohortPayload: CohortInsert = {
    name: "Seed Cohort — Mentorship Pilot",
    status: "active",
    description: "Auto-created by seed-conversations.ts because no active cohort existed.",
  };

  const { data: created, error: createError } = await supabase
    .from("cohorts")
    .insert(cohortPayload)
    .select("*")
    .single();

  if (createError) throw createError;
  return created;
}

async function findOrCreatePod(cohortId: string): Promise<PodRow> {
  const { data: existing, error: findError } = await supabase
    .from("pods")
    .select("*")
    .eq("cohort_id", cohortId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing;

  const podPayload: PodInsert = {
    cohort_id: cohortId,
    name: "Seed Pod — Story Circle",
    skill_level: "beginner",
    description: "Auto-created by seed-conversations.ts.",
  };

  const { data: created, error: createError } = await supabase
    .from("pods")
    .insert(podPayload)
    .select("*")
    .single();

  if (createError) throw createError;
  return created;
}

async function ensurePodMembers(podId: string, userIds: string[]): Promise<void> {
  const { data: existingMembers, error: findError } = await supabase
    .from("pod_members")
    .select("user_id")
    .eq("pod_id", podId)
    .in("user_id", userIds);

  if (findError) throw findError;

  const existingIds = new Set((existingMembers ?? []).map((m) => m.user_id));
  const missing = userIds.filter((id) => !existingIds.has(id));
  if (missing.length === 0) return;

  const payload: PodMemberInsert[] = missing.map((userId) => ({
    pod_id: podId,
    user_id: userId,
  }));

  const { error: insertError } = await supabase.from("pod_members").insert(payload);
  if (insertError) throw insertError;
}

async function createConversation(payload: ConversationInsert): Promise<ConversationRow> {
  const { data, error } = await supabase
    .from("conversations")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/** A pod can only ever have one conversation (conversations_pod_unique). Reuse it if present. */
async function findExistingPodConversation(podId: string): Promise<ConversationRow | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("pod_id", podId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Matches a direct conversation whose participant set is exactly { userA, userB }. */
async function findExistingDirectConversation(
  userAId: string,
  userBId: string
): Promise<ConversationRow | null> {
  const { data: userAMemberships, error: membershipError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userAId);

  if (membershipError) throw membershipError;
  if (!userAMemberships || userAMemberships.length === 0) return null;

  const candidateConversationIds = userAMemberships.map((m) => m.conversation_id);

  const { data: candidateConversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("*")
    .eq("kind", "direct")
    .in("id", candidateConversationIds);

  if (conversationsError) throw conversationsError;
  if (!candidateConversations || candidateConversations.length === 0) return null;

  for (const conversation of candidateConversations) {
    const { data: participants, error: participantsError } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversation.id);

    if (participantsError) throw participantsError;

    const participantIds = new Set((participants ?? []).map((p) => p.user_id));
    const isExactPair =
      participantIds.size === 2 && participantIds.has(userAId) && participantIds.has(userBId);

    if (isExactPair) return conversation;
  }

  return null;
}

/** Matches a broadcast conversation by name, since there's no natural key for it otherwise. */
async function findExistingBroadcastConversation(name: string): Promise<ConversationRow | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("kind", "broadcast")
    .eq("name", name)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function addParticipants(
  conversationId: string,
  userIds: string[]
): Promise<void> {
  const payload: ConversationParticipantInsert[] = userIds.map((userId) => ({
    conversation_id: conversationId,
    user_id: userId,
    can_message: true,
  }));

  const { error } = await supabase.from("conversation_participants").insert(payload);
  if (error) throw error;
}

async function addParticipantsIfMissing(
  conversationId: string,
  userIds: string[]
): Promise<void> {
  const { data: existingParticipants, error: findError } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .in("user_id", userIds);

  if (findError) throw findError;

  const existingIds = new Set((existingParticipants ?? []).map((p) => p.user_id));
  const missing = userIds.filter((id) => !existingIds.has(id));
  if (missing.length === 0) return;

  await addParticipants(conversationId, missing);
}

async function addMessages(
  conversationId: string,
  entries: { senderId: string; body: string; minutesAgoValue: number }[]
): Promise<MessageRow[]> {
  const payload: MessageInsert[] = entries.map((entry) => ({
    conversation_id: conversationId,
    sender_id: entry.senderId,
    body: entry.body,
    created_at: minutesAgo(entry.minutesAgoValue),
  }));

  const { data, error } = await supabase.from("messages").insert(payload).select("*");
  if (error) throw error;
  return data ?? [];
}

async function bumpLastMessageAt(conversationId: string, messages: MessageRow[]): Promise<void> {
  const latest = messages.reduce<string | null>((latestSoFar, message) => {
    if (!latestSoFar) return message.created_at;
    return message.created_at > latestSoFar ? message.created_at : latestSoFar;
  }, null);

  if (!latest) return;

  const { error } = await supabase
    .from("conversations")
    .update({ last_message_at: latest })
    .eq("id", conversationId);

  if (error) throw error;
}

async function seedDirectConversation(): Promise<void> {
  const existing = await findExistingDirectConversation(BRIAN_ALLEN_ID, JOSEPH_KAKKASSERY_ID);
  if (existing) {
    console.log(`Direct conversation already exists (${existing.id}), skipping.`);
    return;
  }

  const conversation = await createConversation({
    kind: "direct",
    created_by: BRIAN_ALLEN_ID,
  });

  await addParticipants(conversation.id, [BRIAN_ALLEN_ID, JOSEPH_KAKKASSERY_ID]);

  const messages = await addMessages(conversation.id, [
    {
      senderId: BRIAN_ALLEN_ID,
      body: "Hey Joseph! Saw you just got added to the pod — welcome aboard 🎉",
      minutesAgoValue: 180,
    },
    {
      senderId: JOSEPH_KAKKASSERY_ID,
      body: "Thanks Brian! Excited to get going, still finding my way around the dashboard though.",
      minutesAgoValue: 175,
    },
    {
      senderId: BRIAN_ALLEN_ID,
      body: "No worries at all, happy to help. Have you looked at this week's assignment yet?",
      minutesAgoValue: 170,
    },
    {
      senderId: JOSEPH_KAKKASSERY_ID,
      body: "Not yet, pulling it up now.",
      minutesAgoValue: 45,
    },
    {
      senderId: BRIAN_ALLEN_ID,
      body: "Sounds good, ping me if anything's unclear — I'm usually around in the evenings.",
      minutesAgoValue: 30,
    },
  ]);

  await bumpLastMessageAt(conversation.id, messages);
  console.log(`Seeded direct conversation ${conversation.id} with ${messages.length} messages.`);
}

async function seedPodConversation(): Promise<void> {
  const cohort = await findOrCreateCohort();
  const pod = await findOrCreatePod(cohort.id);
  await ensurePodMembers(pod.id, [BRIAN_ALLEN_ID, JOSEPH_KAKKASSERY_ID]);

  const existing = await findExistingPodConversation(pod.id);
  if (existing) {
    console.log(`Pod conversation already exists (${existing.id}), ensuring participants only.`);
    await addParticipantsIfMissing(existing.id, [BRIAN_ALLEN_ID, JOSEPH_KAKKASSERY_ID]);
    return;
  }

  const conversation = await createConversation({
    kind: "pod",
    name: pod.name,
    pod_id: pod.id,
    cohort_id: cohort.id,
    created_by: BRIAN_ALLEN_ID,
  });

  await addParticipants(conversation.id, [BRIAN_ALLEN_ID, JOSEPH_KAKKASSERY_ID]);

  const messages = await addMessages(conversation.id, [
    {
      senderId: BRIAN_ALLEN_ID,
      body: "Hey team, kicking off our pod chat here — share progress, ask questions, or just say hi 👋",
      minutesAgoValue: 1440,
    },
    {
      senderId: JOSEPH_KAKKASSERY_ID,
      body: "Hi everyone, looking forward to working with this pod!",
      minutesAgoValue: 1400,
    },
    {
      senderId: BRIAN_ALLEN_ID,
      body: "Reminder: this week's submission slot closes Friday, don't wait till the last minute.",
      minutesAgoValue: 600,
    },
    {
      senderId: JOSEPH_KAKKASSERY_ID,
      body: "Got it, will submit by Thursday.",
      minutesAgoValue: 590,
    },
  ]);

  await bumpLastMessageAt(conversation.id, messages);
  console.log(`Seeded pod conversation ${conversation.id} with ${messages.length} messages.`);
}

async function seedBroadcastConversation(): Promise<void> {
  const broadcastName = "Cohort Announcements";
  const existing = await findExistingBroadcastConversation(broadcastName);
  if (existing) {
    console.log(`Broadcast conversation already exists (${existing.id}), ensuring participants only.`);
    await addParticipantsIfMissing(existing.id, [BRIAN_ALLEN_ID, JOSEPH_KAKKASSERY_ID]);
    return;
  }

  const conversation = await createConversation({
    kind: "broadcast",
    name: broadcastName,
    audience: "everyone",
    created_by: BRIAN_ALLEN_ID,
  });

  await addParticipants(conversation.id, [BRIAN_ALLEN_ID, JOSEPH_KAKKASSERY_ID]);

  const messages = await addMessages(conversation.id, [
    {
      senderId: BRIAN_ALLEN_ID,
      body: "📢 Cohort-wide update: next live session moved to Saturday 5 PM IST, calendar invites going out shortly.",
      minutesAgoValue: 2880,
    },
    {
      senderId: BRIAN_ALLEN_ID,
      body: "Also — the resource library has 3 new toolkits added this week, check the Resources tab!",
      minutesAgoValue: 1440,
    },
  ]);

  await bumpLastMessageAt(conversation.id, messages);
  console.log(
    `Seeded broadcast conversation ${conversation.id} with ${messages.length} messages.`
  );
}

async function main(): Promise<void> {
  await seedDirectConversation();
  await seedPodConversation();
  await seedBroadcastConversation();
  console.log("Done seeding conversations.");
}

main().catch((error: unknown) => {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
});