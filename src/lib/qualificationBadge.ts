// Cor do selo de qualificação (Lead Prioritário, Qualificado, Nutrição, Descartado) no card do
// Kanban e nos detalhes da negociação.
//
// POR QUE ESTE ARQUIVO EXISTE
// A função estava copiada no DealCard e no DealView, só com o tom claro: texto `*-700` sobre fundo
// translúcido. No tema escuro o fundo translúcido fica escuro e o texto `*-700` some junto
// (relatado em 23/09/2026 com o "Lead Prioritário"). Cada tom agora traz a variante `dark:`; no
// tema claro nada muda.

const QUALIFICATION_BADGE_TONE: Record<string, string> = {
  "Lead Prioritário":
    "border-fuchsia-300/70 bg-fuchsia-500/15 text-fuchsia-700 dark:border-fuchsia-400/40 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
  "Lead Qualificado":
    "border-emerald-300/70 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-300",
  "Lead Nutrição":
    "border-sky-300/70 bg-sky-500/15 text-sky-700 dark:border-sky-400/40 dark:bg-sky-500/20 dark:text-sky-300",
  "Lead Descartado":
    "border-slate-300/70 bg-slate-500/15 text-slate-700 dark:border-slate-400/40 dark:bg-slate-500/20 dark:text-slate-300",
};

/** Sem qualificação (ou classificação desconhecida): âmbar. */
const QUALIFICATION_BADGE_FALLBACK =
  "border-amber-300/70 bg-amber-500/15 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-300";

export function getQualificationBadgeTone(classification?: string): string {
  return (classification && QUALIFICATION_BADGE_TONE[classification]) || QUALIFICATION_BADGE_FALLBACK;
}
