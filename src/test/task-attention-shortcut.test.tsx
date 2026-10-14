import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TaskAttentionBadge } from "@/components/pipeline/TaskAttentionBadge";
import { DealTasksQuickDialog } from "@/components/pipeline/DealTasksQuickDialog";
import { DealCard } from "@/components/pipeline/DealCard";
import { getDealTaskAttention, getTaskAttentionLabel } from "@/lib/dealTaskAttention";
import { useDealsStore, type Deal, type DealTask } from "@/lib/dealsStore";
import { useUsersStore } from "@/lib/usersStore";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * Atalho do selo de tarefas no card e na lista (23/09/2026, pedido do operador): o selo passa a
 * contar também as atrasadas e, ao clicar, abre só as tarefas da negociação para editar, adiar,
 * cancelar ou concluir — sem botão novo no card.
 */
const NOW = new Date(2026, 8, 23, 12, 0);
const task = (id: string, dueDate: string, dueTime?: string, extra: Partial<DealTask> = {}) =>
  ({ id, title: `Tarefa ${id}`, taskType: "Ligação", assignedTo: "user-1", dueDate, dueTime, status: "pending", ...extra }) as unknown as DealTask;

describe("regra do selo: atrasadas e de hoje", () => {
  it("separa atrasada, hoje e o resto", () => {
    const tasks = [
      task("amanha", "2026-09-24", "10:00"),
      task("hoje-tarde", "2026-09-23", "15:00"),
      task("hoje-manha", "2026-09-23", "09:00"),
      task("ontem", "2026-09-22"),
      task("hoje-sem-hora", "2026-09-23"),
      task("feita", "2026-09-22", undefined, { status: "completed" }),
      task("cancelada", "2026-09-22", undefined, { status: "cancelled" }),
      task("legado-feita", "2026-09-22", undefined, { status: undefined, completed: true }),
      task("sem-data", ""),
    ];
    const { overdue, today } = getDealTaskAttention(tasks, NOW);
    // mesma regra da tela de Tarefas: hoje às 09:00 já está atrasada ao meio-dia
    expect(overdue.map((t) => t.id)).toEqual(["ontem", "hoje-manha"]);
    expect(today.map((t) => t.id)).toEqual(["hoje-tarde", "hoje-sem-hora"]);
  });

  it("sem tarefas, nada", () => {
    expect(getDealTaskAttention(undefined, NOW)).toEqual({ overdue: [], today: [] });
  });

  it("texto do selo", () => {
    expect(getTaskAttentionLabel(0, 0)).toBeNull();
    expect(getTaskAttentionLabel(0, 1)).toBe("1 tarefa hoje");
    expect(getTaskAttentionLabel(0, 2)).toBe("2 tarefas hoje");
    expect(getTaskAttentionLabel(1, 0)).toBe("1 tarefa atrasada");
    expect(getTaskAttentionLabel(3, 0)).toBe("3 tarefas atrasadas");
    expect(getTaskAttentionLabel(2, 1)).toBe("2 atrasadas · 1 hoje");
  });
});

