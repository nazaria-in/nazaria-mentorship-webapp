// /lib/api/messages.ts

import { createClient } from "@/lib/supabase/client";
import type {
  Conversation,
  ConversationOversight,
  ConversationParticipant,
  ConversationSummary,
  ComposerDisabledState,
  Message,
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
): Promise<(ConversationParticipant & { full_name: string | null; school_or_org: string | null })[]> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("*, users!conversation_participants_user_id_fkey(full_name, school_or_org)")
    .eq("conversation_id", conversationId)
    .is("left_at", null);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const joined = row as ConversationParticipant & {
      users: { full_name: string | null; school_or_org: string | null } | null;
    };
    return {
      ...joined,
      full_name: joined.users?.full_name ?? null,
      school_or_org: joined.users?.school_or_org ?? null,
    };
  });
}

const MESSAGES_PAGE_SIZE = 40;

export async function fetchMessages(
  conversationId: string,
  cursor?: string
): Promise<Message[]> {
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

// ============================================================
// Mutations
// ============================================================

export async function sendMessage(conversationId: string, body: string): Promise<Message> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not authenticated.");

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: userData.user.id, body })
    .select("*")
    .single();
  if (error) throw error;
  return data as Message;
}

export async function forwardMessage(
  original: Message,
  targetConversationIds: string[]
): Promise<void> {
  const senderLabel = original.senderName ?? "someone";
  const forwardedBody = `Forwarded from ${senderLabel}: ${original.body}`;
  await Promise.all(targetConversationIds.map((id) => sendMessage(id, forwardedBody)));
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
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

export async function createConversation(
  participantIds: string[],
  name?: string
): Promise<Conversation> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not authenticated.");

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({ kind: "direct", created_by: userData.user.id, name: name ?? null })
    .select("*")
    .single();
  if (conversationError) throw conversationError;

  const allParticipantIds = Array.from(new Set([...participantIds, userData.user.id]));
  const { error: participantsError } = await supabase.from("conversation_participants").insert(
    allParticipantIds.map((userId) => ({
      conversation_id: conversation.id as string,
      user_id: userId,
      can_message: true,
    }))
  );
  if (participantsError) throw participantsError;

  return conversation as Conversation;
}

/** Staff explicitly joining a conversation they weren't already part of. See plan §10. */
export async function enterConversationAsStaff(conversationId: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not authenticated.");

  const { error } = await supabase.from("conversation_participants").upsert(
    {
      conversation_id: conversationId,
      user_id: userData.user.id,
      can_message: true,
      left_at: null,
    },
    { onConflict: "conversation_id,user_id" }
  );
  if (error) throw error;
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

/** Call from the admin-approval action whenever a pm/associate row flips to approved. */
export async function grantStaffAllBroadcastAccess(userId: string): Promise<void> {
  const { data: broadcasts, error: broadcastsError } = await supabase
    .from("conversations")
    .select("id")
    .eq("kind", "broadcast");
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
// Client-side name resolution (plan §3)
// ============================================================

interface NameResolutionInput {
  name: string | null;
  kind: "direct" | "pod" | "broadcast";
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
// Composer disabled-state copy (plan §7)
// ============================================================

interface ComposerStateInput {
  canMessage: boolean;
  kind: "direct" | "pod" | "broadcast";
  leftAt: string | null;
  isStaff: boolean;
  isActiveParticipant: boolean;
}

export function getComposerDisabledState(input: ComposerStateInput): ComposerDisabledState {
  if (input.isStaff && !input.isActiveParticipant) {
    // Replaced entirely by EnterConversationBanner in the UI — no copy needed here.
    return { disabled: true, reason: null };
  }
  if (input.leftAt) {
    return { disabled: true, reason: "You're no longer part of this conversation." };
  }
  if (!input.canMessage) {
    return input.kind === "broadcast"
      ? {
          disabled: true,
          reason: "This is an announcement channel — only program staff can post here.",
        }
      : { disabled: true, reason: "You don't have permission to send messages in this conversation." };
  }
  return { disabled: false, reason: null };
}