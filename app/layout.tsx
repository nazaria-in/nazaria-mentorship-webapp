import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { SessionProvider } from "@/providers/session-provider";
import { RoleProvider } from "@/providers/role-provider";
import { ConditionalShell } from "@/components/shell/ConditionalShell";

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
        <ThemeProvider>
          <QueryProvider>
            <SessionProvider>
              <RoleProvider isDebug={true}>
                <ConditionalShell>{children}</ConditionalShell>
              </RoleProvider>
            </SessionProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}