import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

export type RecordVisibility = "all" | "team" | "own";

export interface RolePermissions {
  menus: string[];
  dealsVisibility: RecordVisibility;
  tasksVisibility: RecordVisibility;
  contactsVisibility: RecordVisibility;
  companiesVisibility: RecordVisibility;
  canDeleteRecords: boolean;
  canManageSettings: boolean;
  canManageUsers: boolean;
  dealsEdit?: boolean;
  dealsDelete?: boolean;
}

export interface Role {
  id: string;
  name: string;
  isMaster?: boolean;
  permissions: RolePermissions;
}

interface RolesState {
  roles: Role[];
  isLoading: boolean;
  fetchRoles: () => Promise<void>;
  addRole: (role: Omit<Role, "id">) => Promise<void>;
  updateRole: (id: string, updates: Partial<Role>) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;
}

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  menus: [],
  dealsVisibility: "own",
  tasksVisibility: "own",
  contactsVisibility: "own",
  companiesVisibility: "own",
  canDeleteRecords: false,
  canManageSettings: false,
  canManageUsers: false,
  dealsEdit: true,
  dealsDelete: false,
};

export const normalizeRolePermissions = (permissions?: Partial<RolePermissions> | null): RolePermissions => {
  const menus = Array.isArray(permissions?.menus) ? permissions.menus : [];
  const canManageSettings = Boolean(permissions?.canManageSettings ?? menus.includes("settings"));
  const canManageUsers = Boolean(permissions?.canManageUsers ?? menus.includes("users"));
  const canDeleteRecords = Boolean(permissions?.canDeleteRecords ?? permissions?.dealsDelete ?? false);

  return {
    ...DEFAULT_ROLE_PERMISSIONS,
    ...permissions,
    menus,
    dealsVisibility: permissions?.dealsVisibility || "own",
    tasksVisibility: permissions?.tasksVisibility || permissions?.dealsVisibility || "own",
    contactsVisibility: permissions?.contactsVisibility || permissions?.dealsVisibility || "own",
    companiesVisibility: permissions?.companiesVisibility || permissions?.dealsVisibility || "own",
    canDeleteRecords,
    canManageSettings,
    canManageUsers,
    dealsEdit: true,
    dealsDelete: canDeleteRecords,
  };
};

export const useRolesStore = create<RolesState>((set, get) => ({
  roles: [],
  isLoading: true,

  fetchRoles: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .order("created_at");

    if (error) {
      console.error("Error fetching roles:", error);
      toast.error("Erro ao carregar perfis");
      set({ isLoading: false });
      return;
    }

    if (data) {
      const mapped: Role[] = data.map(r => ({
        id: r.id,
        name: r.name,
        isMaster: r.is_master,
        permissions: normalizeRolePermissions(r.permissions as unknown as Partial<RolePermissions>),
      }));
      set({ roles: mapped, isLoading: false });
    }
  },

  addRole: async (role) => {
    const id = crypto.randomUUID();
    const newRole = {
      id,
      name: role.name,
      is_master: role.isMaster || false,
      permissions: role.permissions,
    };

    const { error } = await db.from("roles").insert(newRole);

    if (error) {
      console.error("Error creating role:", error);
      toast.error("Erro ao criar perfil");
      throw error;
    }

    set((state) => ({
      roles: [...state.roles, { ...role, id }],
    }));
  },

  updateRole: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.permissions !== undefined) dbUpdates.permissions = updates.permissions;

    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await db.from("roles").update(dbUpdates).eq("id", id);
      if (error) {
        console.error("Error updating role:", error);
        toast.error("Erro ao atualizar perfil");
        throw error;
      }
    }

    set((state) => ({
      roles: state.roles.map((r) =>
        r.id === id && !r.isMaster
          ? { ...r, ...updates, permissions: updates.permissions ? normalizeRolePermissions(updates.permissions) : r.permissions }
          : r
      ),
    }));
  },

  deleteRole: async (id) => {
    const { error } = await supabase.from("roles").delete().eq("id", id);
    if (error) {
      console.error("Error deleting role:", error);
      toast.error("Erro ao deletar perfil");
      throw error;
    }

    set((state) => ({
      roles: state.roles.filter((r) => r.id !== id || r.isMaster),
    }));
  },
}));
