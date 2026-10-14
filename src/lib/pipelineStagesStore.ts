import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { PipelineStage } from "@/lib/dealsStore";
import { defaultPipelineStages, ensurePipelineStages } from "@/lib/pipelineStagesPersistence";
import { normalizeStageColor } from "@/lib/pipelineStageColors";

const db = supabase as any;

type EditableStage = Pick<PipelineStage, "id" | "label" | "probability" | "position" | "color"> & {
  recordId?: string;
};

interface PipelineStagesState {
  stagesByPipeline: Record<string, EditableStage[]>;
  isLoading: boolean;
  fetchStages: (pipelineId: string, workspaceId: string, pipelineName?: string) => Promise<void>;
  addStage: (pipelineId: string, workspaceId: string, stage: Omit<EditableStage, "recordId">) => Promise<void>;
  updateStage: (
    pipelineId: string,
    workspaceId: string,
    stageId: string,
    updates: Partial<Pick<EditableStage, "label" | "probability" | "position" | "color">>,
  ) => Promise<void>;
  removeStage: (pipelineId: string, stageId: string) => Promise<void>;
  reorderStages: (pipelineId: string, workspaceId: string, orderedStageIds: string[]) => Promise<void>;
  getStages: (pipelineId?: string | null, pipelineName?: string) => EditableStage[];
}

const clampProbability = (value?: number) => Math.min(100, Math.max(0, Number(value) || 0));

export const usePipelineStagesStore = create<PipelineStagesState>((set, get) => ({
  stagesByPipeline: {},
  isLoading: false,

  fetchStages: async (pipelineId, workspaceId, pipelineName) => {
    set({ isLoading: true });
    try {
      const stages = await ensurePipelineStages(pipelineId, workspaceId, pipelineName);
      set((state) => ({
        stagesByPipeline: { ...state.stagesByPipeline, [pipelineId]: stages },
        isLoading: false,
      }));
    } catch (error) {
      console.error("Error fetching pipeline stages:", error);
      set((state) => ({
        stagesByPipeline: { ...state.stagesByPipeline, [pipelineId]: defaultPipelineStages(pipelineName) },
        isLoading: false,
      }));
    }
  },

  addStage: async (pipelineId, workspaceId, stage) => {
    const nextStage: EditableStage = {
      ...stage,
      probability: clampProbability(stage.probability),
      color: normalizeStageColor(stage.color, stage.id, stage.label, stage.position),
    };

    set((state) => ({
      stagesByPipeline: {
        ...state.stagesByPipeline,
        [pipelineId]: [...(state.stagesByPipeline[pipelineId] || []), nextStage].sort((a, b) => a.position - b.position),
      },
    }));

    const { data, error } = await db
      .from("crm_pipeline_stages")
      .insert({
        pipeline_id: pipelineId,
        workspace_id: workspaceId,
        stage_id: nextStage.id,
        label: nextStage.label,
        probability: nextStage.probability,
        position: nextStage.position,
        color: nextStage.color,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error adding pipeline stage:", error);
      return;
    }

    set((state) => ({
      stagesByPipeline: {
        ...state.stagesByPipeline,
        [pipelineId]: (state.stagesByPipeline[pipelineId] || []).map((item) =>
          item.id === nextStage.id ? { ...item, recordId: data?.id } : item,
        ),
      },
    }));
  },

  updateStage: async (pipelineId, workspaceId, stageId, updates) => {
    const currentStages = get().getStages(pipelineId);
    const currentStage = currentStages.find((item) => item.id === stageId);
    if (!currentStage) return;

    const nextStage = {
      ...currentStage,
      ...updates,
      probability: updates.probability === undefined ? currentStage.probability : clampProbability(updates.probability),
      color: normalizeStageColor(updates.color === undefined ? currentStage.color : updates.color, stageId, updates.label || currentStage.label, updates.position ?? currentStage.position),
    };

    set((state) => ({
      stagesByPipeline: {
        ...state.stagesByPipeline,
        [pipelineId]: (state.stagesByPipeline[pipelineId] || []).map((item) => (item.id === stageId ? nextStage : item)),
      },
    }));

    const { error } = await db
      .from("crm_pipeline_stages")
      .update({
        workspace_id: workspaceId,
        label: nextStage.label,
        probability: nextStage.probability,
        position: nextStage.position,
        color: nextStage.color,
        updated_at: new Date().toISOString(),
      })
      .eq("pipeline_id", pipelineId)
      .eq("stage_id", stageId);

    if (error) console.error("Error updating pipeline stage:", error);
  },

  removeStage: async (pipelineId, stageId) => {
    set((state) => ({
      stagesByPipeline: {
        ...state.stagesByPipeline,
        [pipelineId]: (state.stagesByPipeline[pipelineId] || []).filter((stage) => stage.id !== stageId),
      },
    }));

    const { error } = await db
      .from("crm_pipeline_stages")
      .delete()
      .eq("pipeline_id", pipelineId)
      .eq("stage_id", stageId);

    if (error) console.error("Error deleting pipeline stage:", error);
  },

  reorderStages: async (pipelineId, workspaceId, orderedStageIds) => {
    const stages = get().getStages(pipelineId);
    const reordered = orderedStageIds
      .map((stageId, index) => {
        const stage = stages.find((item) => item.id === stageId);
        return stage ? { ...stage, position: index + 1 } : null;
      })
      .filter((item): item is EditableStage => !!item);

    set((state) => ({
      stagesByPipeline: {
        ...state.stagesByPipeline,
        [pipelineId]: reordered,
      },
    }));

    const payload = reordered.map((stage) => ({
      pipeline_id: pipelineId,
      workspace_id: workspaceId,
      stage_id: stage.id,
      label: stage.label,
      probability: stage.probability,
      position: stage.position,
      color: normalizeStageColor(stage.color, stage.id, stage.label, stage.position),
      is_active: true,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await db.from("crm_pipeline_stages").upsert(payload, {
      onConflict: "pipeline_id,stage_id",
    });

    if (error) console.error("Error reordering pipeline stages:", error);
  },

  getStages: (pipelineId, pipelineName) => {
    if (!pipelineId) return defaultPipelineStages(pipelineName);
    return get().stagesByPipeline[pipelineId] || defaultPipelineStages(pipelineName);
  },
}));
