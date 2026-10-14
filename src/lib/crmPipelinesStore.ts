import { create } from "zustand";
import { getWorkspaceHeader, supabase, setWorkspaceHeader } from "@/integrations/supabase/client";
import { getDefaultStageColor } from "@/lib/pipelineStageColors";

export interface CRMPipeline {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CRMPipelineStageTemplate {
  id: string;
  label: string;
  probability: number;
  position: number;
  color: string;
}

const PIPELINE_TEMPLATES: Record<string, CRMPipelineStageTemplate[]> = {
  "Pipeline IA": [
    { id: "lead_ia", label: "Novo Lead", probability: 10, position: 1, color: getDefaultStageColor("lead_ia", "Novo Lead", 0) },
    { id: "contact_started", label: "Contato Iniciado", probability: 25, position: 2, color: getDefaultStageColor("contact_started", "Contato Iniciado", 1) },
    { id: "qualification", label: "Qualificacao", probability: 45, position: 3, color: getDefaultStageColor("qualification", "Qualificacao", 2) },
    { id: "proposal", label: "Proposta", probability: 70, position: 4, color: getDefaultStageColor("proposal", "Proposta", 3) },
    { id: "negotiation", label: "Negociacao", probability: 85, position: 5, color: getDefaultStageColor("negotiation", "Negociacao", 4) },
  ],
  "Pipeline Comercial": [
    { id: "leads", label: "Lead Comercial", probability: 10, position: 1, color: getDefaultStageColor("leads", "Lead Comercial", 0) },
    { id: "qualification", label: "Qualificacao", probability: 35, position: 2, color: getDefaultStageColor("qualification", "Qualificacao", 1) },
    { id: "proposal", label: "Proposta", probability: 60, position: 3, color: getDefaultStageColor("proposal", "Proposta", 2) },
    { id: "negotiation", label: "Negociacao", probability: 80, position: 4, color: getDefaultStageColor("negotiation", "Negociacao", 3) },
  ],
};

export const buildDefaultStagesForPipeline = (pipelineName?: string): CRMPipelineStageTemplate[] => {
  const template = (pipelineName && PIPELINE_TEMPLATES[pipelineName]) || PIPELINE_TEMPLATES["Pipeline Comercial"];
  return template.map((stage) => ({ ...stage }));
};

const mapPipelineRow = (row: any): CRMPipeline => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name,
  description: row.description || undefined,
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at || undefined,
});

const DEFAULT_PIPELINES = [
  {
    name: "Pipeline Comercial",
    description: "Pipeline padrao para novas negociacoes do workspace.",
  },
  {
    name: "Pipeline IA",
    description: "Pipeline dedicado ao processo de vendas assistido por IA.",
  },
];

const EMPTY_PIPELINES: CRMPipeline[] = [];

const createPipelineWithStages = async (workspaceId: string, name: string, description?: string, isActive = true) => {
  const { data, error } = await (supabase as any)
    .from("crm_pipelines")
    .insert({
      workspace_id: workspaceId,
      name: name.trim(),
      description: description?.trim() || null,
      is_active: isActive,
    })
    .select("*")
    .single();

  if (error) throw error;

  const pipeline = mapPipelineRow(data);
  const defaultStages = buildDefaultStagesForPipeline(pipeline.name);

  const { error: stagesError } = await (supabase as any).from("crm_pipeline_stages").insert(
    defaultStages.map((stage) => ({
      pipeline_id: pipeline.id,
      workspace_id: workspaceId,
      stage_id: stage.id,
      label: stage.label,
      probability: stage.probability,
      position: stage.position,
      color: stage.color,
      is_active: true,
    })),
  );

  if (stagesError) throw stagesError;

  return pipeline;
};

const ensureDefaultPipelines = async (workspaceId: string, existingRows: any[]) => {
  const existingNames = new Set((existingRows || []).map((row) => row.name));
  const missingPipelines = DEFAULT_PIPELINES.filter((pipeline) => !existingNames.has(pipeline.name));

  if (missingPipelines.length === 0) return;

  for (const pipeline of missingPipelines) {
    try {
      await createPipelineWithStages(workspaceId, pipeline.name, pipeline.description, true);
    } catch (error) {
      console.error(`Error ensuring default pipeline "${pipeline.name}":`, error);
    }
  }
};

