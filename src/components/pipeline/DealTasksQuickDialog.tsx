import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, Clock, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { type DealTask, useDealsStore } from "@/lib/dealsStore";
import { useUsersStore } from "@/lib/usersStore";
import { getTaskResponsibleName } from "@/lib/activityTypes";
import { getDealTaskAttention } from "@/lib/dealTaskAttention";
import { TASK_DELAY_OPTIONS, getTaskDelayUpdates, type TaskDelayMode } from "@/lib/taskDelay";
import { cn, getDueDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CompleteTaskDialog } from "./CompleteTaskDialog";
import { EditTaskDialog } from "./EditTaskDialog";

interface Props {
  /** Negociação cujas tarefas abrir; `null` fecha. */
  dealId: string | null;
  onClose: () => void;
  userName: string;
  currentUserId?: string;
}

const dueLabel = (task: DealTask, overdue: boolean) => {
  const due = getDueDateTime(task.dueDate, task.dueTime);
  const time = task.dueTime ? ` às ${task.dueTime}` : "";
  if (!overdue) return `Hoje${time}`;
  return due ? `Atrasada · ${format(due, "dd/MM")}${time}` : "Atrasada";
};

/**
 * Atalho do selo de tarefas no card e na lista (23/09/2026): só as tarefas atrasadas e de hoje da
 * negociação, com editar, adiar, cancelar e concluir. Concluir e editar usam os mesmos diálogos dos
 * detalhes; cancelar pede confirmação, porque um clique perdido no card é mais provável que nos detalhes.
 */
export function DealTasksQuickDialog({ dealId, onClose, userName, currentUserId }: Props) {
  const deal = useDealsStore((state) => (dealId ? state.deals.find((d) => d.id === dealId) : undefined));
  const { editTask, cancelTask } = useDealsStore();
  const users = useUsersStore((s) => s.users);
  const [taskToComplete, setTaskToComplete] = useState<DealTask | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<DealTask | null>(null);
  const [taskToCancel, setTaskToCancel] = useState<DealTask | null>(null);

  const attention = useMemo(() => getDealTaskAttention(deal?.tasks, new Date()), [deal?.tasks]);
  const rows = [
    ...attention.overdue.map((task) => ({ task, overdue: true })),
    ...attention.today.map((task) => ({ task, overdue: false })),
  ];
  const subDialogOpen = !!taskToComplete || !!taskToEdit || !!taskToCancel;

  // Resolvida a última tarefa, o atalho fecha sozinho em vez de ficar aberto vazio.
  useEffect(() => {
    if (dealId && deal && rows.length === 0 && !subDialogOpen) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, deal, rows.length, subDialogOpen]);

  if (!deal) return null;
  const defaultAssignee = deal.assignedTo || currentUserId || "";

  const handleDelay = (task: DealTask, mode: TaskDelayMode, label: string) => {
    void editTask(deal.id, task.id, getTaskDelayUpdates(task, mode), userName).then(() => {
      toast.success(`Atividade adiada para ${label.toLowerCase()}.`);
    });
  };

  const handleConfirmCancel = () => {
    if (!taskToCancel) return;
    const task = taskToCancel;
    setTaskToCancel(null);
    void cancelTask(deal.id, task.id, userName).then(() => toast.success("Atividade cancelada"));
  };

  return (
    <>
      {/* Some enquanto um diálogo de ação está aberto, para não empilhar dois modais. */}
      <Dialog open={!!dealId && !subDialogOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">{rows.length === 1 ? "Tarefa" : "Tarefas"}</DialogTitle>
            <DialogDescription>
              {[deal.dealCode, deal.dealName || deal.contactName].filter(Boolean).join(" · ")}
            </DialogDescription>
          </DialogHeader>

          {/* min-w-0: o DialogContent é grid; sem isso o título longo alarga o modal. */}
          <div className="min-w-0 space-y-2">
            {rows.map(({ task, overdue }) => (
              <div key={task.id} data-testid="quick-task-row" className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-sm font-semibold text-foreground" title={task.title}>
                    {task.taskType || "Tarefa interna"} · {task.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className={cn(overdue && "font-semibold text-rose-600 dark:text-rose-400")}>{dueLabel(task, overdue)}</span>
                    {" · "}
                    {getTaskResponsibleName(users, task.assignedTo)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label="Editar tarefa" title="Editar" className="w-8 h-8 text-primary hover:bg-primary/10 rounded-full" onClick={() => setTaskToEdit(task)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Adiar tarefa" title="Adiar" className="w-8 h-8 text-primary hover:bg-primary/10 rounded-full">
                        <Clock className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {TASK_DELAY_OPTIONS.map((option) => (
                        <DropdownMenuItem key={option.mode} onClick={() => handleDelay(task, option.mode, option.label)}>
                          {option.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="icon" aria-label="Cancelar tarefa" title="Cancelar" className="w-8 h-8 text-rose-600 hover:bg-rose-50 rounded-full" onClick={() => setTaskToCancel(task)}>
                    <X className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Concluir tarefa" title="Concluir" className="w-8 h-8 bg-cyan-100 text-cyan-600 hover:bg-cyan-200 hover:text-cyan-700 rounded-xl" onClick={() => setTaskToComplete(task)}>
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <CompleteTaskDialog
        deal={deal}
        task={taskToComplete}
        onClose={() => setTaskToComplete(null)}
        userName={userName}
        defaultAssignee={defaultAssignee}
      />

      <EditTaskDialog
        deal={deal}
        task={taskToEdit}
        onClose={() => setTaskToEdit(null)}
        userName={userName}
        defaultAssignee={defaultAssignee}
      />

      <AlertDialog open={!!taskToCancel} onOpenChange={(open) => !open && setTaskToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              {taskToCancel ? `"${taskToCancel.title}" sai das próximas atividades e fica no histórico como cancelada.` : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={handleConfirmCancel}>
              Cancelar tarefa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
