// Previsão de fechamento digitada à mão — o que o campo faz com cada valor que o navegador emite.
//
// POR QUE ESTE ARQUIVO EXISTE
// O `<input type="date">` emite um valor COMPLETO a cada tecla, não só no fim. Quem digita o ano
// 2027 passa por `0002-10-30`, `0020-10-30` e `0202-10-30` antes de `2027-10-30` (medido no
// Chrome em 23/09/2026). O campo validava cada um desses: no primeiro dígito do ano acusava "data
// passada", recusava e o campo controlado voltava ao valor salvo — ninguém conseguia digitar o ano.
//
// E não basta ignorar o ano curto: quem corrige uma data que já existe também gera datas completas
// no meio do caminho (medido: `2026-01-01`, `2026-10-01`, `2026-10-03`, `2026-10-30` até chegar
// em `2027-10-30`). Por isso a decisão só é tomada depois de uma pausa na digitação ou ao sair do
// campo — é o componente que espera; aqui fica só a classificação, pura e testável.

import { isPastLocalDate, parseLocalDateValue } from "@/lib/utils";

/**
 * Previsão como vem do banco → `YYYY-MM-DD`.
 *
 * A coluna `crm_deals.closing_date` é `TIMESTAMPTZ`, e todo escritor grava o dia escolhido como
 * meia-noite UTC (a tela por `new Date("YYYY-MM-DD").toISOString()`, a API pública pela string
 * crua). O banco devolve `2026-10-22T00:00:00+00:00` (medido nas 20 previsões de 23/09/2026).
 * Tratado como instante, isso vira 21/10 às 21:00 em Brasília: a lista mostrava o dia anterior e
 * o `<input type="date">` recusava o valor e aparecia vazio. O dia certo é o dia em UTC.
 */
export function normalizeClosingDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? undefined : instant.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → `dd/mm/aaaa`, sem hora e sem fuso. Vazio ou inválido vira "—". */
export function formatClosingDate(value?: string | null): string {
  const date = parseLocalDateValue(normalizeClosingDate(value));
  if (!date) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Pausa sem digitar (ms) depois da qual o campo decide. Decidido com o operador em 23/09/2026. */
export const CLOSING_DATE_SETTLE_MS = 1000;

export type ClosingDateDraft =
  /** Campo esvaziado de propósito: salva "sem previsão". */
  | { kind: "empty" }
  /** Digitação pela metade: nem salva nem acusa erro. */
  | { kind: "incomplete" }
  /** Data inteira no passado: não salva, mostra o erro. */
  | { kind: "past"; value: string }
  /** Data inteira de hoje em diante: salva. */
  | { kind: "valid"; value: string };

/**
 * `badInput` é o `validity.badInput` do campo: com algum segmento preenchido e outro não, o
 * navegador entrega `""` — o mesmo valor do campo vazio. Sem essa distinção, apagar o dia para
 * redigitá-lo apagaria a previsão salva.
 */
export function classifyClosingDateDraft(value: string, badInput: boolean): ClosingDateDraft {
  if (!value) return badInput ? { kind: "incomplete" } : { kind: "empty" };

  // Ano com menos de 4 dígitos significativos é digitação em curso, nunca uma previsão real. E o
  // Chrome aceita até 6 dígitos no ano: digitar por cima de 2027 produziu `102026-10-30` (medido
  // em 23/09/2026), que passaria por data futura. Só vale ano de exatamente 4 dígitos.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000) return { kind: "incomplete" };

  return isPastLocalDate(value) ? { kind: "past", value } : { kind: "valid", value };
}
