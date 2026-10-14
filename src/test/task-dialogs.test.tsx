import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { CompleteTaskDialog } from "@/components/pipeline/CompleteTaskDialog";
import { EditTaskDialog } from "@/components/pipeline/EditTaskDialog";
import { useDealsStore, type Deal, type DealTask } from "@/lib/dealsStore";
import { useUsersStore } from "@/lib/usersStore";
import { createActivityDateISO } from "@/lib/activityTypes";
import { TASK_DELAY_OPTIONS, getTaskDelayDateTime, getTaskDelayUpdates } from "@/lib/taskDelay";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * Diálogos de tarefa extraídos dos detalhes da negociação (23/09/2026) para o atalho do selo no
 * card usar o mesmo fluxo. Estes testes fixam o comportamento que os detalhes já tinham.
 */
const deal = { id: "deal-1", dealName: "Negociação de teste", contactName: "Contato Teste", companyId: "co-1", companyName: "Empresa Teste" } as unknown as Deal;
const taskA = { id: "task-a", title: "Ligar para o cliente", description: "Falar do orçamento", taskType: "Ligação", assignedTo: "user-2", dueDate: "2026-09-23T14:00:00.000Z", dueTime: "14:00", status: "pending" } as unknown as DealTask;
const taskB = { ...taskA, id: "task-b", title: "Enviar catálogo" } as DealTask;

const completeTask = vi.fn(async () => {});
const addTask = vi.fn(async () => {});
const editTask = vi.fn(async () => {});

