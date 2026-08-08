// /lib/api/messages.ts

import { createClient } from "@/lib/supabase/client";
import { notifyNewMessage } from "@/lib/notifications/message-notifications";
import type {
  Conversation,
  ConversationOversight,
  ConversationParticipant,
  ConversationSummary,
  ComposerDisabledState,
  Message,
  CreateConversationInput,
} from "@/types/messages";

const supabase = createClient();

// ============================================================
// Fetching
// ============================================================

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("v_conversation_summary")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as ConversationSummary[];
}

export async function fetchOversightConversations(): Promise<ConversationOversight[]> {
  const { data, error } = await supabase
    .from("v_conversation_oversight")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as ConversationOversight[];
}

export async function fetchConversationParticipants(
  conversationId: string
): Promise<(ConversationParticipant & { full_name: string | null; school_or_org: string | null; role: string | null })[]> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("*, users!conversation_participants_user_id_fkey(full_name, school_or_org, role)")
    .eq("conversation_id", conversationId)
    .is("left_at", null);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const joined = row as ConversationParticipant & {
      users: { full_name: string | null; school_or_org: string | null; role: string | null } | null;
    };
    return {
      ...joined,
      full_name: joined.users?.full_name ?? null,
      school_or_org: joined.users?.school_or_org ?? null,
      role: joined.users?.role ?? null,
    };
  });
}

const MESSAGES_PAGE_SIZE = 40;

export async function fetchMessages(conversationId: string, cursor?: string): Promise<Message[]> {
  let query = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(MESSAGES_PAGE_SIZE);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Redaction fallback: fetchMessages hits the base table (RLS grants row
  // access to any active participant, including for deleted rows, since
  // RLS is row-level not column-level). Redact body here until/unless a
  // dedicated non-oversight message view exists server-side. Oversight
  // callers should use fetchMessagesForOversight() instead, which skips this.
  return ((data ?? []) as Message[])
    .reverse()
    .map((m) => (m.deleted_at ? { ...m, body: "" } : m));
}

/** Staff-only. Returns full, unredacted bodies for deleted messages (audit view). */
export async function fetchMessagesForOversight(conversationId: string, cursor?: string): Promise<Message[]> {
  let query = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(MESSAGES_PAGE_SIZE);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Message[]).reverse();
}

export async function searchConversationMessages(conversationId: string, queryText: string): Promise<Message[]> {
  const trimmed = queryText.trim();
  if (!trimmed) return [];
  const { data, error } = await supabase.rpc("search_conversation_messages", {
    p_conversation_id: conversationId,
    p_query: trimmed,
  });
  if (error) throw error;
  return (data ?? []) as Message[];
}

// ============================================================
// Mutations
// ============================================================

interface ConversationForNotificationRow {
  kind: "direct" | "pod" | "group" | "broadcast";
  name: string | null;
}

interface OtherParticipantNameRow {
  users: { full_name: string | null } | null;
}

async function resolveConversationTitleForNotification(conversationId: string, senderId: string): Promise<string> {
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("kind, name")
    .eq("id", conversationId)
    .single();
  if (conversationError) throw conversationError;

  const typedConversation = conversation as ConversationForNotificationRow;
  if (typedConversation.name) return typedConversation.name;
  if (typedConversation.kind !== "direct") return "Conversation";

  const { data: otherParticipants, error: otherParticipantsError } = await supabase
    .from("conversation_participants")
    .select("users!conversation_participants_user_id_fkey(full_name)")
    .eq("conversation_id", conversationId)
    .is("left_at", null)
    .neq("user_id", senderId);
  if (otherParticipantsError) throw otherParticipantsError;

  const names = ((otherParticipants ?? []) as unknown as OtherParticipantNameRow[])
    .map((row) => row.users?.full_name?.trim())
    .filter((name): name is string => Boolean(name));

  return names[0] ?? "Direct message";
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
  clientGeneratedId: string;
  replyToMessageId?: string | null;
}

export async function sendMessage(input: SendMessageInput): Promise<Message> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not authenticated.");

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: userData.user.id,
      body: input.body,
      client_generated_id: input.clientGeneratedId,
      reply_to_message_id: input.replyToMessageId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  const message = data as Message;

  try {
    const [{ data: senderProfile, error: senderProfileError }, conversationTitle] = await Promise.all([
      supabase.from("users").select("full_name").eq("id", userData.user.id).single(),
      resolveConversationTitleForNotification(input.conversationId, userData.user.id),
    ]);
    if (senderProfileError) throw senderProfileError;

    await notifyNewMessage(supabase, {
      messageId: message.id,
      conversationId: input.conversationId,
      conversationTitle,
      senderId: userData.user.id,
      senderName: (senderProfile?.full_name as string | null)?.trim() || "Someone",
      body: input.body,
    });
  } catch (notificationError) {
    console.error("[messages] Failed to notify participants of new message", notificationError, {
      messageId: message.id,
      conversationId: input.conversationId,
    });
  }

  return message;
}

/** Real forward: new row per target, tagged via forwarded_from_message_id — no string concatenation. */
export async function forwardMessage(original: Message, targetConversationIds: string[]): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not authenticated.");

  const rows = targetConversationIds.map((conversationId) => ({
    conversation_id: conversationId,
    sender_id: userData.user!.id,
    body: original.body,
    forwarded_from_message_id: original.id,
  }));

  const { error } = await supabase.from("messages").insert(rows);
  if (error) throw error;
}

/** Delete-for-everyone. Sender can delete their own; associate/pm can delete anyone's (RLS-enforced). */
export async function deleteMessage(messageId: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not authenticated.");

  const { error } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userData.user.id })
    .eq("id", messageId);
  if (error) throw error;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not authenticated.");

  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userData.user.id);
  if (error) throw error;
}

