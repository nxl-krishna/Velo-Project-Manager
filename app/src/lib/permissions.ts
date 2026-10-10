// Role-based permissions shared by API routes and the UI (no server-only imports).
// The workspace (org) role is the source of truth; "MEMBER" is presented as "Engineer".
import type { Role } from "@prisma/client";

export const ROLES: Role[] = ["ADMIN", "MANAGER", "MEMBER"];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Engineer",
};

export type Permission =
  | "project.create" // create projects
  | "project.viewAll" // see every project in the workspace, even without being on it
  | "project.manageMembers" // add/remove people on projects they can access
  | "sprint.manage" // create sprints
  | "team.viewAll" // see the whole workspace directory
  | "team.invite" // add people to the workspace
  | "team.manageRoles"; // change roles and remove people from the workspace

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: [
    "project.create",
    "project.viewAll",
    "project.manageMembers",
    "sprint.manage",
    "team.viewAll",
    "team.invite",
    "team.manageRoles",
  ],
  MANAGER: ["project.create", "project.manageMembers", "sprint.manage", "team.viewAll", "team.invite"],
  MEMBER: [],
};

export function permissionsFor(role: Role | null | undefined): Permission[] {
  return role ? MATRIX[role] : [];
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

/** Whether `actor` may invite, add to a project, or remove someone holding `target` role. Managers only handle engineers. */
export function canManageRole(actor: Role | null | undefined, target: Role): boolean {
  if (actor === "ADMIN") return true;
  if (actor === "MANAGER") return target === "MEMBER";
  return false;
}