beforeEach(() => {
  vi.clearAllMocks();
  useDealsStore.setState({ completeTask, addTask, editTask } as never);
  useUsersStore.setState({ users: [{ id: "user-1", name: "Pessoa Um" }, { id: "user-2", name: "Pessoa Dois" }] } as never);
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("adiar tarefa", () => {
  const now = new Date(2026, 8, 23, 10, 30);

  it("oferece as seis opções dos detalhes, na mesma ordem", () => {
    expect(TASK_DELAY_OPTIONS.map((o) => o.label)).toEqual([
      "Para daqui 1 hora", "Para daqui 2 horas", "Para amanhã", "Para daqui 2 dias", "Para próxima semana", "Para próximo mês",
    ]);
  });

  it("horas contam a partir de agora, ignorando o horário da tarefa", () => {
    expect(getTaskDelayDateTime({ dueTime: "14:00" }, "1h", now)).toEqual(new Date(2026, 8, 23, 11, 30));
    expect(getTaskDelayDateTime({ dueTime: "14:00" }, "2h", now)).toEqual(new Date(2026, 8, 23, 12, 30));
  });

  it("dias, semana e mês mantêm o horário da tarefa", () => {
    expect(getTaskDelayDateTime({ dueTime: "14:00" }, "tomorrow", now)).toEqual(new Date(2026, 8, 24, 14, 0));
    expect(getTaskDelayDateTime({ dueTime: "14:00" }, "2d", now)).toEqual(new Date(2026, 8, 25, 14, 0));
    expect(getTaskDelayDateTime({ dueTime: "14:00" }, "1w", now)).toEqual(new Date(2026, 8, 30, 14, 0));
    expect(getTaskDelayDateTime({ dueTime: "14:00" }, "1m", now)).toEqual(new Date(2026, 9, 23, 14, 0));
  });

  it("sem horário na tarefa, usa o horário de agora", () => {
    expect(getTaskDelayDateTime({ dueTime: undefined }, "tomorrow", now)).toEqual(new Date(2026, 8, 24, 10, 30));
  });

  it("não altera o relógio recebido", () => {
    const clock = new Date(now.getTime());
    getTaskDelayDateTime({ dueTime: "14:00" }, "1h", clock);
    expect(clock).toEqual(now);
  });

  it("grava data e horário no formato dos detalhes", () => {
    expect(getTaskDelayUpdates({ dueTime: "14:00" }, "tomorrow", now)).toEqual({
      dueDate: createActivityDateISO("2026-09-24", "14:00"),
      dueTime: "14:00",
    });
  });
});

describe("concluir atividade", () => {
  const renderComplete = (task: DealTask | null, extra: Partial<Parameters<typeof CompleteTaskDialog>[0]> = {}) => {
    const props = { deal, task, onClose: vi.fn(), userName: "Pessoa Um", defaultAssignee: "user-1", ...extra };
    const view = render(<CompleteTaskDialog {...props} />);
    return { ...view, props };
  };
  const resultSelect = () => screen.getByDisplayValue("Selecione o resultado") as HTMLSelectElement;

  it("mostra a tarefa e o responsável", () => {
    renderComplete(taskA);
    expect(screen.getByText("Ligação - Ligar para o cliente")).toBeInTheDocument();
    expect(screen.getByText("Responsável: Pessoa Dois")).toBeInTheDocument();
  });

  it("exige o resultado antes de concluir", async () => {
    const { props } = renderComplete(taskA);
    fireEvent.click(screen.getByRole("button", { name: "Concluir atividade" }));
    await flush();
    expect(completeTask).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Selecione o resultado da atividade.");
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("conclui com resultado e observação, avisa início e fim e fecha", async () => {
    const order: string[] = [];
    const { props } = renderComplete(taskA, {
      onCompleteStart: (id) => order.push(`start:${id}`),
      onCompleteEnd: (id) => order.push(`end:${id}`),
      onClose: () => order.push("close"),
    });
    completeTask.mockImplementationOnce(async () => { order.push("complete"); });
    fireEvent.change(resultSelect(), { target: { value: "Cliente interessado" } });
    fireEvent.change(screen.getByPlaceholderText(/Cliente vai apresentar/), { target: { value: "  retorno sexta  " } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir atividade" }));
    await flush();
    expect(completeTask).toHaveBeenCalledWith("deal-1", "task-a", { activityResult: "Cliente interessado", resultNotes: "retorno sexta" }, props.userName);
    expect(addTask).not.toHaveBeenCalled();
    expect(order).toEqual(["start:task-a", "complete", "end:task-a", "close"]);
  });

  it("cria a próxima atividade com o responsável padrão quando marcado", async () => {
    renderComplete(taskA);
    fireEvent.change(resultSelect(), { target: { value: "Cliente pediu retorno" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByPlaceholderText("Ex: Retorno sobre análise da proposta"), { target: { value: " Retornar " } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir atividade" }));
    await flush();
    expect(addTask).toHaveBeenCalledWith("deal-1", expect.objectContaining({
      title: "Retornar", assignedTo: "user-1", taskType: "Ligação", companyId: "co-1", status: "pending",
    }), "Pessoa Um");
  });

  it("próxima atividade sem assunto não conclui", async () => {
    renderComplete(taskA);
    fireEvent.change(resultSelect(), { target: { value: "Cliente pediu retorno" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Concluir atividade" }));
    await flush();
    expect(completeTask).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Informe o assunto da próxima atividade.");
  });

  it("cada abertura começa com o formulário limpo", () => {
    const { rerender, props } = renderComplete(taskA);
    fireEvent.change(resultSelect(), { target: { value: "Outro" } });
    rerender(<CompleteTaskDialog {...props} task={null} />);
    rerender(<CompleteTaskDialog {...props} task={taskB} />);
    expect(resultSelect().value).toBe("");
  });
});

describe("editar atividade", () => {
  const renderEdit = (task: DealTask | null) => {
    const props = { deal, task, onClose: vi.fn(), userName: "Pessoa Um", defaultAssignee: "user-1" };
    const view = render(<EditTaskDialog {...props} />);
    return { ...view, props };
  };
  const titleInput = () => screen.getByPlaceholderText("Ex: Ligação inicial, Follow Up...") as HTMLInputElement;

  it("carrega a tarefa aberta", () => {
    renderEdit(taskA);
    expect(titleInput().value).toBe("Ligar para o cliente");
    expect((screen.getByPlaceholderText("Detalhes adicionais...") as HTMLTextAreaElement).value).toBe("Falar do orçamento");
    expect((screen.getByDisplayValue("Pessoa Dois") as HTMLSelectElement).value).toBe("user-2");
  });

  it("salva os campos editados e fecha", async () => {
    const { props } = renderEdit(taskA);
    fireEvent.change(titleInput(), { target: { value: "  Ligar de novo  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await flush();
    expect(editTask).toHaveBeenCalledWith("deal-1", "task-a", expect.objectContaining({
      title: "Ligar de novo", description: "Falar do orçamento", assignedTo: "user-2", dueTime: "14:00", companyId: "co-1",
    }), "Pessoa Um");
    expect(props.onClose).toHaveBeenCalled();
  });

  it("assunto vazio não salva", async () => {
    renderEdit(taskA);
    fireEvent.change(titleInput(), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await flush();
    expect(editTask).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("O assunto da tarefa não pode estar vazio.");
  });

  it("trocar de tarefa recarrega o formulário", () => {
    const { rerender, props } = renderEdit(taskA);
    rerender(<EditTaskDialog {...props} task={null} />);
    rerender(<EditTaskDialog {...props} task={taskB} />);
    expect(titleInput().value).toBe("Enviar catálogo");
  });
});

// Os detalhes da negociação passam a usar os componentes; nenhum formulário de tarefa inline ficou
// para trás divergindo (DealView.tsx é grande demais para render isolado).
describe("detalhes da negociação usam os diálogos extraídos", () => {
  const source = readFileSync(path.resolve(__dirname, "../components/pipeline/DealView.tsx"), "utf8");

  it("renderiza os dois componentes", () => {
    expect(source).toContain("<CompleteTaskDialog");
    expect(source).toContain("<EditTaskDialog");
  });

  it("não guarda cópia dos formulários nem da regra de adiar", () => {
    expect(source).not.toMatch(/Concluir atividade<\/DialogTitle>|Editar atividade<\/DialogTitle>|getTaskDelayDateTime|const ACTIVITY_RESULTS/);
  });

  it("o menu de adiar lê a lista única", () => {
    expect(source).toContain("TASK_DELAY_OPTIONS.map");
  });
});
