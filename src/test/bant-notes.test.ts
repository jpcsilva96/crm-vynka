import { describe, expect, it } from "vitest";
import {
  BANT_NOTE_MAX_LENGTH,
  calculateBantScore,
  classifyLead,
  normalizeBantNotes,
  normalizeBantQualification,
} from "@/lib/leadQualification";

/**
 * Observação por critério da qualificação (lote 4).
 *
 * Mora no mesmo JSONB `qualification_bant` que já guarda a pontuação — sem migration — e é
 * espelhada para os contatos da negociação junto com o resto. Como o JSONB é livre, tudo que vem de
 * lá passa por normalização: registro antigo não tem `notes`, e registro adulterado pode ter
 * qualquer coisa.
 */

describe("normalização das observações", () => {
  it("guarda só as quatro chaves conhecidas", () => {
    const notes = normalizeBantNotes({
      need: "cliente trocou o fornecedor",
      budget: "verba aprovada",
      authority: "decide com o sócio",
      timeline: "quer para janeiro",
      inventado: "não deveria entrar",
    });

    expect(Object.keys(notes).sort()).toEqual(["authority", "budget", "need", "timeline"]);
  });

  it("descarta o que não é texto", () => {
    expect(normalizeBantNotes({ need: 42, budget: null, authority: { a: 1 }, timeline: true })).toEqual({});
  });

  it("tira espaço sobrando e não guarda observação vazia", () => {
    expect(normalizeBantNotes({ need: "   ", budget: "  tem verba  " })).toEqual({ budget: "tem verba" });
  });

  it("corta no teto para não inflar o JSONB espelhado em todos os contatos", () => {
    const gigante = "a".repeat(BANT_NOTE_MAX_LENGTH + 250);
    expect(normalizeBantNotes({ need: gigante }).need).toHaveLength(BANT_NOTE_MAX_LENGTH);
  });

  it("aguenta registro sem observação, nulo ou corrompido", () => {
    expect(normalizeBantNotes(undefined)).toEqual({});
    expect(normalizeBantNotes(null)).toEqual({});
    expect(normalizeBantNotes("texto solto")).toEqual({});
    expect(normalizeBantNotes([1, 2, 3])).toEqual({});
  });
});

describe("qualificação com observação", () => {
  it("preserva a observação ao reabrir a tela", () => {
    const doBanco = { need: 5, budget: 3, authority: 1, timeline: 0, notes: { need: "urgente" } };
    expect(normalizeBantQualification(doBanco).notes).toEqual({ need: "urgente" });
  });

  it("registro antigo, sem observação, continua abrindo", () => {
    const antigo = { need: 5, budget: 5, authority: 5, timeline: 5 };
    const normalizado = normalizeBantQualification(antigo);
    expect(normalizado.notes).toEqual({});
    expect(calculateBantScore(normalizado)).toBe(20);
  });

  it("observação NÃO entra na pontuação nem muda a classificação", () => {
    const semNota = { need: 5, budget: 3, authority: 3, timeline: 1 };
    const comNota = { ...semNota, notes: { need: "texto longo ".repeat(20), budget: "mais texto" } };

    expect(calculateBantScore(comNota)).toBe(calculateBantScore(semNota));
    expect(calculateBantScore(comNota)).toBe(12);
    expect(classifyLead(calculateBantScore(comNota))).toBe(classifyLead(calculateBantScore(semNota)));
  });

  it("pontuação continua saindo de valor sujo sem quebrar", () => {
    const sujo = { need: "5", budget: null, authority: undefined, timeline: "x", notes: { need: "ok" } } as never;
    const normalizado = normalizeBantQualification(sujo);
    expect(calculateBantScore(normalizado)).toBe(5);
    expect(normalizado.notes).toEqual({ need: "ok" });
  });
});
