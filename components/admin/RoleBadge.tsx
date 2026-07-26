// /components/admin/RoleBadge.tsx

import type { UserRole } from "@/lib/api/admin-users";

// Distinct color per role so mentee/mentor are never ambiguous in a list —
// this is the "clearly visible who is mentee/mentor" requirement.
const ROLE_STYLES: Record<UserRole, string> = {
  mentee: "bg-nazaria-pale-teal text-nazaria-teal dark:bg-nazaria-teal/30 dark:text-white",
  mentor: "bg-nazaria-pale-pink text-nazaria-burgundy dark:bg-nazaria-burgundy/40 dark:text-nazaria-cream",
  associate: "bg-nazaria-pale-gold text-text-primary dark:bg-nazaria-cream/20 dark:text-nazaria-cream",
  pm: "bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground",
};

interface RoleBadgeProps {
  role: UserRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_STYLES[role]}`}>
      {role}
    </span>
  );
}