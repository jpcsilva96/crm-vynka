import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { dealDetailPath, dealListPath, dealOriginFromPath } from "@/lib/dealDetailRoute";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * A regra que decide de onde a negociação foi aberta e para onde o "Voltar" devolve.
 *
 * Vive fora do componente porque o defeito original era exatamente uma decisão presa no JSX:
 * `navigate("/pipeline")` fixo, que mandava ao Kanban quem tinha vindo da Tarefas.
 */
describe("origem da negociação, lida da rota", () => {
  it("a lista de tarefas e seus filhos são Tarefas", () => {
    expect(dealOriginFromPath("/tasks")).toBe("tasks");
    expect(dealOriginFromPath("/tasks/abc-123")).toBe("tasks");
  });

  it("Kanban, contatos e empresas caem no pipeline", () => {
    expect(dealOriginFromPath("/pipeline")).toBe("pipeline");
    expect(dealOriginFromPath("/pipeline/abc-123")).toBe("pipeline");
    expect(dealOriginFromPath("/contacts")).toBe("pipeline");
    expect(dealOriginFromPath("/companies/xyz")).toBe("pipeline");
  });

  it("prefixo parecido não é Tarefas: só /tasks e /tasks/…", () => {
    // Sem a barra, `startsWith("/tasks")` casaria com uma rota futura tipo /tasksboard e mandaria
    // o voltar para uma lista que não é a de origem.
    expect(dealOriginFromPath("/tasksboard")).toBe("pipeline");
    expect(dealOriginFromPath("/tasks-arquivadas")).toBe("pipeline");
  });
});

describe("para onde o fechar devolve", () => {
  it("devolve à lista da origem", () => {
    expect(dealListPath("tasks")).toBe("/tasks");
    expect(dealListPath("pipeline")).toBe("/pipeline");
  });

  it("preserva o recorte da URL — o Dashboard abre a Tarefas com ?filter=overdue", () => {
    expect(dealListPath("tasks", "?filter=overdue")).toBe("/tasks?filter=overdue");
  });
});

describe("rota do detalhe", () => {
  it("fica dentro da aba de origem, para a lista não desmontar atrás do modal", () => {
    expect(dealDetailPath("tasks", "abc-123")).toBe("/tasks/abc-123");
    expect(dealDetailPath("pipeline", "abc-123")).toBe("/pipeline/abc-123");
  });

  it("leva o recorte junto na ida", () => {
    expect(dealDetailPath("tasks", "abc-123", "?filter=overdue")).toBe("/tasks/abc-123?filter=overdue");
  });

  it("ida e volta fecham o ciclo na mesma lista", () => {
    const search = "?filter=overdue";
    const detalhe = dealDetailPath("tasks", "abc-123", search);
    expect(dealListPath(dealOriginFromPath("/tasks/abc-123"), search)).toBe("/tasks?filter=overdue");
    expect(detalhe.startsWith("/tasks/")).toBe(true);
  });
});

/**
 * Contrato TEXTUAL da fiação — e com a ressalva do RULES §15: ele prova o que foi escrito, não o
 * que ficou de fora. A regra pura acima está testada de verdade; isto aqui só impede que o
 * `Pipeline.tsx` volte a decidir a rota no JSX, que era a forma original do defeito.
 */
describe("contrato: a tela usa a regra, não recria a decisão", () => {
  // Normaliza a quebra de linha: o repo é clonado com CRLF no Windows, e uma asserção de várias
  // linhas com `\n` daria falso negativo aqui e falso positivo em quem clonasse com LF.
  const readSource = (path: string) => readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n");
  const pipeline = readSource("src/pages/Pipeline.tsx");
  const routes = readSource("src/pages/Index.tsx");

  it("a rota do detalhe dentro da aba Tarefas existe", () => {
    expect(routes).toContain('path="/tasks/:dealId"');
    expect(routes).toContain('path="/tasks"');
  });

  it("a Tarefas abre a negociação em MODAL, para a lista não desmontar atrás", () => {
    expect(pipeline).toContain('<GlobalTasksList onOpenDeal={(dealId) => openDealDetails(dealId, "modal")}');
  });

  it("fechar deriva a rota, em vez de apontar /pipeline na unha", () => {
    expect(pipeline).toContain("navigate(dealListPath(dealOrigin, location.search))");
    expect(pipeline).not.toContain('navigate("/pipeline");');
  });

  it("expandir troca o MODO e mantem a rota da origem", () => {
    // Faltava: um mutante apontando o expandir de volta para /pipeline/:dealId nao quebrava nada,
    // e é por ali que o defeito voltaria — Tarefas, modal, expandir, e o Voltar cai no Kanban.
    expect(pipeline).toContain(
      [
        "      navigate(dealDetailPath(dealOrigin, dealId, location.search), {",
        "        replace: true,",
        '        state: { dealMode: "page" },',
        "      });",
      ].join("\n"),
    );
  });

  it("o voltar do contato carrega a negociação da origem certa", () => {
    expect(pipeline).not.toContain("from: `/pipeline/${selectedDeal.id}`");
    expect(pipeline).toContain("from: dealDetailPath(dealOrigin, selectedDeal.id, location.search)");
  });
});
