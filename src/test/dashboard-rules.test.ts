import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DASHBOARD_RULES, getDashboardRule, type DashboardRuleId } from "@/lib/dashboardRules";

const dashboardSource = readFileSync(
  resolve(__dirname, "../components/pipeline/PipelineDashboard.tsx"),
  "utf8",
);

/** Todo `ruleId="..."` escrito na tela, na ordem em que aparece. */
const ruleIdsNaTela = [...dashboardSource.matchAll(/ruleId="([a-z-]+)"/g)].map((match) => match[1]);

const CARDS: DashboardRuleId[] = [
  "pipeline-value",
  "won-value",
  "lost-value",
  "total-deals",
  "conversion-rate",
  "conversion-value",
  "average-ticket",
  "average-closing-time",
  "forecast-revenue",
];

const GRAFICOS: DashboardRuleId[] = ["stage-volume", "deals-evolution", "outcome-split", "loss-reasons"];

describe("catálogo de regras do Dashboard", () => {
  it("tem os 9 cards, os 4 gráficos e o filtro de período", () => {
    expect(Object.keys(DASHBOARD_RULES).sort()).toEqual([...CARDS, ...GRAFICOS, "period-filter"].sort());
  });

  it("toda regra tem título e ao menos um parágrafo, sem texto vazio", () => {
    for (const [id, rule] of Object.entries(DASHBOARD_RULES)) {
      expect(rule.title.trim(), `título vazio em ${id}`).not.toBe("");
      expect(rule.paragraphs.length, `${id} sem parágrafo`).toBeGreaterThan(0);
      for (const paragraph of rule.paragraphs) {
        // texto curto demais não explica regra nenhuma: é rótulo repetido
        expect(paragraph.trim().length, `parágrafo curto em ${id}`).toBeGreaterThan(40);
      }
    }
  });

  it("getDashboardRule devolve a regra pedida", () => {
    expect(getDashboardRule("average-ticket")).toBe(DASHBOARD_RULES["average-ticket"]);
  });
});

describe("cada card e gráfico está ligado à sua regra", () => {
  it("a tela usa exatamente as 14 regras, uma vez cada", () => {
    expect(ruleIdsNaTela).toHaveLength(14);
    expect([...new Set(ruleIdsNaTela)]).toHaveLength(14);
  });

  it("nenhum ruleId da tela aponta para regra inexistente", () => {
    for (const id of ruleIdsNaTela) {
      expect(DASHBOARD_RULES, `ruleId "${id}" não existe no catálogo`).toHaveProperty(id);
    }
  });

  it.each([...CARDS, ...GRAFICOS])("a regra %s aparece na tela", (id) => {
    expect(ruleIdsNaTela).toContain(id);
  });

  it("o i do período fica no filtro, não dentro de um card", () => {
    expect(dashboardSource).toMatch(/Período\s*\n\s*<DashboardRuleInfo ruleId="period-filter" \/>/);
  });
});

// O valor deste lote não é o "i" aparecer: é o texto contar a regra REAL, inclusive quando ela
// é inconveniente. Cada asserção abaixo guarda uma ressalva que foi medida no cálculo — se
// alguém suavizar o texto, o teste cai.
describe("o texto descreve a regra como ela é, com as ressalvas medidas", () => {
  const texto = (id: DashboardRuleId) => DASHBOARD_RULES[id].paragraphs.join(" ");

  it("o período admite que usa datas diferentes conforme a situação", () => {
    expect(texto("period-filter")).toContain("previsão de fechamento");
    expect(texto("period-filter")).toContain("última alteração");
  });

  it("as duas conversões avisam que as abertas entram no denominador", () => {
    expect(texto("conversion-rate")).toContain("abertas entram no total");
    expect(texto("conversion-value")).toContain("abertas entra no total");
  });

  it("o tempo médio admite que não há data de ganho gravada", () => {
    expect(texto("average-closing-time")).toContain("não guarda a data em que a negociação foi ganha");
  });

  it("a receita prevista explica a multiplicação pela probabilidade da etapa", () => {
    expect(texto("forecast-revenue")).toContain("probabilidade da etapa");
  });

  // O defeito que estes dois textos descreviam foi CORRIGIDO em 15/09 (ver dashboardStages.ts).
  // As asserções mudaram de lado junto com o comportamento: agora exigem que o texto prometa a
  // probabilidade do pipeline da própria negociação, e não mais que avise sobre a lista fixa.
  it("a receita prevista promete a probabilidade lida no pipeline da própria negociação", () => {
    expect(texto("forecast-revenue")).toContain("lida no pipeline da própria negociação");
    expect(texto("forecast-revenue")).toContain("inclusive com “Todos os Pipelines”");
    expect(texto("forecast-revenue")).toContain("entra com 0%");
  });

  it("o volume por etapa diz que exige um pipeline, e por quê", () => {
    expect(texto("stage-volume")).toContain("exige um pipeline escolhido no filtro");
    expect(texto("stage-volume")).toContain("não é desenhado");
    expect(texto("stage-volume")).toContain("não são comparáveis");
  });

  it("nenhum texto ainda promete a lista padrão, que deixou de ser usada", () => {
    for (const rule of Object.values(DASHBOARD_RULES)) {
      expect(rule.paragraphs.join(" ")).not.toContain("lista padrão");
    }
  });

  it("a evolução admite que ganhas e perdidas usam a data da última alteração", () => {
    expect(texto("deals-evolution")).toContain("última alteração");
  });

  it("os motivos de perda dizem para onde vai a perda sem motivo", () => {
    expect(texto("loss-reasons")).toContain("Outros");
  });
});
