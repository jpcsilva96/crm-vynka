import { readFileSync } from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ClosingDateInput, CLOSING_DATE_PAST_MESSAGE } from "@/components/pipeline/ClosingDateInput";
import { CLOSING_DATE_SETTLE_MS, classifyClosingDateDraft, formatClosingDate, normalizeClosingDate } from "@/lib/closingDateDraft";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

/**
 * Previsão de fechamento digitada à mão (23/09/2026). As sequências abaixo são as que o Chrome
 * emitiu, medidas numa página isolada: o `<input type="date">` entrega uma data completa a cada
 * tecla, inclusive `0002-…` no primeiro dígito do ano e datas passadas no meio de uma correção.
 */

// "Hoje" fixo: 23/09/2026, meio-dia local.
const TODAY = new Date(2026, 8, 23, 12, 0, 0);

describe("classifyClosingDateDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: TODAY });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ano ainda sendo digitado é incompleto, não data passada", () => {
    for (const value of ["0002-10-30", "0020-10-30", "0202-10-30", "0999-12-31"]) {
      expect(classifyClosingDateDraft(value, false)).toEqual({ kind: "incomplete" });
    }
  });

  it("ano com mais de 4 dígitos (o Chrome aceita até 6) não passa por data futura", () => {
    for (const value of ["102026-10-30", "20271-01-01", "275760-09-13"]) {
      expect(classifyClosingDateDraft(value, false)).toEqual({ kind: "incomplete" });
    }
  });

  it("campo vazio distingue apagado de propósito de digitação pela metade", () => {
    expect(classifyClosingDateDraft("", false)).toEqual({ kind: "empty" });
    expect(classifyClosingDateDraft("", true)).toEqual({ kind: "incomplete" });
  });

  it("data inteira: passada recusa, hoje e futura valem", () => {
    expect(classifyClosingDateDraft("2026-09-22", false)).toEqual({ kind: "past", value: "2026-09-22" });
    expect(classifyClosingDateDraft("1000-01-01", false)).toEqual({ kind: "past", value: "1000-01-01" });
    expect(classifyClosingDateDraft("2026-09-23", false)).toEqual({ kind: "valid", value: "2026-09-23" });
    expect(classifyClosingDateDraft("2027-10-30", false)).toEqual({ kind: "valid", value: "2027-10-30" });
  });
});

