import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEAL_STATUS_BADGE_CLASS, DEAL_STATUS_LABEL, getDealStatus } from "@/lib/dealStatus";

/**
 * Situação da negociação nas telas de empresa e contato (23/09/2026). Marcar como ganha/perdida
 * grava `outcome` e deixa a etapa onde estava; as telas liam só a etapa e mostravam
 * "Em andamento" para negociação já fechada.
 */
describe("getDealStatus", () => {
  it("o caso relatado: marcada como ganha ou perdida, etapa intacta", () => {
    expect(getDealStatus({ outcome: "won", stage: "proposal" })).toBe("won");
    expect(getDealStatus({ outcome: "lost", stage: "leads" })).toBe("lost");
  });

  it("negociação aberta é em andamento", () => {
    expect(getDealStatus({ outcome: null, stage: "proposal" })).toBe("open");
    expect(getDealStatus({ outcome: undefined, stage: "leads" })).toBe("open");
  });

  it("etapa won/lost continua valendo para negociações antigas sem outcome", () => {
    expect(getDealStatus({ outcome: null, stage: "won" })).toBe("won");
    expect(getDealStatus({ outcome: null, stage: "lost" })).toBe("lost");
  });

  it("outcome manda sobre a etapa", () => {
    expect(getDealStatus({ outcome: "lost", stage: "won" })).toBe("lost");
    expect(getDealStatus({ outcome: "won", stage: "lost" })).toBe("won");
  });

  it("cada situação tem cor própria: verde ganha, vermelho perdida, azul em andamento", () => {
    expect(DEAL_STATUS_BADGE_CLASS.won).toContain("emerald");
    expect(DEAL_STATUS_BADGE_CLASS.lost).toContain("red");
    // o rosa da marca (primary) se confunde com o vermelho da perdida
    expect(DEAL_STATUS_BADGE_CLASS.open).toContain("blue");
    expect(DEAL_STATUS_BADGE_CLASS.open).not.toContain("primary");
    expect(new Set(Object.values(DEAL_STATUS_BADGE_CLASS)).size).toBe(3);
  });

  it("os rótulos da tela", () => {
    expect(DEAL_STATUS_LABEL).toEqual({ won: "Ganha", lost: "Perdida", open: "Em andamento" });
  });
});

// RULES.md §15: a regra certa não adianta se a tela seguir lendo só a etapa.
describe("empresa e contato usam a regra única", () => {
  const read = (file: string) => readFileSync(path.resolve(__dirname, "../components/pipeline", file), "utf8");

  it.each(["CompanyView.tsx", "ContactView.tsx"])("%s", (file) => {
    const source = read(file);
    // o selo da aba Outras Negociações
    expect(source).toContain("{DEAL_STATUS_LABEL[getDealStatus(deal)]}");
    // e a cor do selo sai da mesma situação
    expect(source).toContain("DEAL_STATUS_BADGE_CLASS[getDealStatus(deal)]");
    // nenhuma conta ou selo decide a situação só pela etapa
    expect(source).not.toMatch(/stage\s*[!=]==\s*["'](won|lost)["']/);
  });

  it("a tabela Performance por empresa do contato separa pela regra única", () => {
    const source = read("ContactView.tsx");
    const block = source.slice(source.indexOf("const performancePorEmpresa"), source.indexOf("}, [contactCompanies, contactDeals]);"));
    expect(block).toContain('getDealStatus(d) === "won"');
    expect(block).toContain('getDealStatus(d) === "open"');
    expect(block).toContain('getDealStatus(d) === "lost"');
  });
});
