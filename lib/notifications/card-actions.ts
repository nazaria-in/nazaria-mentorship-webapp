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
 * Two known simplifications, flagged rather than silently guessed around:
 *  - `message` notifications don't carry conversation_id (only message_id
 *    is on the notifications table), so this links to /chat generally
 *    rather than the specific thread. Fix requires either adding
 *    conversation_id to notifications or a join at render time.
 *  - `meeting_started` doesn't carry meet_link (not stored on the
 *    notification row), so it links to the meeting page rather than
 *    opening the call directly. Same fix shape as above.
 */
export function getNotificationAction(notification: NotificationWithDelivery): NotificationCardAction | null {
  switch (notification.type) {
    case "meeting_invite":
      return null;

    case "reminder":
      if (notification.meeting_id) {
        return { label: "View meeting", href: `/meetings?highlight=${notification.meeting_id}` };
      }
      if (notification.resource_id) {
        return { label: "Add update", href: `/resources/${notification.resource_id}` };
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
      return notification.mentee_assignment_id
        ? { label: "View assignment", href: `/assignments/${notification.mentee_assignment_id}` }
        : null;

    case "assignment_submitted":
      return notification.mentee_assignment_id
        ? { label: "Review submission", href: `/assignments/${notification.mentee_assignment_id}` }
        : null;

    case "assignment_reviewed":
      return notification.mentee_assignment_id
        ? { label: "View feedback", href: `/assignments/${notification.mentee_assignment_id}` }
        : null;

    case "achievement":
      return notification.mentee_assignment_id
        ? { label: "View assignment", href: `/assignments/${notification.mentee_assignment_id}` }
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