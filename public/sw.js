// /public/sw.js

// Plain JS, not TS — service workers run outside your Next.js build, no
// transpile step touches this file. Keep it dependency-free.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Nazaria", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.webp",
      badge: "/icon.webp",
      data: payload.data ?? {},
      // replaces, doesn't stack, if the same notificationId fires twice
      tag: payload.data?.notificationId,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const type = event.notification.data?.type;
  const meetingId = event.notification.data?.meetingId;
  const contentDispatchId = event.notification.data?.contentDispatchId;
  const exitSurveyId = event.notification.data?.exitSurveyId;
  const conversationId = event.notification.data?.conversationId;

  let path = "/dashboard";

  if (type === "message" && conversationId) {
    path = `/chat/${conversationId}`;
  } else if (type === "message") {
    // conversationId is not stored on the notifications table (only message_id
    // is), so fall back to the chat list rather than a broken deep-link.
    path = "/chat";
  } else if (type === "meeting_invite" || type === "meeting_started") {
    path = meetingId ? `/meetings?highlight=${meetingId}` : "/meetings";
  } else if (type === "reminder" && meetingId) {
    path = `/meetings?highlight=${meetingId}`;
  } else if (type === "reminder" && contentDispatchId) {
    path = `/assignments_and_courses/dispatch/${contentDispatchId}`;
  } else if (
    type === "assignment_due" ||
    type === "assignment_submitted" ||
    type === "assignment_reviewed" ||
    type === "achievement"
  ) {
    path = contentDispatchId
      ? `/assignments_and_courses/dispatch/${contentDispatchId}`
      : "/assignments_and_courses";
  } else if (type === "exit_survey_pending") {
    path = exitSurveyId ? `/exit-survey/${exitSurveyId}` : "/exit-survey";
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(path);
          return client.focus();
        }
      }
      return self.clients.openWindow(path);
    })
  );
});