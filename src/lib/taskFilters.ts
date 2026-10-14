import type { DealTask } from "@/lib/dealsStore";
import { getDueDateTime } from "@/lib/utils";
import { buildSearchText, matchesSearchTerm } from "@/lib/searchMatch";

/**
 * Filtros da tela de Tarefas.
 *
 * A regra de status é a mesma que a lista já usava para pintar o badge: `status` quando existe,
 * senão o booleano `completed` legado — tarefas criadas antes do campo `status` só têm o booleano.
 * "Atrasada" não é um status gravado: é uma tarefa pendente cujo vencimento já passou.
 */

export const TASK_STATUS_FILTERS = ["all", "pending", "overdue", "completed", "cancelled"] as const;
export const TASK_DUE_FILTERS = ["all", "today", "next7", "overdue", "custom"] as const;

export type TaskStatusFilter = (typeof TASK_STATUS_FILTERS)[number];
export type TaskDueFilter = (typeof TASK_DUE_FILTERS)[number];

export interface TaskFilters {
  status: TaskStatusFilter;
  assignedTo: string;
  taskType: string;
  due: TaskDueFilter;
  dueFrom: string;
  dueTo: string;
  search: string;
}

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  status: "all",
  assignedTo: "all",
  taskType: "all",
  due: "all",
  dueFrom: "",
  dueTo: "",
  search: "",
};

/**
 * O filtro da Tarefas sobrevive a abrir uma negociação e voltar.
 *
 * Fica na SESSÃO, como o filtro do Kanban (`crm.pipeline.filters`) e pela mesma razão escrita lá:
 * filtro esquecido de ontem esconde tarefa sem o vendedor perceber por quê. Antes disso era
 * `useState` puro — o único filtro do CRM sem persistência — e zerava a cada ida e volta.
 */
export const TASK_FILTERS_STORAGE_KEY = "crm.tasks.filters";

/**
 * Lê o filtro guardado sobre o padrão. Recebe a string crua em vez de ler o `sessionStorage`
 * aqui dentro: assim a regra é testável sem mockar o navegador, e o storage pode nem existir
 * (aba anônima, cota estourada).
 *
 * Só chave conhecida entra — valor estranho guardado por uma versão futura ou por outra aba não
 * vira filtro fantasma que a tela não sabe desfazer.
 */
export const readStoredTaskFilters = (raw: string | null): TaskFilters => {
  if (!raw) return { ...DEFAULT_TASK_FILTERS };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_TASK_FILTERS };
  }
  if (!parsed || typeof parsed !== "object") return { ...DEFAULT_TASK_FILTERS };
  const stored = parsed as Partial<Record<keyof TaskFilters, unknown>>;
  const text = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);
  // Os dois enums são validados contra a lista, não só contra "é string": um status guardado fora
  // da lista não casa com tarefa nenhuma e esconderia a tela inteira, sem erro e sem pista.
  const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

  return {
    status: oneOf(stored.status, TASK_STATUS_FILTERS, DEFAULT_TASK_FILTERS.status),
    due: oneOf(stored.due, TASK_DUE_FILTERS, DEFAULT_TASK_FILTERS.due),
    assignedTo: text(stored.assignedTo, DEFAULT_TASK_FILTERS.assignedTo),
    taskType: text(stored.taskType, DEFAULT_TASK_FILTERS.taskType),
    dueFrom: text(stored.dueFrom, DEFAULT_TASK_FILTERS.dueFrom),
    dueTo: text(stored.dueTo, DEFAULT_TASK_FILTERS.dueTo),
    search: text(stored.search, DEFAULT_TASK_FILTERS.search),
  };
};

export const getTaskStatusKey = (task: Pick<DealTask, "status" | "completed">) =>
  task.status || (task.completed ? "completed" : "pending");

export const isTaskOverdue = (task: Pick<DealTask, "status" | "completed" | "dueDate" | "dueTime">, now: Date) => {
  if (getTaskStatusKey(task) !== "pending") return false;
  const dueDateTime = getDueDateTime(task.dueDate, task.dueTime);
  return !!dueDateTime && dueDateTime.getTime() < now.getTime();
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const matchesAssignee = (assignedTo: DealTask["assignedTo"], expected: string) => {
  if (expected === "all") return true;
  const values = Array.isArray(assignedTo) ? assignedTo : assignedTo ? [assignedTo] : [];
  if (expected === "unassigned") return values.length === 0;
  return values.includes(expected);
};

const matchesDue = (task: Pick<DealTask, "dueDate" | "dueTime" | "status" | "completed">, filters: TaskFilters, now: Date) => {
  if (filters.due === "all") return true;
  if (filters.due === "overdue") return isTaskOverdue(task, now);

  const dueDateTime = getDueDateTime(task.dueDate, task.dueTime);
  // Sem data não há como afirmar vencimento: fica de fora de qualquer recorte por prazo.
  if (!dueDateTime) return false;
  const dueTime = dueDateTime.getTime();

  if (filters.due === "today") {
    return dueTime >= startOfDay(now).getTime() && dueTime <= endOfDay(now).getTime();
  }

  if (filters.due === "next7") {
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 7);
    return dueTime >= startOfDay(now).getTime() && dueTime <= endOfDay(limit).getTime();
  }

  // custom: extremo vazio significa "sem limite daquele lado"
  if (filters.dueFrom) {
    const from = getDueDateTime(filters.dueFrom, "00:00");
    if (from && dueTime < from.getTime()) return false;
  }
  if (filters.dueTo) {
    const to = getDueDateTime(filters.dueTo, null);
    if (to && dueTime > to.getTime()) return false;
  }
  return true;
};

const matchesStatus = (task: Pick<DealTask, "status" | "completed" | "dueDate" | "dueTime">, filters: TaskFilters, now: Date) => {
  if (filters.status === "all") return true;
  if (filters.status === "overdue") return isTaskOverdue(task, now);
  // "Aberta" exclui a atrasada: as duas aparecem como badges diferentes na lista.
  if (filters.status === "pending") return getTaskStatusKey(task) === "pending" && !isTaskOverdue(task, now);
  return getTaskStatusKey(task) === filters.status;
};

export interface TaskSearchSource {
  title?: string;
  description?: string;
  taskType?: string;
  dealName?: string;
  assignedNames?: string[];
}

export const matchesTaskFilters = (
  task: DealTask & TaskSearchSource,
  filters: TaskFilters,
  now: Date = new Date(),
) => {
  if (!matchesStatus(task, filters, now)) return false;
  if (!matchesAssignee(task.assignedTo, filters.assignedTo)) return false;
  if (filters.taskType !== "all" && (task.taskType || "") !== filters.taskType) return false;
  if (!matchesDue(task, filters, now)) return false;

  return matchesSearchTerm(
    filters.search,
    buildSearchText([task.title, task.description, task.taskType, task.dealName, ...(task.assignedNames || [])]),
  );
};

export const countActiveTaskFilters = (filters: TaskFilters) =>
  (filters.status !== "all" ? 1 : 0)
  + (filters.assignedTo !== "all" ? 1 : 0)
  + (filters.taskType !== "all" ? 1 : 0)
  + (filters.due !== "all" ? 1 : 0)
  + (filters.search.trim() ? 1 : 0);
