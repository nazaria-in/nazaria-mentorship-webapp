// /lib/notifications/message-notifications.ts

import { createNotification } from "@/lib/api/notifications";
import { NotificationsClient } from "@/types/notifications";

export interface MessageNotificationInput {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  senderId: string;
  senderName: string;
  body: string;
}

/**
 * Notifies every active participant except the sender — deliberately
 * ignores can_message, since broadcast/announcement channels have
 * read-only participants who still need to be notified. left_at IS NULL
 * is still respected: someone who's left the conversation shouldn't hear
 * about it anymore.
 */
export async function notifyNewMessage(
  supabase: NotificationsClient,
  input: MessageNotificationInput
): Promise<void> {
  const { data: participants, error } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", input.conversationId)
    .is("left_at", null)
    .neq("user_id", input.senderId);

  if (error) throw error;
  if (!participants || participants.length === 0) return;

  const recipientUserIds = participants.map((p) => p.user_id as string);
  const truncatedBody = input.body.length > 120 ? `${input.body.slice(0, 117)}...` : input.body;

  await createNotification(supabase, {
    createdBy: input.senderId,
    type: "message",
    title: input.conversationTitle,
    body: `${input.senderName}: ${truncatedBody}`,
    recipientUserIds,
    messageId: input.messageId,
  });
}