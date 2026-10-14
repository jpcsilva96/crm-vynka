import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationStore } from "@/lib/organizationStore";
import { toast } from "sonner";

export interface Workspace {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  organizationId?: string | null;
  dealCodePrefix?: string;
  dealCodeNextNumber?: number;
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  fetchWorkspaces: () => Promise<void>;
  addWorkspace: (name: string, color?: string) => Promise<Workspace | null>;
  updateWorkspace: (id: string, updates: Partial<Pick<Workspace, "name" | "color" | "dealCodePrefix">>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setActiveWorkspace: (id: string | null) => void;
  getActiveWorkspace: () => Workspace | null;
}

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"];

export const normalizeWorkspaceDealCodePrefix = (value: string) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);

const buildWorkspaceDealCodePrefix = (name: string) =>
  normalizeWorkspaceDealCodePrefix(name).slice(0, 3) || "VYN";

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: localStorage.getItem("variance_active_ws") || null,
  isLoading: true,

  fetchWorkspaces: async () => {
    const orgId = useOrganizationStore.getState().activeOrganizationId;
    if (!orgId) {
      set({ workspaces: [], activeWorkspaceId: null, isLoading: false });
      return;
    }

    set({ isLoading: true });
    const { data, error } = await supabase.from("workspaces").select("*").eq("organization_id", orgId).order("created_at");
    if (error) {
      console.error("Error fetching workspaces", error);
      set({ isLoading: false });
      return;
    }

    const mapped = (data || []).map(w => ({
      id: w.id,
      name: w.name,
      color: w.color || COLORS[0],
      createdAt: w.created_at,
      organizationId: w.organization_id,
      dealCodePrefix: w.deal_code_prefix || "VYN",
      dealCodeNextNumber: Number(w.deal_code_next_number) || 1,
    }));
    
    const currentActive = get().activeWorkspaceId;
    const stillExists = mapped.some(w => w.id === currentActive);
    const newActive = stillExists ? currentActive : (mapped.length > 0 ? mapped[0].id : null);
    
    if (newActive !== currentActive) {
      if (newActive) localStorage.setItem("variance_active_ws", newActive);
      else localStorage.removeItem("variance_active_ws");
    }

    void import("@/lib/pipelineStagesPersistence").then(({ ensureWorkspacePipelineStages }) =>
      Promise.allSettled(mapped.map((workspace) => ensureWorkspacePipelineStages(workspace.id)))
    );

    set({ workspaces: mapped, activeWorkspaceId: newActive, isLoading: false });
  },

  addWorkspace: async (name, color) => {
    const orgStore = useOrganizationStore.getState();
    const orgId = orgStore.activeOrganizationId;
    if (!orgId) return null;

    const org = orgStore.organizations.find(o => o.id === orgId);
    if (!org) return null;

    const limit = org.maxWorkspaces;
    if (limit !== undefined && get().workspaces.length >= limit) {
      toast.error(`Limite de workspaces atingido para esta organização (Máximo: ${limit}).`);
      return null;
    }

    const id = crypto.randomUUID();
    const c = color || COLORS[get().workspaces.length % COLORS.length];
    
    const dealCodePrefix = buildWorkspaceDealCodePrefix(name);
    const { error } = await supabase.from("workspaces").insert({
      id, name, color: c, organization_id: orgId, deal_code_prefix: dealCodePrefix
    });
    
    if (error) {
      console.error("Error creating workspace", error);
      return null;
    }

    try {
      const { ensureWorkspacePipelineStages } = await import("@/lib/pipelineStagesPersistence");
      await ensureWorkspacePipelineStages(id);
    } catch (stageError) {
      console.error("Error seeding pipeline stages", stageError);
    }
    
    const ws: Workspace = { id, name, color: c, createdAt: new Date().toISOString(), organizationId: orgId, dealCodePrefix, dealCodeNextNumber: 1 };
    set(s => ({ workspaces: [...s.workspaces, ws] }));
    return ws;
  },

  updateWorkspace: async (id, updates) => {
    const dbUpdates: { name?: string; color?: string; deal_code_prefix?: string } = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.dealCodePrefix !== undefined) {
      dbUpdates.deal_code_prefix = normalizeWorkspaceDealCodePrefix(updates.dealCodePrefix) || "VYN";
    }

    const localUpdates = {
      ...updates,
      ...(updates.dealCodePrefix !== undefined
        ? { dealCodePrefix: normalizeWorkspaceDealCodePrefix(updates.dealCodePrefix) || "VYN" }
        : {}),
    };

    const { error } = await supabase.from("workspaces").update(dbUpdates).eq("id", id);
    if (!error) {
      set(s => ({ workspaces: s.workspaces.map(w => w.id === id ? { ...w, ...localUpdates } : w) }));
    }
  },

  deleteWorkspace: async (id) => {
    const { error } = await supabase.from("workspaces").delete().eq("id", id);
    if (!error) {
      set(s => {
        const filtered = s.workspaces.filter(w => w.id !== id);
        const newActive = s.activeWorkspaceId === id ? (filtered[0]?.id || null) : s.activeWorkspaceId;
        if (newActive) localStorage.setItem("variance_active_ws", newActive);
        else localStorage.removeItem("variance_active_ws");
        return { workspaces: filtered, activeWorkspaceId: newActive };
      });
    }
  },

  setActiveWorkspace: (id) => {
    if (id) localStorage.setItem("variance_active_ws", id);
    else localStorage.removeItem("variance_active_ws");
    set({ activeWorkspaceId: id });
  },

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  },

}));
