// /types/messages.ts

export type ConversationKind = "direct" | "team" | "group" | "broadcast";

export type BroadcastAudience = string;

export interface Conversation {
  id: string;
  name: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string | null;
  kind: ConversationKind;
  pod_id: string | null;
  cohort_id: string | null;
  audience: BroadcastAudience | null;
}

export interface ConversationSummary {
  conversation_id: string;
  kind: ConversationKind;
  name: string | null;
  description: string | null;
  pod_id: string | null;
  cohort_id: string | null;
  audience: BroadcastAudience | null;
  last_message_at: string | null;
  my_can_message: boolean;
  my_last_read_at: string | null;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  last_message_created_at: string | null;
  last_message_deleted_at: string | null;
  unread_count: number;
  other_participant_names: string[] | null;
  /** Resolved client-side in resolveConversationName(); not a DB column. */
  resolved_name?: string;
}

export interface ConversationOversight {
  conversation_id: string;
  kind: ConversationKind;
  name: string | null;
  description: string | null;
  pod_id: string | null;
  cohort_id: string | null;
  audience: BroadcastAudience | null;
  last_message_at: string | null;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  last_message_created_at: string | null;
  last_message_deleted_at: string | null;
  last_message_deleted_by: string | null;
  i_am_active_participant: boolean;
  /** Resolved client-side; not a DB column. */
  resolved_name?: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  can_message: boolean;
  joined_at: string;
  last_read_at: string | null;
  left_at: string | null;
  added_by: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  client_generated_id: string | null;
  reply_to_message_id: string | null;
  forwarded_from_message_id: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  /** Populated client-side when the sender's profile is joined in. */
  senderName?: string;
}

/** Client-only. Never persisted — tracks optimistic send state per client_generated_id. */
export type PendingMessageStatus = "sending" | "sent" | "failed";

export interface PendingMessage extends Message {
  status: PendingMessageStatus;
}

export type ConversationListFilter = "all" | "unread" | "teams" | "groups" | "broadcasts" | "direct";

export interface ComposerDisabledState {
  disabled: boolean;
  reason: string | null;
}

export interface CreateConversationParticipantInput {
  userId: string;
  canMessage: boolean;
}

export interface CreateConversationInput {
  name: string;
  description?: string;
  kind: ConversationKind;
  podId?: string;
  cohortId?: string;
  audience?: BroadcastAudience;
  participants: CreateConversationParticipantInput[];
}

export interface UserRoleBadge {
  userId: string;
  fullName: string | null;
  role: "mentee" | "mentor" | "associate" | "pm";
}