describe("selo", () => {
  const renderBadge = (props: Parameters<typeof TaskAttentionBadge>[0]) =>
    render(<TooltipProvider><TaskAttentionBadge {...props} /></TooltipProvider>);

  it("some sem tarefa", () => {
    renderBadge({ overdueCount: 0, todayCount: 0, onOpen: vi.fn() });
    expect(screen.queryByTestId("task-attention-badge")).toBeNull();
  });

  it("sem atalho, só informa (não é botão)", () => {
    renderBadge({ overdueCount: 0, todayCount: 1 });
    expect(screen.getByTestId("task-attention-badge").tagName).toBe("SPAN");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("âmbar para hoje, vermelho quando há atrasada, legível no escuro", () => {
    const { unmount } = renderBadge({ overdueCount: 0, todayCount: 1 });
    expect(screen.getByTestId("task-attention-badge").className).toMatch(/text-amber-700.*dark:text-amber-300/);
    unmount();
    renderBadge({ overdueCount: 1, todayCount: 1 });
    expect(screen.getByTestId("task-attention-badge").className).toMatch(/text-rose-700.*dark:text-rose-300/);
  });

  it("com atalho é o próprio selo que vira botão, com o balão Abrir tarefa", async () => {
    renderBadge({ overdueCount: 0, todayCount: 1, onOpen: vi.fn() });
    const badge = screen.getByRole("button", { name: "1 tarefa hoje. Abrir tarefa" });
    expect(badge).toHaveTextContent("1 tarefa hoje");
    fireEvent.focus(badge);
    expect((await screen.findAllByText("Abrir tarefa")).length).toBeGreaterThan(0);
  });

  it("plural no balão", () => {
    renderBadge({ overdueCount: 1, todayCount: 1, onOpen: vi.fn() });
    expect(screen.getByRole("button", { name: "1 atrasada · 1 hoje. Abrir tarefas" })).toBeInTheDocument();
  });

  it("clique abre o atalho e não chega ao card", () => {
    const onOpen = vi.fn();
    const onCard = vi.fn();
    const onCardPointer = vi.fn();
    render(
      <TooltipProvider>
        <div onClick={onCard} onPointerDown={onCardPointer}>
          <TaskAttentionBadge overdueCount={1} todayCount={0} onOpen={onOpen} />
        </div>
      </TooltipProvider>,
    );
    const badge = screen.getByTestId("task-attention-badge");
    fireEvent.pointerDown(badge);
    fireEvent.click(badge);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onCard).not.toHaveBeenCalled();
    expect(onCardPointer).not.toHaveBeenCalled();
  });
});

describe("selo no card do Kanban", () => {
  const deal = { id: "deal-1", dealCode: "VYN-000", contactName: "Contato Teste", personType: "Fisica", stage: "leads", value: 0, tags: [], history: [], tasks: [], notes: [] } as unknown as Deal;
  const renderCard = (props: Partial<Parameters<typeof DealCard>[0]>) =>
    render(
      <TooltipProvider>
        <DndContext>
          <SortableContext items={[deal.id]}>
            <DealCard deal={deal} onClick={props.onClick || (() => {})} {...props} />
          </SortableContext>
        </DndContext>
      </TooltipProvider>,
    );

  it("clicar no selo abre as tarefas, não a negociação", () => {
    const onClick = vi.fn();
    const onOpenTasks = vi.fn();
    renderCard({ onClick, onOpenTasks, overdueTaskCount: 1, todayTaskCount: 0 });
    // a raiz do card também é role=button (dnd-kit); o selo é o botão de dentro
    const badge = screen.getByTestId("task-attention-badge");
    expect(badge.tagName).toBe("BUTTON");
    fireEvent.click(badge);
    expect(onOpenTasks).toHaveBeenCalledWith(deal);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("card sendo arrastado (sem atalho) mostra o selo sem botão", () => {
    renderCard({ todayTaskCount: 2 });
    expect(screen.getByTestId("task-attention-badge")).toHaveTextContent("2 tarefas hoje");
    expect(screen.getByTestId("task-attention-badge").tagName).toBe("SPAN");
  });
});

describe("atalho: modal das tarefas", () => {
  const editTask = vi.fn(async (..._args: unknown[]) => {});
  const cancelTask = vi.fn(async () => {});
  const completeTask = vi.fn(async () => {});
  const addTask = vi.fn(async () => {});
  const baseDeal = {
    id: "deal-1", dealCode: "VYN-000", dealName: "Negociação de teste", assignedTo: "user-1",
    tasks: [
      task("amanha", "2026-09-24", "10:00"),
      task("hoje", "2026-09-23", "15:00"),
      task("ontem", "2026-09-22", "09:00"),
      task("feita", "2026-09-23", "15:00", { status: "completed" }),
    ],
  } as unknown as Deal;
  const setDeal = (deal: Deal) => useDealsStore.setState({ deals: [deal], editTask, cancelTask, completeTask, addTask } as never);
  const renderQuick = (onClose = vi.fn()) => {
    render(<DealTasksQuickDialog dealId="deal-1" onClose={onClose} userName="Pessoa Um" currentUserId="user-1" />);
    return onClose;
  };
  const rows = () => screen.queryAllByTestId("quick-task-row");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    useUsersStore.setState({ users: [{ id: "user-1", name: "Pessoa Um" }] } as never);
    setDeal(baseDeal);
  });
  afterEach(() => vi.useRealTimers());

  it("mostra só atrasadas e de hoje, atrasada primeiro", () => {
    renderQuick();
    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toHaveTextContent("Tarefa ontem");
    expect(rows()[0]).toHaveTextContent("Atrasada · 22/09 às 09:00");
    expect(rows()[1]).toHaveTextContent("Tarefa hoje");
    expect(rows()[1]).toHaveTextContent("Hoje às 15:00");
    expect(screen.getByText("VYN-000 · Negociação de teste")).toBeInTheDocument();
  });

  it("cancelar pede confirmação; Voltar não cancela", () => {
    renderQuick();
    fireEvent.click(within(rows()[0]).getByRole("button", { name: "Cancelar tarefa" }));
    expect(screen.getByText("Cancelar esta tarefa?")).toBeInTheDocument();
    expect(cancelTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(cancelTask).not.toHaveBeenCalled();
  });

  it("confirmar cancela a tarefa certa", () => {
    renderQuick();
    fireEvent.click(within(rows()[1]).getByRole("button", { name: "Cancelar tarefa" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar tarefa" }));
    expect(cancelTask).toHaveBeenCalledWith("deal-1", "hoje", "Pessoa Um");
  });

  it("concluir abre o fluxo completo dos detalhes (resultado obrigatório)", () => {
    renderQuick();
    fireEvent.click(within(rows()[0]).getByRole("button", { name: "Concluir tarefa" }));
    expect(screen.getByRole("heading", { name: "Concluir atividade" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Selecione o resultado")).toBeInTheDocument();
    // o atalho sai de cena enquanto o diálogo de ação está aberto
    expect(rows()).toHaveLength(0);
  });

  it("editar abre o formulário dos detalhes com a tarefa", () => {
    renderQuick();
    fireEvent.click(within(rows()[1]).getByRole("button", { name: "Editar tarefa" }));
    expect((screen.getByPlaceholderText("Ex: Ligação inicial, Follow Up...") as HTMLInputElement).value).toBe("Tarefa hoje");
  });

  it("adiar grava a nova data na tarefa certa", async () => {
    renderQuick();
    const trigger = within(rows()[1]).getByRole("button", { name: "Adiar tarefa" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Para amanhã" }));
    expect(editTask).toHaveBeenCalledWith("deal-1", "hoje", expect.objectContaining({ dueTime: "15:00" }), "Pessoa Um");
    const updates = editTask.mock.calls[0][2] as { dueDate: string };
    expect(new Date(updates.dueDate).getDate()).toBe(24);
  });

  it("sem tarefa atrasada ou de hoje, fecha sozinho", () => {
    setDeal({ ...baseDeal, tasks: [task("amanha", "2026-09-24", "10:00")] } as Deal);
    const onClose = renderQuick();
    expect(onClose).toHaveBeenCalled();
  });
});

// Pipeline.tsx é grande demais para render isolado: o contrato lê as ligações do atalho.
describe("Kanban e lista ligam o atalho", () => {
  const source = readFileSync(path.resolve(__dirname, "../pages/Pipeline.tsx"), "utf8").replace(/\r\n/g, "\n");

  it("as duas visões do Kanban (por etapa e por responsável) passam o atalho", () => {
    expect(source.match(/onDealOpenTasks=\{\(deal\) => setTasksDealId\(deal\.id\)\}/g)).toHaveLength(2);
  });

  it("a lista usa o mesmo selo, com atalho", () => {
    const start = source.indexOf('<TaskAttentionBadge\n');
    const badge = source.slice(start, source.indexOf("/>", start));
    expect(badge).toContain('size="list"');
    expect(badge).toContain("onOpen={() => setTasksDealId(deal.id)}");
  });

  it("o card que está sendo arrastado não abre atalho", () => {
    const start = source.indexOf("<DragOverlay");
    const overlay = source.slice(start, source.indexOf("</DragOverlay>", start));
    expect(overlay).toContain("overdueTaskCount=");
    expect(overlay).not.toContain("onOpenTasks");
  });

  it("um só modal, alimentado pela negociação escolhida", () => {
    expect(source.match(/<DealTasksQuickDialog/g)).toHaveLength(1);
    expect(source).toContain("dealId={tasksDealId}");
  });

  it("o selo antigo, só de hoje, não ficou para trás", () => {
    expect(source).not.toMatch(/dueTodayTaskCount|tarefa hoje/);
  });
});
