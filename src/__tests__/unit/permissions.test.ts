import { can, canManageRole, permissionsFor } from "@/lib/permissions";

describe("role permissions", () => {
  it("gives admins every permission", () => {
    expect(permissionsFor("ADMIN")).toEqual(
      expect.arrayContaining(["project.create", "project.viewAll", "project.manageMembers", "team.manageRoles"])
    );
  });

  it("lets managers run projects but not see every project or manage roles", () => {
    expect(can("MANAGER", "project.create")).toBe(true);
    expect(can("MANAGER", "project.manageMembers")).toBe(true);
    expect(can("MANAGER", "team.invite")).toBe(true);
    expect(can("MANAGER", "project.viewAll")).toBe(false);
    expect(can("MANAGER", "team.manageRoles")).toBe(false);
  });

  it("gives engineers no management permissions", () => {
    expect(permissionsFor("MEMBER")).toEqual([]);
    expect(can("MEMBER", "project.create")).toBe(false);
    expect(can(null, "project.create")).toBe(false);
  });

  it("lets admins manage anyone and managers only engineers", () => {
    expect(canManageRole("ADMIN", "ADMIN")).toBe(true);
    expect(canManageRole("ADMIN", "MANAGER")).toBe(true);
    expect(canManageRole("MANAGER", "MEMBER")).toBe(true);
    expect(canManageRole("MANAGER", "MANAGER")).toBe(false);
    expect(canManageRole("MANAGER", "ADMIN")).toBe(false);
    expect(canManageRole("MEMBER", "MEMBER")).toBe(false);
  });
});
