import type { Deal } from "@/lib/dealsStore";
import type { RecordVisibility, Role } from "@/lib/rolesStore";
import type { UserProfile } from "@/lib/usersStore";

export type AppMenu = "dashboard" | "pipeline" | "settings" | "users";
export type VisibilityScope = "deals" | "tasks" | "contacts" | "companies";

const CRM_MENUS = new Set<AppMenu>(["dashboard", "pipeline"]);

export function canAccessMenu(role: Role | undefined, menu: AppMenu) {
  if (role?.isMaster) return true;
  const menus = role?.permissions?.menus || [];
  if (CRM_MENUS.has(menu)) return menus.includes("pipeline") || menus.includes("dashboard");
  return menus.includes(menu);
}

export function canManageSettings(role: Role | undefined) {
  return Boolean(role?.isMaster || role?.permissions?.canManageSettings || role?.permissions?.menus?.includes("settings"));
}

export function canManageUsers(role: Role | undefined) {
  return Boolean(role?.isMaster || role?.permissions?.canManageUsers || role?.permissions?.menus?.includes("users"));
}

export function canDeleteRecords(role: Role | undefined) {
  return Boolean(role?.isMaster || role?.permissions?.canDeleteRecords || role?.permissions?.dealsDelete);
}

export function isOwnVisibility(role: Role | undefined) {
  return !role?.isMaster && getVisibility(role, "deals") === "own";
}

export function getVisibility(role: Role | undefined, scope: VisibilityScope): RecordVisibility {
  if (role?.isMaster) return "all";
  const permissions = role?.permissions;

  if (scope === "tasks") return permissions?.tasksVisibility || permissions?.dealsVisibility || "own";
  if (scope === "contacts") return permissions?.contactsVisibility || permissions?.dealsVisibility || "own";
  if (scope === "companies") return permissions?.companiesVisibility || permissions?.dealsVisibility || "own";
  return permissions?.dealsVisibility || "own";
}

export function isAssignedToUser(assignedTo: string | string[] | undefined, user: UserProfile | undefined) {
  if (!assignedTo || !user) return false;
  const values = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
  return values.some((value) => value === user.id || value === user.email || value === user.name);
}

export function canViewAssignedRecord(
  role: Role | undefined,
  user: UserProfile | undefined,
  assignedTo: string | string[] | undefined,
  scope: VisibilityScope = "deals",
) {
  if (role?.isMaster) return true;
  const visibility = getVisibility(role, scope);
  if (visibility === "all" || visibility === "team") return true;
  return isAssignedToUser(assignedTo, user);
}

export function canViewDeal(role: Role | undefined, user: UserProfile | undefined, deal: Deal) {
  if (role?.isMaster) return true;
  const visibility = getVisibility(role, "deals");
  if (visibility === "all" || visibility === "team") return true;
  return isAssignedToUser(deal.assignedTo, user);
}
