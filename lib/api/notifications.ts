// /lib/api/notifications.ts

import { createClient } from "@/lib/supabase/client";
import type {
  CreateNotificationInput,
  NotificationsClient,
  NotificationWithDelivery,
} from "@/types/notifications";

function resolveClient(clientOrPayload: unknown): { client: NotificationsClient; isClientPassed: boolean } {
  if (
    clientOrPayload &&
    typeof clientOrPayload === "object" &&
    "from" in clientOrPayload &&
    typeof (clientOrPayload as Record<string, unknown>).from === "function"
  ) {
    return { client: clientOrPayload as NotificationsClient, isClientPassed: true };
  }
  return { client: createClient() as unknown as NotificationsClient, isClientPassed: false };
}

/**
 * Inserts one notification row + fans out a user_notifications row per
 * recipient, both `pending`. Does NOT dispatch push itself — that requires
 * the VAPID private key, which never ships to the browser, so dispatch is
 * always the cron/edge function's job (see supabase/functions/dispatch-
 * notifications). Practically: everything created here goes out on the
 * next cron tick, whether it was scheduled for the future or "now".
 * Returns the new notification's id.
 */
export async function createNotification(input: CreateNotificationInput): Promise<string>;
export async function createNotification(supabase: NotificationsClient, input: CreateNotificationInput): Promise<string>;
export async function createNotification(
  clientOrInput: NotificationsClient | CreateNotificationInput,
  maybeInput?: CreateNotificationInput
): Promise<string> {
  const { client, isClientPassed } = resolveClient(clientOrInput);
  const input = isClientPassed ? maybeInput! : (clientOrInput as CreateNotificationInput);

  if (!input || input.recipientUserIds.length === 0) {
    throw new Error("createNotification requires at least one recipient.");
  }

  const scheduledFor = input.scheduledFor ?? new Date();

  const { data: notification, error: notifError } = await client
    .from("notifications")
    .insert({
      created_by: input.createdBy,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      meeting_id: input.meetingId ?? null,
      content_dispatch_id: input.contentDispatchId ?? null,
      content_submission_id: input.contentSubmissionId ?? null,
      exit_survey_id: input.exitSurveyId ?? null,
      message_id: input.messageId ?? null,
      scheduled_for: scheduledFor.toISOString(),
    })
    .select("id")
    .single();

  if (notifError || !notification) {
    throw new Error(`Failed to create notification: ${notifError?.message ?? "unknown error"}`);
  }

  const notificationId = notification.id as string;

  const fanOutRows = input.recipientUserIds.map((userId) => ({
    notification_id: notificationId,
    user_id: userId,
    status: "pending" as const,
  }));

  const { error: fanOutError } = await client.from("user_notifications").insert(fanOutRows);

  if (fanOutError) {
    throw new Error(`Notification created but fan-out failed: ${fanOutError.message}`);
  }

  // DEBUG: confirms exactly what was written and to whom, at the moment of
  // creation — pairs with the [notifications:fetch] log below so a
  // mismatch between "what was written" and "what the view later returns"
  // is visible without a manual SQL round-trip. Remove once the display
  // bug investigation is closed.
  console.log("[notifications:create]", {
    notificationId,
    type: input.type,
    title: input.title,
    scheduledFor: scheduledFor.toISOString(),
    recipientUserIds: input.recipientUserIds,
    contentDispatchId: input.contentDispatchId ?? null,
    exitSurveyId: input.exitSurveyId ?? null,
    meetingId: input.meetingId ?? null,
  });

  return notificationId;
}

export interface CancelPendingFilter {
  meetingId?: string;
  /** REPLACES the old `menteeAssignmentId`. */
  contentDispatchId?: string;
  /** Restrict cancellation to one recipient (e.g. a single declined participant). */
  userId?: string;
}

