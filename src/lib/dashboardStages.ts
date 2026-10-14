// Resolução de etapa e probabilidade no Dashboard, quando o filtro abrange MAIS DE UM pipeline.
//
// O defeito que originou este arquivo (medido em produção, 15/09/2026): com "Todos os Pipelines"
// selecionado — o filtro padrão da tela — o Dashboard usava uma lista de etapas fixa em código.
// Nenhuma das probabilidades batia com as cadastradas, duas etapas reais não existiam na lista,
// e o identificador `leads` significa coisas diferentes em cada pipeline. A Receita Prevista
// somava R$ 231 mil onde as probabilidades cadastradas davam R$ 610 mil.
//
// A regra aqui é uma só: a etapa de uma negociação só significa alguma coisa DENTRO do pipeline
// dela. Nada neste arquivo cai numa lista global.

export interface DashboardStage {
  id: string;
  label: string;
  probability: number;
  position: number;
}

/** Etapas carregadas, por id de pipeline. */
export type StagesByPipeline = Record<string, DashboardStage[]>;

export interface StagedDeal {
  stage: string;
  pipelineId?: string;
  value?: number;
}

/**
 * Probabilidade da etapa de uma negociação, lida no pipeline DELA.
 *
 * Devolve 0 quando o pipeline é desconhecido, quando as etapas dele ainda não chegaram, ou quando
 * a etapa não existe nele. O 0 é deliberado: a alternativa seria cair numa lista global, que é
 * exatamente o que produziu o defeito — probabilidade plausível e errada é pior que ausência.
 */
export const resolveDealProbability = (deal: StagedDeal, stagesByPipeline: StagesByPipeline): number => {
  if (!deal.pipelineId) return 0;
  const stages = stagesByPipeline[deal.pipelineId];
  if (!stages) return 0;
  return stages.find((stage) => stage.id === deal.stage)?.probability ?? 0;
};

export interface StageRow {
  /** Rótulo do eixo. Leva o nome do pipeline quando mais de um está à vista. */
  stage: string;
  count: number;
  value: number;
  pipelineId: string;
  pipelineName: string;
  stageId: string;
}

/**
 * Linhas do gráfico "Volume de Oportunidade por Etapa".
 *
 * Cada linha é um par (pipeline, etapa) — nunca uma etapa solta. Com mais de um pipeline à vista,
 * o rótulo ganha o nome do pipeline, porque `leads` é "Novos Leads" no Comercial, "Opt-in" na
 * Nutrição e "Entrega/Assistência" no Pós Venda: sem o nome, três coisas distintas viram uma barra.
 */
export const buildStageRows = (
  deals: StagedDeal[],
  pipelines: { id: string; name: string }[],
  stagesByPipeline: StagesByPipeline,
): StageRow[] => {
  const mostraPipeline = pipelines.length > 1;

  return pipelines.flatMap((pipeline) => {
    const stages = [...(stagesByPipeline[pipeline.id] || [])].sort((a, b) => a.position - b.position);
    return stages.map((stage) => {
      const stageDeals = deals.filter((deal) => deal.pipelineId === pipeline.id && deal.stage === stage.id);
      const rotulo = `${stage.label} (${stage.probability}%)`;
      return {
        stage: mostraPipeline ? `${pipeline.name} · ${rotulo}` : rotulo,
        count: stageDeals.length,
        value: stageDeals.reduce((acc, deal) => acc + (deal.value || 0), 0),
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        stageId: stage.id,
      };
    });
  });
};

/**
 * Catálogo de etapas para os insights, com o pipeline junto pelo mesmo motivo do gráfico:
 * "Etapa com maior perda" precisa dizer de qual funil está falando.
 */
export const buildStageCatalog = (
  pipelines: { id: string; name: string }[],
  stagesByPipeline: StagesByPipeline,
): { id: string; label: string; pipelineId: string }[] => {
  const mostraPipeline = pipelines.length > 1;
  return pipelines.flatMap((pipeline) =>
    (stagesByPipeline[pipeline.id] || []).map((stage) => ({
      id: stage.id,
      label: mostraPipeline ? `${pipeline.name} · ${stage.label}` : stage.label,
      pipelineId: pipeline.id,
    })),
  );
};