interface PipelinesState {
  pipelinesByWorkspace: Record<string, CRMPipeline[]>;
  isLoading: boolean;
  fetchPipelines: (workspaceId: string) => Promise<void>;
  addPipeline: (input: { workspaceId: string; name: string; description?: string; isActive?: boolean }) => Promise<CRMPipeline>;
  updatePipeline: (id: string, updates: Partial<Pick<CRMPipeline, "name" | "description" | "isActive">>) => Promise<void>;
  deletePipeline: (id: string) => Promise<void>;
  getPipelines: (workspaceId?: string | null) => CRMPipeline[];
  getPipelineById: (pipelineId?: string | null) => CRMPipeline | undefined;
}

export const useCRMPipelinesStore = create<PipelinesState>((set, get) => ({
  pipelinesByWorkspace: {},
  isLoading: false,

  fetchPipelines: async (workspaceId) => {
    set({ isLoading: true });
    const previousWorkspaceHeader = getWorkspaceHeader();

    setWorkspaceHeader(workspaceId);

    const { data, error } = await (supabase as any)
      .from("crm_pipelines")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching pipelines:", error);
      set({ isLoading: false });
      setWorkspaceHeader(previousWorkspaceHeader);
      return;
    }

    await ensureDefaultPipelines(workspaceId, data || []);

    const { data: refreshedData, error: refreshedError } = await (supabase as any)
      .from("crm_pipelines")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (refreshedError) {
      console.error("Error refreshing pipelines:", refreshedError);
      set({ isLoading: false });
      setWorkspaceHeader(previousWorkspaceHeader);
      return;
    }

    set((state) => ({
      pipelinesByWorkspace: {
        ...state.pipelinesByWorkspace,
        [workspaceId]: (refreshedData || []).map(mapPipelineRow),
      },
      isLoading: false,
    }));

    setWorkspaceHeader(previousWorkspaceHeader);
  },

  addPipeline: async ({ workspaceId, name, description, isActive = true }) => {
    const pipeline = await createPipelineWithStages(workspaceId, name, description, isActive);

    set((state) => ({
      pipelinesByWorkspace: {
        ...state.pipelinesByWorkspace,
        [workspaceId]: [...(state.pipelinesByWorkspace[workspaceId] || []), pipeline],
      },
    }));

    return pipeline;
  },

  updatePipeline: async (id, updates) => {
    const currentPipeline = get().getPipelineById(id);
    if (!currentPipeline) return;

    set((state) => ({
      pipelinesByWorkspace: {
        ...state.pipelinesByWorkspace,
        [currentPipeline.workspaceId]: (state.pipelinesByWorkspace[currentPipeline.workspaceId] || []).map((pipeline) =>
          pipeline.id === id
            ? {
                ...pipeline,
                ...updates,
                updatedAt: new Date().toISOString(),
              }
            : pipeline,
        ),
      },
    }));

    const { error } = await (supabase as any)
      .from("crm_pipelines")
      .update({
        name: updates.name?.trim(),
        description: updates.description?.trim() || null,
        is_active: updates.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) console.error("Error updating pipeline:", error);
  },

  deletePipeline: async (id) => {
    const pipeline = get().getPipelineById(id);
    if (!pipeline) return;

    set((state) => ({
      pipelinesByWorkspace: {
        ...state.pipelinesByWorkspace,
        [pipeline.workspaceId]: (state.pipelinesByWorkspace[pipeline.workspaceId] || []).filter((item) => item.id !== id),
      },
    }));

    const { error } = await (supabase as any).from("crm_pipelines").delete().eq("id", id);
    if (error) console.error("Error deleting pipeline:", error);
  },

  getPipelines: (workspaceId) => {
    if (!workspaceId) return EMPTY_PIPELINES;
    return get().pipelinesByWorkspace[workspaceId] || EMPTY_PIPELINES;
  },

  getPipelineById: (pipelineId) => {
    if (!pipelineId) return undefined;
    const workspaces = Object.values(get().pipelinesByWorkspace);
    return workspaces.flat().find((pipeline) => pipeline.id === pipelineId);
  },
}));
