import { describe, expect, it } from "vitest";
import type { DealTask } from "@/lib/dealsStore";
import {
  DEFAULT_TASK_FILTERS,
  countActiveTaskFilters,
  getTaskStatusKey,
  isTaskOverdue,
  matchesTaskFilters,
  readStoredTaskFilters,
  type TaskFilters,
  type TaskSearchSource,
} from "@/lib/taskFilters";

const AGORA = new Date(2026, 8, 10, 14, 0, 0); // 10/09/2026 14:00, hora local

const criarTarefa = (overrides: Partial<DealTask & TaskSearchSource> = {}): DealTask & TaskSearchSource => ({
  id: "t1",
  title: "Ligar para o comprador",
  description: "",
  completed: false,
  createdAt: "2026-09-01T12:00:00.000Z",
  taskType: "Ligação",
  assignedTo: "user-1",
  dueDate: "2026-09-10",
  dueTime: "16:00",
  dealName: "Hotel Serra Azul",
  assignedNames: ["Maria Souza"],
  ...overrides,
});

const filtros = (overrides: Partial<TaskFilters> = {}): TaskFilters => ({ ...DEFAULT_TASK_FILTERS, ...overrides });

describe("status da tarefa", () => {
  it("cai no booleano legado quando não há campo status", () => {
    expect(getTaskStatusKey({ completed: true })).toBe("completed");
    expect(getTaskStatusKey({ completed: false })).toBe("pending");
    expect(getTaskStatusKey({ completed: false, status: "cancelled" })).toBe("cancelled");
  });

  it("atrasada é pendente com vencimento no passado", () => {
    expect(isTaskOverdue(criarTarefa({ dueDate: "2026-09-09" }), AGORA)).toBe(true);
    expect(isTaskOverdue(criarTarefa({ dueDate: "2026-09-10", dueTime: "16:00" }), AGORA)).toBe(false);
    // concluída fora do prazo não é "atrasada": já saiu da fila do vendedor
    expect(isTaskOverdue(criarTarefa({ dueDate: "2026-09-09", status: "completed", completed: true }), AGORA)).toBe(false);
    expect(isTaskOverdue(criarTarefa({ dueDate: undefined, dueTime: undefined }), AGORA)).toBe(false);
  });

  it("hora do dia decide o vencimento do próprio dia", () => {
    expect(isTaskOverdue(criarTarefa({ dueDate: "2026-09-10", dueTime: "13:59" }), AGORA)).toBe(true);
    expect(isTaskOverdue(criarTarefa({ dueDate: "2026-09-10", dueTime: "14:01" }), AGORA)).toBe(false);
    // sem hora, o prazo é o fim do dia
    expect(isTaskOverdue(criarTarefa({ dueDate: "2026-09-10", dueTime: undefined }), AGORA)).toBe(false);
  });
});

