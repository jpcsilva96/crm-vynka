import type { PipelineStage } from "@/lib/dealsStore";
import { supabase } from "@/integrations/supabase/client";
import { buildDefaultStagesForPipeline } from "@/lib/crmPipelinesStore";
import { normalizeStageColor } from "@/lib/pipelineStageColors";

const db = supabase as any;

export type PersistedPipelineStage = Pick<PipelineStage, "id" | "label" | "probability" | "position"> & {
  recordId?: string;
  pipelineId?: string;
  color?: string;
};

const clampProbability = (value?: number) => Math.min(100, Math.max(0, Number(value) || 0));
const defaultStagesCache = new Map<string, PersistedPipelineStage[]>();

export const mapPipelineStageRow = (row: any): PersistedPipelineStage => ({
  recordId: row.id,
  pipelineId: row.pipeline_id,
  id: row.stage_id,
  label: row.label,
  probability: clampProbability(row.probability),
  position: Number(row.position) || 0,
  color: normalizeStageColor(row.color, row.stage_id, row.label, Number(row.position) || 0),
});

export const defaultPipelineStages = (pipelineName?: string): PersistedPipelineStage[] => {
  const cacheKey = pipelineName || "__default__";
  const cached = defaultStagesCache.get(cacheKey);
  if (cached) return cached;

  const stages = buildDefaultStagesForPipeline(pipelineName).map((stage) => ({ ...stage }));
  defaultStagesCache.set(cacheKey, stages);
  return stages;
};

export async function ensurePipelineStages(
  pipelineId: string,
  workspaceId: string,
  pipelineName?: string,
): Promise<PersistedPipelineStage[]> {
  const { data, error } = await db
    .from("crm_pipeline_stages")
    .select("*")
    .eq("pipeline_id", pipelineId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("position", { ascending: true });

  if (error) throw error;

  if (data && data.length > 0) {
    return data.map(mapPipelineStageRow);
  }

  const seeded = defaultPipelineStages(pipelineName);
  const { error: upsertError } = await db.from("crm_pipeline_stages").insert(
    seeded.map((stage) => ({
      pipeline_id: pipelineId,
      workspace_id: workspaceId,
      stage_id: stage.id,
      label: stage.label,
      probability: stage.probability,
      position: stage.position,
      color: stage.color,
      is_active: true,
    })),
  );

  if (upsertError) throw upsertError;

  return seeded;
}

export async function ensureWorkspacePipelineStages(workspaceId: string): Promise<PersistedPipelineStage[]> {
  const ensurePipeline = async (name: string, description: string) => {
    const { data: existing } = await db
      .from("crm_pipelines")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("name", name)
      .maybeSingle();

    if (existing?.id) return existing;

    const { data, error } = await db
      .from("crm_pipelines")
      .insert({
        workspace_id: workspaceId,
        name,
        description,
        is_active: true,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  };

  const commercialPipeline = await ensurePipeline("Pipeline Comercial", "Pipeline padrao para novas negociacoes do workspace.");
  await ensurePipeline("Pipeline IA", "Pipeline dedicado ao processo de vendas assistido por IA.");

  return ensurePipelineStages(commercialPipeline.id, workspaceId, commercialPipeline.name);
}