/**
 * Soft-cancels not-yet-sent notifications matching the filter — used on
 * meeting decline/reschedule/cancel and on content-dispatch Mark Complete.
 * Only touches rows still `pending`; anything already `sent` is left
 * alone (a user who already got the reminder shouldn't have it silently
 * vanish from their notification list).
 */
export async function cancelPendingNotifications(filter: CancelPendingFilter): Promise<void>;
export async function cancelPendingNotifications(supabase: NotificationsClient, filter: CancelPendingFilter): Promise<void>;
export async function cancelPendingNotifications(
  clientOrFilter: NotificationsClient | CancelPendingFilter,
  maybeFilter?: CancelPendingFilter
): Promise<void> {
  const { client, isClientPassed } = resolveClient(clientOrFilter);
  const filter = isClientPassed ? maybeFilter! : (clientOrFilter as CancelPendingFilter);

  if (!filter.meetingId && !filter.contentDispatchId) {
    throw new Error("cancelPendingNotifications requires meetingId or contentDispatchId.");
  }

  let notificationQuery = client.from("notifications").select("id");
  if (filter.meetingId) notificationQuery = notificationQuery.eq("meeting_id", filter.meetingId);
  if (filter.contentDispatchId) {
    notificationQuery = notificationQuery.eq("content_dispatch_id", filter.contentDispatchId);
  }

  const { data: matchingNotifications, error: matchError } = await notificationQuery;
  if (matchError) throw matchError;
  if (!matchingNotifications || matchingNotifications.length === 0) return;

  const notificationIds = matchingNotifications.map((n) => n.id as string);

  let cancelQuery = client
    .from("user_notifications")
    .update({ deleted_at: new Date().toISOString() })
    .in("notification_id", notificationIds)
    .eq("status", "pending");

  if (filter.userId) {
    cancelQuery = cancelQuery.eq("user_id", filter.userId);
  }

  const { error: cancelError } = await cancelQuery;
  if (cancelError) throw cancelError;
}

export async function markNotificationRead(userNotificationId: string): Promise<void>;
export async function markNotificationRead(supabase: NotificationsClient, userNotificationId: string): Promise<void>;
export async function markNotificationRead(
  clientOrId: NotificationsClient | string,
  maybeId?: string
): Promise<void> {
  const { client, isClientPassed } = resolveClient(clientOrId);
  const userNotificationId = isClientPassed ? maybeId! : (clientOrId as string);

  const { error } = await client
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", userNotificationId);
  if (error) throw error;
}

/**
 * Marks every currently-unread, non-deleted, currently-VISIBLE notification
 * for a user as read — scoped through v_visible_user_notifications so a
 * future-dated reminder can never be marked read before the user could
 * have actually seen it.
 */
