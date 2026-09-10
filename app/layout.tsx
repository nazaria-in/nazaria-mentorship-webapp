// /app/layout.tsx

import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { SessionProvider } from "@/providers/session-provider";
import { RoleProvider } from "@/providers/role-provider";
import { ConditionalShell } from "@/components/shell/ConditionalShell";
import { ServiceWorkerRegistrar } from "@/components/shell/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "Nazaria",
  description: "Mentorship platform for Nazaria Arts Collective",
  icons: {
    icon: "/logo.webp",
    shortcut: "/logo.webp",
    apple: "/logo.webp",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/*
          ServiceWorkerRegistrar must sit outside all providers — it has no
          data dependencies and we want /sw.js registered as early as
          possible so that a push arriving while the page is loading is
          still handled correctly.
        */}
        <ServiceWorkerRegistrar />
        <ThemeProvider>
          <QueryProvider>
            <SessionProvider>
              <RoleProvider isDebug={false}>
                <ConditionalShell>{children}</ConditionalShell>
              </RoleProvider>
            </SessionProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}