export async function createConversation(input: CreateConversationInput): Promise<Conversation> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not authenticated.");

  if (input.kind === "team" && !input.podId) {
    throw new Error("teamId is required for team conversations.");
  }
  if (input.kind === "broadcast" && (!input.cohortId || !input.audience)) {
    throw new Error("cohortId and audience are required for broadcast conversations.");
  }
  if (input.kind !== "direct" && !input.name.trim()) {
    throw new Error("Conversation name is required.");
  }

  const insertPayload = {
    kind: input.kind,
    created_by: userData.user.id,
    name: input.name.trim() || null,
    description: input.description?.trim() || null,
    pod_id: input.kind === "team" ? input.podId : null,
    cohort_id: input.kind === "broadcast" ? input.cohortId : null,
    audience: input.kind === "broadcast" ? input.audience : null,
  };

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert(insertPayload)
    .select("*")
    .single();

  if (conversationError) {
    console.error("[createConversation] insert failed", {
      code: conversationError.code,
      message: conversationError.message,
      details: conversationError.details,
      hint: conversationError.hint,
      payload: insertPayload,
    });
    throw conversationError;
  }

  const participantMap = new Map<string, boolean>(input.participants.map((p) => [p.userId, p.canMessage]));
  participantMap.set(userData.user.id, true);

  const participantRows = Array.from(participantMap.entries()).map(([userId, canMessage]) => ({
    conversation_id: conversation.id as string,
    user_id: userId,
    can_message: canMessage,
    added_by: userId === userData.user!.id ? null : userData.user!.id,
  }));

  const { error: participantsError } = await supabase.from("conversation_participants").insert(participantRows);

  if (participantsError) {
    console.error("[createConversation] participants insert failed", {
      code: participantsError.code,
      message: participantsError.message,
      details: participantsError.details,
      hint: participantsError.hint,
      participantRows,
    });
    throw participantsError;
  }

  return conversation as Conversation;
}

export async function addParticipant(conversationId: string, userId: string, canMessage: boolean): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not authenticated.");

  const { error } = await supabase.from("conversation_participants").upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      can_message: canMessage,
      left_at: null,
      added_by: userData.user.id,
    },
    { onConflict: "conversation_id,user_id" }
  );
  if (error) throw error;
}

export async function removeParticipant(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("conversation_participants")
    .update({ left_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateParticipantPermission(
  conversationId: string,
  userId: string,
  canMessage: boolean
): Promise<void> {
  const { error } = await supabase
    .from("conversation_participants")
    .update({ can_message: canMessage })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Atomic staff join. Wraps the enter_conversation_and_send() RPC — with no
 * body, this just adds the participant row. Use sendMessageAsNewStaffParticipant
 * when the join is triggered by a first send instead.
 */
export async function enterConversationAsStaff(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc("enter_conversation_and_send", {
    p_conversation_id: conversationId,
    p_body: null,
    p_client_generated_id: null,
  });
  if (error) throw error;
}

/** Atomic join-and-send in one transaction — see migration §8. */
export async function sendMessageAsNewStaffParticipant(
  conversationId: string,
  body: string,
  clientGeneratedId: string
): Promise<Message> {
  const { data, error } = await supabase.rpc("enter_conversation_and_send", {
    p_conversation_id: conversationId,
    p_body: body,
    p_client_generated_id: clientGeneratedId,
  });
  if (error) throw error;
  return data as Message;
}

export async function leaveConversation(conversationId: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not authenticated.");

  const { error } = await supabase
    .from("conversation_participants")
    .update({ left_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userData.user.id);
  if (error) throw error;
}

export async function grantStaffAllBroadcastAccess(userId: string): Promise<void> {
  const { data: broadcasts, error: broadcastsError } = await supabase.from("conversations").select("id").eq("kind", "broadcast");
  if (broadcastsError) throw broadcastsError;
  if (!broadcasts?.length) return;

  const { error } = await supabase.from("conversation_participants").upsert(
    broadcasts.map((b) => ({
      conversation_id: b.id as string,
      user_id: userId,
      can_message: true,
    })),
    { onConflict: "conversation_id,user_id" }
  );
  if (error) throw error;
}

// ============================================================
// Client-side name resolution
// ============================================================

interface NameResolutionInput {
  name: string | null;
  kind: "direct" | "pod" | "group" | "broadcast";
  otherParticipantNames: string[] | null;
}

export function resolveConversationName(input: NameResolutionInput): string {
  if (input.name) return input.name;

  if (input.kind === "direct") {
    const others = input.otherParticipantNames ?? [];
    if (others.length <= 1) {
      return others[0] ?? "Unnamed member";
    }
    const [first, second, ...rest] = others;
    if (rest.length === 0) {
      return `${first} & ${second}`;
    }
    return `${first}, ${second} & ${rest.length} others`;
  }

  return "Conversation";
}

// ============================================================
// Composer disabled-state copy
// ============================================================

interface ComposerStateInput {
  canMessage: boolean;
  kind: "direct" | "pod" | "group" | "broadcast";
  leftAt: string | null;
  isStaff: boolean;
  isActiveParticipant: boolean;
}

export function getComposerDisabledState(input: ComposerStateInput): ComposerDisabledState {
  if (input.isStaff && !input.isActiveParticipant) {
    // Replaced by the join-by-sending composer state in the UI — no static reason needed.
    return { disabled: false, reason: null };
  }
  if (input.leftAt) {
    return { disabled: true, reason: "You're no longer part of this conversation." };
  }
  if (!input.canMessage) {
    return input.kind === "broadcast"
      ? { disabled: true, reason: "This is an announcement channel — only program staff can post here." }
      : { disabled: true, reason: "You don't have permission to send messages in this conversation." };
  }
  return { disabled: false, reason: null };
}