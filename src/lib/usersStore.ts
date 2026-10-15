import { create } from "zustand";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationStore } from "@/lib/organizationStore";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  cpf: string;
  roleId: string;
  workspaces: string[];
  createdAt?: string;
  password?: string;
  requirePasswordChange?: boolean;
  avatar?: string;
  organizationId?: string | null;
}

interface UsersState {
  users: UserProfile[];
  isLoading: boolean;
  fetchUsers: () => Promise<void>;
  addUser: (user: Omit<UserProfile, "id" | "createdAt">) => Promise<void>;
  updateUser: (id: string, updates: Partial<UserProfile>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

export const normalizeWorkspaceIds = (workspaces?: string[] | null) =>
  Array.from(new Set((workspaces || []).filter(Boolean)));

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const mapProfile = (profile: Record<string, unknown>): UserProfile => ({
  id: asString(profile.id),
  name: asString(profile.name),
  email: asString(profile.email),
  cpf: asString(profile.cpf),
  roleId: asString(profile.role_id),
  workspaces: normalizeWorkspaceIds(Array.isArray(profile.workspaces) ? profile.workspaces.map(String) : []),
  createdAt: typeof profile.created_at === "string" ? profile.created_at : undefined,
  avatar: typeof profile.avatar === "string" ? profile.avatar : undefined,
  requirePasswordChange: typeof profile.require_password_change === "boolean" ? profile.require_password_change : undefined,
  organizationId: typeof profile.organization_id === "string" ? profile.organization_id : null,
});

const persistUserUpdate = async (id: string, updates: Partial<UserProfile>) => {
  const { data, error } = await supabase.functions.invoke("update-user", {
    body: {
      id,
      updates: {
        ...updates,
        workspaces: updates.workspaces !== undefined ? normalizeWorkspaceIds(updates.workspaces) : undefined,
      },
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
};

const getFunctionErrorMessage = async (error: unknown, fallback: string) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error && typeof body.error === "string") return body.error;
    } catch {
      return fallback;
    }
  }

  return error instanceof Error ? error.message : fallback;
};

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  isLoading: true,

  fetchUsers: async () => {
    const orgId = useOrganizationStore.getState().activeOrganizationId;
    if (!orgId) {
      set({ users: [], isLoading: false });
      return;
    }

    set({ isLoading: true });
    const currentUserEmail = localStorage.getItem("vynka_user_email");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`organization_id.eq.${orgId}${currentUserEmail ? `,email.eq.${currentUserEmail}` : ""}`)
      .order("name");

    if (error) {
      console.error("Error fetching profiles:", error);
      toast.error("Erro ao carregar usuários");
      set({ isLoading: false });
      return;
    }

    set({ users: (data || []).map(mapProfile), isLoading: false });
  },

  addUser: async (user) => {
    try {
      const orgStore = useOrganizationStore.getState();
      const orgId = orgStore.activeOrganizationId;
      const org = orgStore.organizations.find((item) => item.id === orgId);

      if (org && org.maxUsers !== undefined && get().users.length >= org.maxUsers) {
        toast.error(`Limite de usuários atingido para esta organização (Máximo: ${org.maxUsers}).`);
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: user.email,
          password: user.password || "123456",
          name: user.name,
          cpf: user.cpf,
          roleId: user.roleId,
          workspaces: normalizeWorkspaceIds(user.workspaces),
          organizationId: orgId,
        },
      });

      if (error) throw new Error(await getFunctionErrorMessage(error, "Erro desconhecido ao deletar usuário"));
      await get().fetchUsers();
    } catch (error: unknown) {
      console.error("Error creating user:", error);
      toast.error("Erro ao criar usuário: " + (error instanceof Error ? error.message : "erro desconhecido"));
      throw error;
    }
  },

  updateUser: async (id, updates) => {
    try {
      await persistUserUpdate(id, updates);

      set((state) => ({
        users: state.users.map((user) =>
          user.id === id
            ? {
                ...user,
                ...updates,
                workspaces: updates.workspaces !== undefined ? normalizeWorkspaceIds(updates.workspaces) : user.workspaces,
              }
            : user
        ),
      }));
    } catch (error: unknown) {
      console.error("Error updating user:", error);
      toast.error("Erro ao atualizar usuário");
      throw error;
    }
  },

  deleteUser: async (id) => {
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { id },
      });

      if (error) throw new Error(await getFunctionErrorMessage(error, "Erro desconhecido ao criar usuário"));
      if (data?.error) throw new Error(data.error);
      if (data?.error) throw new Error(data.error);

      set((state) => ({
        users: state.users.filter((user) => user.id !== id),
      }));
    } catch (error: unknown) {
      console.error("Error deleting user:", error);
      toast.error("Erro ao deletar usuário: " + (error instanceof Error ? error.message : "erro desconhecido"));
      throw error;
    }
  },
}));
