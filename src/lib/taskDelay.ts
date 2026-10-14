import { format } from "date-fns";
import type { DealTask } from "@/lib/dealsStore";
import { createActivityDateISO } from "@/lib/activityTypes";

/**
 * Adiar tarefa: regra única para os detalhes da negociação e o atalho do selo no card/lista.
 * Horas contam a partir de agora; dias, semana e mês mantêm o horário da tarefa (ou o de agora,
 * se ela não tiver horário).
 */
export type TaskDelayMode = "1h" | "2h" | "tomorrow" | "2d" | "1w" | "1m";

export const TASK_DELAY_OPTIONS: ReadonlyArray<{ mode: TaskDelayMode; label: string }> = [
  { mode: "1h", label: "Para daqui 1 hora" },
  { mode: "2h", label: "Para daqui 2 horas" },
  { mode: "tomorrow", label: "Para amanhã" },
  { mode: "2d", label: "Para daqui 2 dias" },
  { mode: "1w", label: "Para próxima semana" },
  { mode: "1m", label: "Para próximo mês" },
];

export const getTaskDelayDateTime = (task: Pick<DealTask, "dueTime"> | null | undefined, mode: TaskDelayMode, now: Date = new Date()) => {
  const taskTime = task?.dueTime;
  const fallbackHour = now.getHours();
  const fallbackMinute = now.getMinutes();

  const applyTaskTime = (date: Date) => {
    if (taskTime && /^\d{2}:\d{2}$/.test(taskTime)) {
      const [hours, minutes] = taskTime.split(":").map(Number);
      date.setHours(hours, minutes, 0, 0);
    } else {
      date.setHours(fallbackHour, fallbackMinute, 0, 0);
    }
    return date;
  };

  const date = new Date(now.getTime());
  switch (mode) {
    case "1h":
      date.setHours(date.getHours() + 1, date.getMinutes(), 0, 0);
      return date;
    case "2h":
      date.setHours(date.getHours() + 2, date.getMinutes(), 0, 0);
      return date;
    case "tomorrow":
      date.setDate(date.getDate() + 1);
      return applyTaskTime(date);
    case "2d":
      date.setDate(date.getDate() + 2);
      return applyTaskTime(date);
    case "1w":
      date.setDate(date.getDate() + 7);
      return applyTaskTime(date);
    case "1m":
      date.setMonth(date.getMonth() + 1);
      return applyTaskTime(date);
  }
};

/** O que gravar na tarefa ao adiar: mesmo formato que a tela de detalhes sempre gravou. */
export const getTaskDelayUpdates = (task: Pick<DealTask, "dueTime"> | null | undefined, mode: TaskDelayMode, now: Date = new Date()) => {
  const nextDate = getTaskDelayDateTime(task, mode, now);
  const nextDateValue = format(nextDate, "yyyy-MM-dd");
  const nextTimeValue = format(nextDate, "HH:mm");
  return {
    dueDate: createActivityDateISO(nextDateValue, nextTimeValue),
    dueTime: nextTimeValue,
  };
};
