// /types/messages.ts

export type ConversationKind = "direct" | "pod" | "broadcast";
export type BroadcastAudience = "everyone" | "mentors" | "mentees";

export interface Conversation {
  id: string;
  kind: ConversationKind;
  name: string | null;
  pod_id: string | null;
  cohort_id: string | null;
  audience: BroadcastAudience | null;
  created_by: string;
  created_at: string;
  last_message_at: string | null;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  can_message: boolean;
  joined_at: string;
  last_read_at: string | null;
  left_at: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  /** Client-only display field, resolved from participants/users lookups. */
  senderName?: string;
}

/** Row shape returned by v_conversation_summary — powers "My Conversations". */
export interface ConversationSummary {
  conversation_id: string;
  kind: ConversationKind;
  name: string | null;
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
  /** Client-computed display name — see resolveConversationName(). */
  resolved_name?: string;
}

/** Row shape returned by v_conversation_oversight — staff-only browse surface. */
export interface ConversationOversight {
  conversation_id: string;
  kind: ConversationKind;
  name: string | null;
  pod_id: string | null;
  cohort_id: string | null;
  audience: BroadcastAudience | null;
  last_message_at: string | null;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  last_message_created_at: string | null;
  last_message_deleted_at: string | null;
  i_am_active_participant: boolean;
  resolved_name?: string;
}

export type ConversationListFilter = "all" | "unread" | "pods" | "broadcasts" | "direct";

export interface ComposerDisabledState {
  disabled: boolean;
  reason: string | null;
}