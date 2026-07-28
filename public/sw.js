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
      tag: payload.data?.notificationId, // replaces, doesn't stack, if the same id fires twice
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const type = event.notification.data?.type;
  const meetingId = event.notification.data?.meetingId;
  const menteeAssignmentId = event.notification.data?.menteeAssignmentId;
  const conversationId = event.notification.data?.conversationId;

  let path = "/dashboard";
  if (type === "message" && conversationId) path = `/chat/${conversationId}`;
  else if (type?.startsWith("meeting") || type === "reminder") path = meetingId ? `/meetings?highlight=${meetingId}` : "/meetings";
  else if (type?.startsWith("assignment")) path = menteeAssignmentId ? `/assignments/${menteeAssignmentId}` : "/assignments";
  else if (type === "exit_survey_pending") path = meetingId ? `/meetings?highlight=${meetingId}&survey=1` : "/meetings";

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