describe("filtro de status", () => {
  it('"aberta em dia" não traz a atrasada', () => {
    expect(matchesTaskFilters(criarTarefa(), filtros({ status: "pending" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(criarTarefa({ dueDate: "2026-09-01" }), filtros({ status: "pending" }), AGORA)).toBe(false);
  });

  it("atrasada, concluída e cancelada são recortes distintos", () => {
    const atrasada = criarTarefa({ dueDate: "2026-09-01" });
    const concluida = criarTarefa({ status: "completed", completed: true });
    const cancelada = criarTarefa({ status: "cancelled" });

    expect(matchesTaskFilters(atrasada, filtros({ status: "overdue" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(concluida, filtros({ status: "overdue" }), AGORA)).toBe(false);
    expect(matchesTaskFilters(concluida, filtros({ status: "completed" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(cancelada, filtros({ status: "cancelled" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(cancelada, filtros({ status: "completed" }), AGORA)).toBe(false);
  });
});

describe("filtro de responsável", () => {
  it("aceita responsável único e lista de responsáveis", () => {
    expect(matchesTaskFilters(criarTarefa(), filtros({ assignedTo: "user-1" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(criarTarefa(), filtros({ assignedTo: "user-2" }), AGORA)).toBe(false);
    expect(
      matchesTaskFilters(criarTarefa({ assignedTo: ["user-2", "user-3"] }), filtros({ assignedTo: "user-3" }), AGORA),
    ).toBe(true);
  });

  it("separa tarefa sem responsável", () => {
    expect(matchesTaskFilters(criarTarefa({ assignedTo: undefined }), filtros({ assignedTo: "unassigned" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(criarTarefa(), filtros({ assignedTo: "unassigned" }), AGORA)).toBe(false);
  });
});

describe("filtro de vencimento", () => {
  it("hoje pega qualquer hora do dia corrente", () => {
    expect(matchesTaskFilters(criarTarefa({ dueTime: "08:00" }), filtros({ due: "today" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(criarTarefa({ dueDate: "2026-09-11" }), filtros({ due: "today" }), AGORA)).toBe(false);
    // atrasada de ontem não é "hoje"
    expect(matchesTaskFilters(criarTarefa({ dueDate: "2026-09-09" }), filtros({ due: "today" }), AGORA)).toBe(false);
  });

  it("próximos 7 dias inclui hoje e o sétimo dia, e exclui o oitavo", () => {
    expect(matchesTaskFilters(criarTarefa({ dueDate: "2026-09-17" }), filtros({ due: "next7" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(criarTarefa({ dueDate: "2026-09-18" }), filtros({ due: "next7" }), AGORA)).toBe(false);
    expect(matchesTaskFilters(criarTarefa({ dueDate: "2026-09-09" }), filtros({ due: "next7" }), AGORA)).toBe(false);
  });

  it("intervalo respeita os dois extremos e aceita extremo aberto", () => {
    const tarefa = criarTarefa({ dueDate: "2026-09-15" });
    expect(matchesTaskFilters(tarefa, filtros({ due: "custom", dueFrom: "2026-09-14", dueTo: "2026-09-16" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(tarefa, filtros({ due: "custom", dueFrom: "2026-09-16", dueTo: "" }), AGORA)).toBe(false);
    expect(matchesTaskFilters(tarefa, filtros({ due: "custom", dueFrom: "", dueTo: "2026-09-14" }), AGORA)).toBe(false);
    // o dia do extremo entra inteiro, não só a meia-noite
    expect(matchesTaskFilters(tarefa, filtros({ due: "custom", dueFrom: "", dueTo: "2026-09-15" }), AGORA)).toBe(true);
  });

  it("tarefa sem data fica fora de qualquer recorte por prazo, mas aparece em 'todos'", () => {
    const semData = criarTarefa({ dueDate: undefined, dueTime: undefined });
    expect(matchesTaskFilters(semData, filtros({ due: "today" }), AGORA)).toBe(false);
    expect(matchesTaskFilters(semData, filtros({ due: "overdue" }), AGORA)).toBe(false);
    expect(matchesTaskFilters(semData, filtros(), AGORA)).toBe(true);
  });
});

describe("busca e combinação", () => {
  it("procura em assunto, descrição, tipo, negociação e responsável, sem acento", () => {
    expect(matchesTaskFilters(criarTarefa(), filtros({ search: "COMPRADOR" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(criarTarefa(), filtros({ search: "serra azul" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(criarTarefa(), filtros({ search: "maria" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(criarTarefa(), filtros({ search: "ligacao" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(criarTarefa(), filtros({ search: "orçamento" }), AGORA)).toBe(false);
  });

  it("filtros se somam: basta um discordar para a tarefa sair", () => {
    const tarefa = criarTarefa();
    expect(matchesTaskFilters(tarefa, filtros({ status: "pending", taskType: "Ligação", due: "today" }), AGORA)).toBe(true);
    expect(matchesTaskFilters(tarefa, filtros({ status: "pending", taskType: "Visita", due: "today" }), AGORA)).toBe(false);
  });

  it("conta os filtros ativos para o badge da tela", () => {
    expect(countActiveTaskFilters(filtros())).toBe(0);
    expect(countActiveTaskFilters(filtros({ status: "overdue", search: "  " }))).toBe(1);
    expect(countActiveTaskFilters(filtros({ status: "overdue", assignedTo: "user-1", due: "today", search: "x" }))).toBe(4);
  });
});

describe("filtro guardado na sessão", () => {
  it("sem nada guardado, volta o padrão", () => {
    expect(readStoredTaskFilters(null)).toEqual(DEFAULT_TASK_FILTERS);
    expect(readStoredTaskFilters("")).toEqual(DEFAULT_TASK_FILTERS);
  });

  it("JSON quebrado não derruba a tela, cai no padrão", () => {
    expect(readStoredTaskFilters("{isto nao e json")).toEqual(DEFAULT_TASK_FILTERS);
    expect(readStoredTaskFilters("null")).toEqual(DEFAULT_TASK_FILTERS);
    expect(readStoredTaskFilters('"uma string"')).toEqual(DEFAULT_TASK_FILTERS);
  });

  it("devolve o que foi guardado, campo a campo", () => {
    const guardado = { ...DEFAULT_TASK_FILTERS, status: "overdue", assignedTo: "u-1", search: "taça" };
    expect(readStoredTaskFilters(JSON.stringify(guardado))).toEqual(guardado);
  });

  it("completa com o padrão o que faltar no guardado", () => {
    expect(readStoredTaskFilters('{"search":"copo"}')).toEqual({ ...DEFAULT_TASK_FILTERS, search: "copo" });
  });

  it("status fora da lista vira o padrão, não esconde a tela inteira", () => {
    // Um status desconhecido não casa com tarefa nenhuma: a lista apareceria vazia, sem erro e
    // sem pista de por quê. Vale para o `due` pelo mesmo motivo.
    expect(readStoredTaskFilters('{"status":"banana"}').status).toBe("all");
    expect(readStoredTaskFilters('{"due":"seculo_que_vem"}').due).toBe("all");
  });

  it("ignora chave desconhecida e valor que não é texto", () => {
    const lido = readStoredTaskFilters('{"search":123,"xpto":"sobra","assignedTo":{"a":1}}');
    expect(lido).toEqual(DEFAULT_TASK_FILTERS);
    expect("xpto" in lido).toBe(false);
  });
});
