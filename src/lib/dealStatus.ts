// Situação de uma negociação: ganha, perdida ou em andamento.
//
// POR QUE ESTE ARQUIVO EXISTE
// Marcar como ganha ou perdida grava `outcome` e deixa a etapa onde estava (`setOutcome` no
// dealsStore). As telas de empresa e de contato decidiam a situação só por `stage === "won"` /
// `"lost"` e mostravam "Em andamento" para negociação já fechada (relatado em 23/09/2026). O
// Dashboard já usava a regra certa; aqui ela fica num lugar só.
//
// `stage` "won"/"lost" segue valendo como reserva: é como negociações antigas marcavam o desfecho.

import type { Deal } from "@/lib/dealsStore";

export type DealStatus = "won" | "lost" | "open";

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  won: "Ganha",
  lost: "Perdida",
  open: "Em andamento",
};

/**
 * Cor do selo. Ganha e perdida nos mesmos tons do selo do card no Kanban (DealCard); em andamento
 * em azul, como no gráfico Ganhos x Perdidos do Dashboard. O rosa da marca ficava quase igual ao
 * vermelho da perdida (medido: rgb 255,56,93 contra 239,68,68).
 */
export const DEAL_STATUS_BADGE_CLASS: Record<DealStatus, string> = {
  won: "bg-emerald-500/15 text-emerald-500",
  lost: "bg-red-500/15 text-red-500",
  open: "bg-blue-500/15 text-blue-500",
};

export function getDealStatus(deal: Pick<Deal, "outcome" | "stage">): DealStatus {
  if (deal.outcome === "won") return "won";
  if (deal.outcome === "lost") return "lost";
  if (deal.stage === "won") return "won";
  if (deal.stage === "lost") return "lost";
  return "open";
}
