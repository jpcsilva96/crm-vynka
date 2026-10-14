import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildStageCatalog,
  buildStageRows,
  resolveDealProbability,
  type StagesByPipeline,
} from "@/lib/dashboardStages";

// Fixture anonimizada, mas com a FORMA do defeito medido em produção (15/09): o identificador
// `leads` existe em três pipelines e significa coisas diferentes em cada um, e nenhuma
// probabilidade coincide com a lista que estava fixa em código (leads 10, qualification 35...).
const COMERCIAL = "pipe-comercial";
const NUTRICAO = "pipe-nutricao";
const IA = "pipe-ia";

const pipelines = [
  { id: COMERCIAL, name: "Funil A" },
  { id: NUTRICAO, name: "Funil B" },
  { id: IA, name: "Funil C" },
];

const stagesByPipeline: StagesByPipeline = {
  [COMERCIAL]: [
    { id: "leads", label: "Novos Leads", probability: 0, position: 1 },
    { id: "qualification", label: "Qualificação", probability: 5, position: 2 },
    { id: "vitrine", label: "Vitrine de Produtos", probability: 10, position: 3 },
    { id: "closing", label: "Fechamento", probability: 100, position: 4 },
  ],
  [NUTRICAO]: [{ id: "leads", label: "Opt-in", probability: 0, position: 1 }],
  [IA]: [{ id: "lead_ia", label: "Novo Lead", probability: 10, position: 1 }],
};

describe("probabilidade da etapa vem do pipeline da própria negociação", () => {
  it("o mesmo identificador em pipelines diferentes pode ter probabilidades diferentes", () => {
    const stages: StagesByPipeline = {
      [COMERCIAL]: [{ id: "qualification", label: "Qualificação", probability: 5, position: 1 }],
      [IA]: [{ id: "qualification", label: "Qualificação", probability: 45, position: 1 }],
    };
    expect(resolveDealProbability({ stage: "qualification", pipelineId: COMERCIAL }, stages)).toBe(5);
    expect(resolveDealProbability({ stage: "qualification", pipelineId: IA }, stages)).toBe(45);
  });

  it("lê a probabilidade cadastrada, não a de uma lista global", () => {
    // a lista que estava fixa em código dava 10 para "leads" e 35 para "qualification"
    expect(resolveDealProbability({ stage: "leads", pipelineId: COMERCIAL }, stagesByPipeline)).toBe(0);
    expect(resolveDealProbability({ stage: "qualification", pipelineId: COMERCIAL }, stagesByPipeline)).toBe(5);
    // e "vitrine" nem existia nessa lista: entrava com 0 e sumia da soma
    expect(resolveDealProbability({ stage: "vitrine", pipelineId: COMERCIAL }, stagesByPipeline)).toBe(10);
    // "closing" caía num segundo padrão global, que dizia 95
    expect(resolveDealProbability({ stage: "closing", pipelineId: COMERCIAL }, stagesByPipeline)).toBe(100);
  });

  it("devolve 0 — e não um palpite — quando não dá para saber", () => {
    expect(resolveDealProbability({ stage: "leads" }, stagesByPipeline)).toBe(0);
    expect(resolveDealProbability({ stage: "leads", pipelineId: "pipe-inexistente" }, stagesByPipeline)).toBe(0);
    expect(resolveDealProbability({ stage: "etapa-apagada", pipelineId: COMERCIAL }, stagesByPipeline)).toBe(0);
  });

  it("a soma ponderada muda de valor com a correção", () => {
    const abertas = [
      { stage: "vitrine", pipelineId: COMERCIAL, value: 1000 },
      { stage: "qualification", pipelineId: COMERCIAL, value: 1000 },
      { stage: "lead_ia", pipelineId: IA, value: 1000 },
    ];
    const previsto = abertas.reduce(
      (acc, deal) => acc + deal.value * (resolveDealProbability(deal, stagesByPipeline) / 100),
      0,
    );
    // cadastrado: 10% + 5% + 10% = R$ 250. A lista fixa dava 0% + 35% + 0% = R$ 350.
    expect(previsto).toBe(250);
  });
});

