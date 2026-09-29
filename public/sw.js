// /public/sw.js

// Plain JS, not TS — service workers run outside your Next.js build, no
// transpile step touches this file. Keep it dependency-free.
//
// PostHog cannot run inside a SW (no window/DOM). Instead we broadcast a
// message to all open clients (tabs) via postMessage. ServiceWorkerRegistrar
// listens for these messages and forwards them to PostHog.

function broadcastLog(event, properties) {
  self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
    for (const client of clients) {
      client.postMessage({ type: "SW_LOG", event, properties });
    }
  });
}

self.addEventListener("install", (e) => {
  broadcastLog("sw_install", { status: "installing" });
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  broadcastLog("sw_activate", { status: "activated" });
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  broadcastLog("sw_push_received", { hasData: !!event.data });

  if (!event.data) {
    broadcastLog("sw_push_no_data", { error: "push event had no data" });
    return;
  }

  let payload;
  try {
    payload = event.data.json();
    broadcastLog("sw_push_parsed", {
      title: payload.title,
      body: payload.body,
      notificationId: payload.data?.notificationId ?? null,
      type: payload.data?.type ?? null,
    });
  } catch (err) {
    const fallbackText = event.data.text();
    broadcastLog("sw_push_parse_failed", {
      error: String(err),
      rawText: fallbackText.slice(0, 200),
    });
    payload = { title: "Nazaria", body: fallbackText };
  }

  event.waitUntil(
    self.registration
      .showNotification(payload.title, {
        body: payload.body,
        icon: "/icon.webp",
        badge: "/icon.webp",
        data: payload.data ?? {},
        tag: payload.data?.notificationId,
      })
      .then(() => {
        broadcastLog("sw_notification_shown", {
          title: payload.title,
          notificationId: payload.data?.notificationId ?? null,
        });
      })
      .catch((err) => {
        broadcastLog("sw_notification_failed", { error: String(err) });
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

  broadcastLog("sw_notification_clicked", { type, path });

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