export async function markAllNotificationsRead(userId: string, scopedNotificationIds?: string[]): Promise<void>;
export async function markAllNotificationsRead(supabase: NotificationsClient, userId: string, scopedNotificationIds?: string[]): Promise<void>;
export async function markAllNotificationsRead(
  clientOrUserId: NotificationsClient | string,
  maybeUserIdOrScopedIds?: string | string[],
  maybeScopedIds?: string[]
): Promise<void> {
  const { client, isClientPassed } = resolveClient(clientOrUserId);
  const userId = isClientPassed ? (maybeUserIdOrScopedIds as string) : (clientOrUserId as string);
  const scopedNotificationIds = isClientPassed ? maybeScopedIds : (maybeUserIdOrScopedIds as string[] | undefined);

  let visibleQuery = client
    .from("v_visible_user_notifications")
    .select("user_notification_id")
    .eq("user_id", userId)
    .is("read_at", null);

  if (scopedNotificationIds && scopedNotificationIds.length > 0) {
    visibleQuery = visibleQuery.in("id", scopedNotificationIds);
  }

  const { data: visibleRows, error: visError } = await visibleQuery;
  if (visError) throw visError;

  const ids = (visibleRows ?? []).map((r) => r.user_notification_id as string);
  if (ids.length === 0) return;

  const { error } = await client
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

export interface FetchNotificationsParams {
  userId: string;
  onlyUnread?: boolean;
  types?: NotificationWithDelivery["type"][];
  limit?: number;
  /** created_at cursor for pagination — pass the last row's created_at. */
  before?: string;
}

/**
 * Powers both the bell dropdown (small limit, no filters) and the full
 * /notifications page (SmartFilterBar-driven — types/onlyUnread map
 * directly onto FilterFieldDef values there).
 *
 * Every call here is the single source of truth for "what should the user
 * see right now" — it always queries v_visible_user_notifications, never
 * the base notifications/user_notifications tables directly. If a caller
 * elsewhere in the codebase queries those base tables and hands rows to a
 * NotificationCard-rendering component, THAT is a bypass of this function
 * and would explain a display/view mismatch — the log below only proves
 * what THIS function returned, not what every code path does.
 */
export async function fetchNotificationsForUser(params: FetchNotificationsParams): Promise<NotificationWithDelivery[]>;
export async function fetchNotificationsForUser(supabase: NotificationsClient, params: FetchNotificationsParams): Promise<NotificationWithDelivery[]>;
export async function fetchNotificationsForUser(
  clientOrParams: NotificationsClient | FetchNotificationsParams,
  maybeParams?: FetchNotificationsParams
): Promise<NotificationWithDelivery[]> {
  const { client, isClientPassed } = resolveClient(clientOrParams);
  const params = isClientPassed ? maybeParams! : (clientOrParams as FetchNotificationsParams);

  const callId = Math.random().toString(36).slice(2, 8);

  let query = client
    .from("v_visible_user_notifications")
    .select("*")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 20);

  if (params.onlyUnread) query = query.is("read_at", null);
  if (params.before) query = query.lt("created_at", params.before);

  // DEBUG: logged BEFORE the request fires, with a callId, so overlapping
  // fetches (e.g. bell poll + realtime handler + manual open, all firing
  // within the same second) can be told apart in the console instead of
  // their results being attributed to the wrong trigger.
  console.log(`[notifications:fetch:${callId}] querying v_visible_user_notifications`, {
    userId: params.userId,
    onlyUnread: params.onlyUnread ?? false,
    types: params.types ?? "all",
    limit: params.limit ?? 20,
    before: params.before ?? null,
    calledAt: new Date().toISOString(),
  });

  const { data, error } = await query;
  if (error) {
    console.log(`[notifications:fetch:${callId}] ERROR`, error);
    throw error;
  }

  const rows = (data ?? []) as Array<NotificationWithDelivery & {
    user_notification_id: string;
    read_at: string | null;
  }>;

  const filtered = params.types ? rows.filter((r) => params.types!.includes(r.type)) : rows;

  const mapped = filtered.map((r) => ({
    ...r,
    userNotificationId: r.user_notification_id,
    readAt: r.read_at,
  }));

  // DEBUG: exactly what this call returned, with scheduled_for included so
  // a row that shouldn't be visible yet is immediately spottable by eye.
  console.log(
    `[notifications:fetch:${callId}] → ${mapped.length} row(s)`,
    mapped.map((r) => ({
      id: r.id,
      userNotificationId: r.userNotificationId,
      type: r.type,
      title: r.title,
      scheduled_for: r.scheduled_for,
      created_at: r.created_at,
    }))
  );

  return mapped;
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number>;
export async function fetchUnreadNotificationCount(supabase: NotificationsClient, userId: string): Promise<number>;
export async function fetchUnreadNotificationCount(
  clientOrUserId: NotificationsClient | string,
  maybeUserId?: string
): Promise<number> {
  const { client, isClientPassed } = resolveClient(clientOrUserId);
  const userId = isClientPassed ? maybeUserId! : (clientOrUserId as string);

  const { count, error } = await client
    .from("v_visible_user_notifications")
    .select("user_notification_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}