describe("ClosingDateInput", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: TODAY });
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = (value = "") => {
    const onCommit = vi.fn();
    const utils = render(<ClosingDateInput aria-label="Previsão" value={value} onCommit={onCommit} />);
    const input = screen.getByLabelText("Previsão") as HTMLInputElement;
    return { ...utils, input, onCommit };
  };

  const type = (input: HTMLInputElement, value: string, badInput = false) => {
    Object.defineProperty(input, "validity", { value: { badInput }, configurable: true });
    fireEvent.change(input, { target: { value } });
  };

  const pause = () => act(() => {
    vi.advanceTimersByTime(CLOSING_DATE_SETTLE_MS);
  });

  it("o defeito relatado: o ano digitado dígito a dígito não é apagado nem acusado", () => {
    const { input, onCommit } = setup("");
    input.focus();

    type(input, "", true); // mês digitado, resto vazio
    type(input, "", true); // dia digitado
    type(input, "0002-10-30");
    expect(input.value).toBe("0002-10-30");
    type(input, "0020-10-30");
    type(input, "0202-10-30");
    type(input, "2027-10-30");

    expect(toast.error).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();

    pause();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("2027-10-30");
    expect(toast.error).not.toHaveBeenCalled();
    expect(input.value).toBe("2027-10-30");
  });

  it("parar no meio do ano não acusa erro nem apaga o que foi digitado", () => {
    const { input, onCommit } = setup("");
    input.focus();

    type(input, "0202-10-30");
    pause();

    expect(toast.error).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("0202-10-30");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("corrigir uma data existente salva uma vez só, sem erro pelas datas do meio", () => {
    const { input, onCommit } = setup("2026-12-01");
    input.focus();

    // sequência medida no Chrome ao redigitar 10/30/2027 por cima de 12/01/2026
    for (const value of ["2026-01-01", "2026-10-01", "2026-10-03", "2026-10-30", "0002-10-30", "0020-10-30", "0202-10-30", "2027-10-30"]) {
      type(input, value);
      act(() => {
        vi.advanceTimersByTime(CLOSING_DATE_SETTLE_MS - 1);
      });
    }

    expect(onCommit).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();

    pause();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("2027-10-30");
  });

  it("data passada completa fica no campo com erro e volta à salva ao sair", () => {
    const { input, onCommit } = setup("2026-12-01");
    input.focus();

    type(input, "2026-09-10");
    pause();

    expect(onCommit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(CLOSING_DATE_PAST_MESSAGE);
    expect(input.value).toBe("2026-09-10");
    expect(input).toHaveAttribute("aria-invalid", "true");

    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("2026-12-01");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("corrigir a data passada para uma futura salva e tira o erro", () => {
    const { input, onCommit } = setup("");
    input.focus();

    type(input, "2026-09-10");
    pause();
    type(input, "2026-10-10");
    pause();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("2026-10-10");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("redigitar a mesma data não grava de novo (cada gravação vira linha no histórico)", () => {
    const { input, onCommit } = setup("2026-12-01");
    input.focus();

    type(input, "2026-12-01");
    pause();
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("apagar a data salva 'sem previsão'", () => {
    const { input, onCommit } = setup("2026-12-01");
    input.focus();

    type(input, "", false);
    pause();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("");
  });

  it("digitação pela metade não apaga a previsão salva, nem ao sair", () => {
    const { input, onCommit } = setup("2026-12-01");
    input.focus();

    type(input, "", true);
    pause();
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("2026-12-01");
  });

  it("sair do campo antes da pausa salva na hora, uma vez", () => {
    const { input, onCommit } = setup("");
    input.focus();

    type(input, "2027-01-15");
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("2027-01-15");

    pause();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("fechar a tela logo depois de digitar não perde a data", () => {
    const { input, onCommit, unmount } = setup("");
    input.focus();

    type(input, "2027-01-15");
    unmount();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("2027-01-15");
  });

  it("previsão trocada por fora entra no campo", () => {
    const onCommit = vi.fn();
    const { rerender } = render(<ClosingDateInput aria-label="Previsão" value="2026-12-01" onCommit={onCommit} />);
    rerender(<ClosingDateInput aria-label="Previsão" value="" onCommit={onCommit} />);

    expect((screen.getByLabelText("Previsão") as HTMLInputElement).value).toBe("");
    expect(onCommit).not.toHaveBeenCalled();
  });
});

/**
 * Previsão vinda do banco (23/09/2026). `closing_date` é TIMESTAMPTZ e volta como
 * `2026-10-22T00:00:00+00:00`; lida como instante em Brasília, a lista mostrava "21/10/2026, 21:00"
 * e o campo dos detalhes ficava vazio. O fuso do processo de teste é fixado em São Paulo para o
 * teste reproduzir o que a equipe vê — em UTC o defeito não aparece.
 */
describe("previsão vinda do banco", () => {
  const originalTz = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = "America/Sao_Paulo";
  });
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("o oráculo: em São Paulo, o instante do banco cai no dia anterior", () => {
    expect(new Date("2026-10-22T00:00:00+00:00").getDate()).toBe(21);
  });

  it("normalizeClosingDate devolve o dia escolhido, sem hora", () => {
    expect(normalizeClosingDate("2026-10-22T00:00:00+00:00")).toBe("2026-10-22");
    expect(normalizeClosingDate("2026-10-22T00:00:00.000Z")).toBe("2026-10-22");
    expect(normalizeClosingDate("2026-10-22")).toBe("2026-10-22");
    expect(normalizeClosingDate(null)).toBeUndefined();
    expect(normalizeClosingDate("")).toBeUndefined();
    expect(normalizeClosingDate("lixo")).toBeUndefined();
  });

  it("o valor normalizado é aceito pelo campo de data", () => {
    const input = document.createElement("input");
    input.type = "date";
    input.value = normalizeClosingDate("2026-10-22T00:00:00+00:00")!;
    expect(input.value).toBe("2026-10-22");
  });

  it("formatClosingDate mostra a mesma data, sem hora, venha como vier", () => {
    expect(formatClosingDate("2026-10-22T00:00:00+00:00")).toBe("22/10/2026");
    expect(formatClosingDate("2026-10-22")).toBe("22/10/2026");
    expect(formatClosingDate("2026-01-01T00:00:00+00:00")).toBe("01/01/2026");
    expect(formatClosingDate(undefined)).toBe("—");
  });

  it("ida e volta: o que a tela grava volta como o mesmo dia", async () => {
    // mesma conversão do toDealDB (dealsStore.ts) na gravação
    const gravado = new Date("2026-10-22").toISOString();
    expect(normalizeClosingDate(gravado)).toBe("2026-10-22");
  });
});

describe("as telas leem a previsão como data, não como instante", () => {
  const src = (file: string) => readFileSync(path.resolve(__dirname, "..", file), "utf8");

  it("o store normaliza o que vem do banco", () => {
    expect(src("lib/dealsStore.ts")).toContain("closingDate: normalizeClosingDate(r.closing_date)");
  });

  it.each(["pages/Pipeline.tsx", "components/pipeline/DealView.tsx"])("%s não converte a previsão em instante", (file) => {
    const source = src(file);
    expect(source).toContain("formatClosingDate(");
    expect(source).not.toMatch(/new Date\((deal|rDeal)\.closingDate\)/);
  });
});

// RULES.md §15: a regra certa não adianta se a tela voltar ao `<Input type="date">` que valida a cada tecla.
describe("as duas telas usam o campo que deixa digitar", () => {
  const read = (file: string) => readFileSync(path.resolve(__dirname, "../components/pipeline", file), "utf8");

  it.each(["DealView.tsx", "CreateDealDialog.tsx"])("%s", (file) => {
    const source = read(file);
    expect(source).toContain("<ClosingDateInput");
    // o campo antigo validava no onChange; nenhuma data da tela pode voltar a fazer isso
    expect(source).not.toMatch(/type="date"[\s\S]{0,200}onChange=[\s\S]{0,200}isPastLocalDate/);
  });
});
