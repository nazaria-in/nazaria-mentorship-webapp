// /store/session-store.ts

import { create } from "zustand";
import type { Role } from "@/providers/role-provider";

interface SessionState {
  userId: string | null;
  fullName: string | null;
  role: Role | null;
  hydrated: boolean;

  setSession: (session: {
    userId: string;
    fullName: string;
    role: Role;
  }) => void;

  setRole: (role: Role) => void;
  setFullName: (fullName: string) => void;

  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  userId: null,
  fullName: null,
  role: null,
  hydrated: false,

  setSession: ({ userId, fullName, role }) =>
    set({
      userId,
      fullName,
      role,
      hydrated: true,
    }),

  setRole: (role) =>
    set({
      role,
    }),

  setFullName: (fullName) =>
    set({
      fullName,
    }),

  clearSession: () =>
    set({
      userId: null,
      fullName: null,
      role: null,
      hydrated: true,
    }),
}));