// /lib/notifications/card-actions.ts

import { NotificationWithDelivery } from "@/types/notifications";

export interface NotificationCardAction {
  label: string;
  href: string;
}

/**
 * meeting_invite is handled separately by NotificationCard (Accept/Decline
 * buttons, not a link) — returns null for it on purpose.
 *
 * CHANGED: every case that used to key off `mentee_assignment_id` now uses
 * `content_dispatch_id` (the real column — see types/notifications.ts).
 * `resource_id` never existed as a real column and is removed outright
 * rather than swapped, since resources are content_items now and route
 * through content_dispatch_id like everything else — there's no separate
 * "resource" case anymore, assignment/course/resource notifications all
 * resolve the same way.
 *
 * Hrefs point at /assignments_and_courses/dispatch/{content_dispatch_id},
 * a thin server redirect that resolves the dispatch to its content item
 * and forwards there — see that route's file header for why this
 * indirection exists instead of linking directly.
 *
 * Two known simplifications, flagged rather than silently guessed around
 * (unchanged from before):
 *  - `message` notifications don't carry conversation_id (only message_id
 *    is on the notifications table), so this links to /chat generally
 *    rather than the specific thread.
 *  - `meeting_started` doesn't carry meet_link, so it links to the
 *    meeting page rather than opening the call directly.
 */
export function getNotificationAction(notification: NotificationWithDelivery): NotificationCardAction | null {
  switch (notification.type) {
    case "meeting_invite":
      return null;

    case "reminder":
      // resource_id branch removed — no longer a real column. Meeting
      // reminders are the only "reminder"-typed notification left.
      if (notification.meeting_id) {
        return { label: "View meeting", href: `/meetings?highlight=${notification.meeting_id}` };
      }
      return null;

    case "meeting_started":
      return notification.meeting_id
        ? { label: "View meeting", href: `/meetings?highlight=${notification.meeting_id}` }
        : null;

    case "exit_survey_pending": {
      if (!notification.exit_survey_id) return null;
      const isStaffAlert = notification.title.toLowerCase().startsWith("exit survey submitted");
      return {
        label: isStaffAlert ? "Review survey" : "Fill survey",
        href: `/exit-survey/${notification.exit_survey_id}`,
      };
    }

    case "assignment_due":
      return notification.content_dispatch_id
        ? { label: "View item", href: `/assignments_and_courses/dispatch/${notification.content_dispatch_id}` }
        : null;

    case "assignment_submitted":
      return notification.content_dispatch_id
        ? { label: "Review submission", href: `/assignments_and_courses/dispatch/${notification.content_dispatch_id}` }
        : null;

    case "assignment_reviewed":
      return notification.content_dispatch_id
        ? { label: "View feedback", href: `/assignments_and_courses/dispatch/${notification.content_dispatch_id}` }
        : null;

    case "achievement":
      return notification.content_dispatch_id
        ? { label: "View item", href: `/assignments_and_courses/dispatch/${notification.content_dispatch_id}` }
        : null;

    case "message":
      return { label: "Open chat", href: "/chat" };

    default:
      return null;
  }
}

/**
 * Overdue nudges aren't a separate enum value — daily-sweeps titles them
 * with "overdue" in the string (see supabase/functions/daily-sweeps),
 * detected here rather than adding a schema flag for it.
 */
export function isOverdueNotification(notification: NotificationWithDelivery): boolean {
  return notification.title.toLowerCase().includes("overdue");
}