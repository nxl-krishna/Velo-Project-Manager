"use client";

import { createContext, useContext } from "react";
import type { Role } from "@prisma/client";
import type { Permission } from "@/lib/permissions";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: Role;
  permissions: Permission[];
  workspace: { id: string; name: string };
}

export const CurrentUserContext = createContext<CurrentUser | null>(null);

export function useCurrentUser(): CurrentUser | null {
  return useContext(CurrentUserContext);
}

/** False until the profile has loaded, so role-gated controls never flash for users who lack the permission. */
export function useCan(permission: Permission): boolean {
  return Boolean(useCurrentUser()?.permissions.includes(permission));
}
