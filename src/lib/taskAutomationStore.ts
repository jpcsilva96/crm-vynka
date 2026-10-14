import { create } from "zustand";
import { getWorkspaceHeader, supabase, setWorkspaceHeader } from "@/integrations/supabase/client";

const db = supabase as any;

export interface TaskAutomationRule {
  id: string;
  workspaceId: string;
  pipelineId: string;
  stageId: string;
  taskTitle: string;
  taskDescription?: string;
  dueDays: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

const mapRuleRow = (row: any): TaskAutomationRule => ({
  id: row.id,
  workspaceId: row.workspace_id,
  pipelineId: row.pipeline_id,
  stageId: row.stage_id,
  taskTitle: row.task_title,
  taskDescription: row.task_description || undefined,
  dueDays: Number(row.due_days) || 0,
  active: row.active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at || undefined,
});

interface TaskAutomationRulesState {
  rulesByWorkspace: Record<string, TaskAutomationRule[]>;
  isLoading: boolean;
  fetchRules: (workspaceId: string) => Promise<void>;
  addRule: (input: Omit<TaskAutomationRule, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateRule: (
    id: string,
    updates: Partial<Pick<TaskAutomationRule, "pipelineId" | "stageId" | "taskTitle" | "taskDescription" | "dueDays" | "active">>,
  ) => Promise<void>;
  removeRule: (id: string) => Promise<void>;
  getRules: (workspaceId?: string | null) => TaskAutomationRule[];
  getRulesForStage: (workspaceId: string, pipelineId: string, stageId: string) => TaskAutomationRule[];
}

export const useTaskAutomationRulesStore = create<TaskAutomationRulesState>((set, get) => ({
  rulesByWorkspace: {},
  isLoading: false,

  fetchRules: async (workspaceId) => {
    set({ isLoading: true });
    const previousWorkspaceHeader = getWorkspaceHeader();

    setWorkspaceHeader(workspaceId);

    const { data, error } = await db
      .from("task_automation_rules")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching task automation rules:", error);
      set({ isLoading: false });
      setWorkspaceHeader(previousWorkspaceHeader);
      return;
    }

    set((state) => ({
      rulesByWorkspace: {
        ...state.rulesByWorkspace,
        [workspaceId]: (data || []).map(mapRuleRow),
      },
      isLoading: false,
    }));

    setWorkspaceHeader(previousWorkspaceHeader);
  },

  addRule: async (input) => {
    const payload = {
      workspace_id: input.workspaceId,
      pipeline_id: input.pipelineId,
      stage_id: input.stageId,
      task_title: input.taskTitle.trim(),
      task_description: input.taskDescription?.trim() || null,
      due_days: Number(input.dueDays) || 0,
      active: input.active,
    };

    const { data, error } = await db.from("task_automation_rules").insert(payload).select("*").single();
    if (error) throw error;

    set((state) => ({
      rulesByWorkspace: {
        ...state.rulesByWorkspace,
        [input.workspaceId]: [...(state.rulesByWorkspace[input.workspaceId] || []), mapRuleRow(data)],
      },
    }));
  },

  updateRule: async (id, updates) => {
    const currentRule = Object.values(get().rulesByWorkspace)
      .flat()
      .find((rule) => rule.id === id);
    if (!currentRule) return;

    const nextRule = {
      ...currentRule,
      ...updates,
      dueDays: updates.dueDays === undefined ? currentRule.dueDays : Number(updates.dueDays) || 0,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      rulesByWorkspace: {
        ...state.rulesByWorkspace,
        [currentRule.workspaceId]: (state.rulesByWorkspace[currentRule.workspaceId] || []).map((rule) =>
          rule.id === id ? nextRule : rule,
        ),
      },
    }));

    const { error } = await db
      .from("task_automation_rules")
      .update({
        pipeline_id: nextRule.pipelineId,
        stage_id: nextRule.stageId,
        task_title: nextRule.taskTitle.trim(),
        task_description: nextRule.taskDescription?.trim() || null,
        due_days: nextRule.dueDays,
        active: nextRule.active,
        updated_at: nextRule.updatedAt,
      })
      .eq("id", id);

    if (error) console.error("Error updating task automation rule:", error);
  },

  removeRule: async (id) => {
    const currentRule = Object.values(get().rulesByWorkspace)
      .flat()
      .find((rule) => rule.id === id);
    if (!currentRule) return;

    set((state) => ({
      rulesByWorkspace: {
        ...state.rulesByWorkspace,
        [currentRule.workspaceId]: (state.rulesByWorkspace[currentRule.workspaceId] || []).filter((rule) => rule.id !== id),
      },
    }));

    const { error } = await db.from("task_automation_rules").delete().eq("id", id);
    if (error) console.error("Error deleting task automation rule:", error);
  },

  getRules: (workspaceId) => {
    if (!workspaceId) return [];
    return get().rulesByWorkspace[workspaceId] || [];
  },

  getRulesForStage: (workspaceId, pipelineId, stageId) =>
    (get().rulesByWorkspace[workspaceId] || []).filter(
      (rule) => rule.pipelineId === pipelineId && rule.stageId === stageId && rule.active,
    ),
}));
