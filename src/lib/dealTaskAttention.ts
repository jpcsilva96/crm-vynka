import type { DealTask } from "@/lib/dealsStore";
import { getDueDateTime } from "@/lib/utils";
import { getTaskStatusKey, isTaskOverdue } from "@/lib/taskFilters";

/**
 * Selo de tarefas no card do Kanban e na visão em lista.
 *
 * Antes contava só as pendentes com vencimento HOJE: a que venceu ontem sumia do card, justamente a
 * mais urgente (pedido do operador em 23/09/2026 para incluí-la). "Atrasada" usa a mesma regra da
 * tela de Tarefas (`isTaskOverdue`: pendente com vencimento já passado, contando o horário), então
 * uma tarefa de hoje às 09:00 vira atrasada às 09:01 nos dois lugares.
 */
export interface DealTaskAttention {
  overdue: DealTask[];
  today: DealTask[];
}

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const byDue = (a: DealTask, b: DealTask) =>
  (getDueDateTime(a.dueDate, a.dueTime)?.getTime() ?? 0) - (getDueDateTime(b.dueDate, b.dueTime)?.getTime() ?? 0);

export const getDealTaskAttention = (tasks: DealTask[] | undefined, now: Date): DealTaskAttention => {
  const overdue: DealTask[] = [];
  const today: DealTask[] = [];
  for (const task of tasks || []) {
    if (getTaskStatusKey(task) !== "pending") continue;
    if (isTaskOverdue(task, now)) {
      overdue.push(task);
      continue;
    }
    const due = getDueDateTime(task.dueDate, task.dueTime);
    if (due && isSameLocalDay(due, now)) today.push(task);
  }
  return { overdue: overdue.sort(byDue), today: today.sort(byDue) };
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Texto do selo; `null` quando não há o que mostrar. */
export const getTaskAttentionLabel = (overdueCount: number, todayCount: number): string | null => {
  if (overdueCount > 0 && todayCount > 0) return `${plural(overdueCount, "atrasada", "atrasadas")} · ${todayCount} hoje`;
  if (overdueCount > 0) return plural(overdueCount, "tarefa atrasada", "tarefas atrasadas");
  if (todayCount > 0) return plural(todayCount, "tarefa hoje", "tarefas hoje");
  return null;
};