describe("linhas do gráfico por etapa", () => {
  it("com um pipeline só, o rótulo não carrega o nome do pipeline", () => {
    const rows = buildStageRows(
      [{ stage: "leads", pipelineId: COMERCIAL, value: 100 }],
      [pipelines[0]],
      stagesByPipeline,
    );
    expect(rows.map((row) => row.stage)).toEqual([
      "Novos Leads (0%)",
      "Qualificação (5%)",
      "Vitrine de Produtos (10%)",
      "Fechamento (100%)",
    ]);
  });

  it("não mistura negociação de outro pipeline na etapa de mesmo identificador", () => {
    const deals = [
      { stage: "leads", pipelineId: COMERCIAL, value: 100 },
      { stage: "leads", pipelineId: NUTRICAO, value: 999 },
    ];
    const rows = buildStageRows(deals, [pipelines[0]], stagesByPipeline);
    const novosLeads = rows.find((row) => row.stageId === "leads");
    expect(novosLeads?.count).toBe(1);
    expect(novosLeads?.value).toBe(100);
  });

  it("com mais de um pipeline à vista, o rótulo diz de qual funil é", () => {
    const rows = buildStageRows([], pipelines, stagesByPipeline);
    expect(rows.map((row) => row.stage)).toContain("Funil A · Novos Leads (0%)");
    expect(rows.map((row) => row.stage)).toContain("Funil B · Opt-in (0%)");
  });

  it("respeita a ordem cadastrada das etapas", () => {
    const desordenado: StagesByPipeline = {
      [COMERCIAL]: [
        { id: "b", label: "Segunda", probability: 50, position: 2 },
        { id: "a", label: "Primeira", probability: 10, position: 1 },
      ],
    };
    expect(buildStageRows([], [pipelines[0]], desordenado).map((row) => row.stageId)).toEqual(["a", "b"]);
  });

  it("pipeline sem etapas carregadas não quebra nem inventa linha", () => {
    expect(buildStageRows([], [{ id: "pipe-vazio", name: "Vazio" }], stagesByPipeline)).toEqual([]);
  });
});

describe("catálogo de etapas dos insights", () => {
  it("carrega o pipeline de cada etapa, para contar a perda no funil certo", () => {
    const catalogo = buildStageCatalog(pipelines, stagesByPipeline);
    const leads = catalogo.filter((stage) => stage.id === "leads");
    expect(leads).toHaveLength(2);
    expect(leads.map((stage) => stage.pipelineId).sort()).toEqual([COMERCIAL, NUTRICAO].sort());
    expect(leads.map((stage) => stage.label)).toContain("Funil A · Novos Leads");
  });

  it("com um pipeline só, o rótulo fica limpo", () => {
    expect(buildStageCatalog([pipelines[1]], stagesByPipeline)[0].label).toBe("Opt-in");
  });
});

// A decisão de 15/09 é que o gráfico por etapa EXIGE um pipeline. Sem este contrato, voltar a
// desenhá-lo com "Todos os Pipelines" passa despercebido: a lógica acima continua correta, e é a
// tela que volta a somar funis incomparáveis.
describe("contrato: o gráfico por etapa exige um pipeline escolhido", () => {
  const tela = readFileSync(resolve(__dirname, "../components/pipeline/PipelineDashboard.tsx"), "utf8");

  it("as linhas do gráfico só são montadas com um pipeline selecionado", () => {
    expect(tela).toContain("selectedPipeline ? buildStageRows(filteredDeals, [selectedPipeline], stagesByPipeline) : []");
  });

  it("sem pipeline, a tela mostra o pedido de escolha no lugar do gráfico", () => {
    expect(tela).toContain("{!selectedPipeline ? (");
    expect(tela).toContain("Escolha um pipeline no filtro");
  });

  it("a Receita Prevista pesa cada negociação pelo pipeline dela", () => {
    expect(tela).toContain("resolveDealProbability(deal, stagesByPipeline)");
    // e não sobrou nenhuma leitura pela lista global
    expect(tela).not.toContain("getStageProbability");
  });

  it("as etapas de todos os pipelines do workspace são carregadas, não só as do selecionado", () => {
    expect(tela).toContain("for (const pipeline of workspacePipelines) {");
    expect(tela).toContain("fetchStages(pipeline.id, activeWorkspaceId, pipeline.name)");
  });
});
