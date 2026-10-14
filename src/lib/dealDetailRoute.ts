/**
 * De qual lista a negociação aberta veio, e para onde o "Voltar" devolve.
 *
 * O detalhe da negociação é a MESMA tela em dois lugares: `/pipeline/:dealId` (Kanban) e
 * `/tasks/:dealId` (Tarefas). Antes existia só o primeiro, e o fechar era `navigate("/pipeline")`
 * fixo: quem abria uma tarefa caía no Kanban ao voltar e perdia o filtro que tinha montado.
 *
 * A origem é lida da ROTA, não do histórico. `navigate(-1)` seria mais curto e quebra quando a
 * pessoa chega por link direto: sem entrada anterior, o voltar sai do app.
 *
 * Isto vive fora do componente de propósito: decisão que mora no JSX passa verde no teste com a
 * tela regredida (RULES §15).
 */

export type DealOrigin = "tasks" | "pipeline";

const LIST_PATH: Record<DealOrigin, string> = {
  tasks: "/tasks",
  pipeline: "/pipeline",
};

/** A origem pela rota atual. Só `/tasks` e seus filhos são Tarefas; o resto cai no Kanban. */
export function dealOriginFromPath(pathname: string): DealOrigin {
  return pathname === "/tasks" || pathname.startsWith("/tasks/") ? "tasks" : "pipeline";
}

/**
 * A lista para onde o fechar devolve. `search` é preservado porque o Dashboard abre a Tarefas
 * com `?filter=overdue` — sem ele, fechar a negociação apagaria o recorte de onde a pessoa veio.
 */
export function dealListPath(origin: DealOrigin, search = ""): string {
  return `${LIST_PATH[origin]}${search}`;
}

/** A rota de detalhe dentro da aba de origem, para a lista não desmontar atrás do modal. */
export function dealDetailPath(origin: DealOrigin, dealId: string, search = ""): string {
  return `${LIST_PATH[origin]}/${dealId}${search}`;
}
