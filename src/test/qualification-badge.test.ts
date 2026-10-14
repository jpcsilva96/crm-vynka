import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getQualificationBadgeTone } from "@/lib/qualificationBadge";

/**
 * Selo de qualificação no tema escuro (23/09/2026). Contraste medido no app sobre o fundo do card
 * rgb(37,29,53): antes 1,33 a 2,44 nos cinco tons (mínimo recomendado 4,5); depois 7,03 a 8,73.
 */
const CLASSIFICATIONS = ["Lead Prioritário", "Lead Qualificado", "Lead Nutrição", "Lead Descartado"];

describe("getQualificationBadgeTone", () => {
  it.each([...CLASSIFICATIONS, undefined, "classificação desconhecida"])("%s tem texto claro no tema escuro", (classification) => {
    const tone = getQualificationBadgeTone(classification);
    expect(tone).toMatch(/dark:text-\w+-300/);
    expect(tone).toMatch(/dark:bg-\w+-500\/20/);
    // o tom claro continua o de antes
    expect(tone).toMatch(/(^| )text-\w+-700( |$)/);
  });

  it("cada classificação mantém a sua cor", () => {
    expect(getQualificationBadgeTone("Lead Prioritário")).toContain("fuchsia");
    expect(getQualificationBadgeTone("Lead Qualificado")).toContain("emerald");
    expect(getQualificationBadgeTone("Lead Nutrição")).toContain("sky");
    expect(getQualificationBadgeTone("Lead Descartado")).toContain("slate");
    expect(getQualificationBadgeTone(undefined)).toContain("amber");
  });
});

// Cores unificadas pelo Kanban (decisão do operador, 23/09/2026): antes o Prioritário era fúcsia
// no card e nos detalhes, mas verde na visão em lista e na lista de contatos.
describe("as quatro telas usam a mesma regra", () => {
  const read = (file: string) => readFileSync(path.resolve(__dirname, "..", file), "utf8");

  it.each([
    "components/pipeline/DealCard.tsx",
    "components/pipeline/DealView.tsx",
    "pages/Pipeline.tsx",
    "components/pipeline/GlobalContactsList.tsx",
  ])("%s", (file) => {
    const source = read(file);
    expect(source).toContain('import { getQualificationBadgeTone } from "@/lib/qualificationBadge";');
    // a cópia local (só com o tom claro) não pode voltar
    expect(source).not.toMatch(/(function|const) getQualificationBadgeTone/);
  });

  it("visão em lista: o selo pega a cor da regra, não de uma tabela própria", () => {
    const source = read("pages/Pipeline.tsx");
    expect(source).toContain("getQualificationBadgeTone(qualification)");
    expect(source).not.toMatch(/"Lead (Prioritário|Qualificado|Nutrição|Descartado)": {[^}]*color:/);
  });

  it("lista de contatos: o selo pega a cor da regra", () => {
    const source = read("components/pipeline/GlobalContactsList.tsx");
    expect(source).toContain("${getQualificationBadgeTone(classification)}");
    expect(source).not.toContain('classification === "Lead Prioritário"');
  });
});
