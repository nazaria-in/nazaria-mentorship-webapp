// /app/layout.tsx

import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { SessionProvider } from "@/providers/session-provider";
import { RoleProvider } from "@/providers/role-provider";

export const metadata: Metadata = {
  title: "Nazaria",
  description: "Mentorship platform for Nazaria Arts Collective",
  // Explicitly defining the WebP icon from the /public folder
  icons: {
    icon: "/logo.webp", // Points to /public/logo.webp
    shortcut: "/logo.webp",
    apple: "/logo.webp", // Optional: if you want mobile devices to use it when saved to home screen
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <QueryProvider>
            <SessionProvider>
              {/* availableRoles left at its default (just the signed-in user's
                  real role) — pass more roles here once staff "view as" is wired up */}
              <RoleProvider isDebug={true}>{children}</RoleProvider>
            </SessionProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}