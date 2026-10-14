import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { type Deal, type DealTask, useDealsStore } from "@/lib/dealsStore";
import { useUsersStore } from "@/lib/usersStore";
import { ACTIVITY_TIME_OPTIONS, createActivityDateISO } from "@/lib/activityTypes";
import { parseLocalDateValue } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActivityTypeSelect } from "./ActivityTypeSelect";

interface Props {
  deal: Deal;
  /** Tarefa a editar; `null` fecha o diálogo. */
  task: DealTask | null;
  onClose: () => void;
  userName: string;
  defaultAssignee: string;
}

/**
 * Editar atividade. Extraído dos detalhes da negociação (23/09/2026) para o atalho do selo no
 * card usar o mesmo formulário.
 */
export function EditTaskDialog({ deal, task, onClose, userName, defaultAssignee }: Props) {
  const { editTask } = useDealsStore();
  const users = useUsersStore((s) => s.users);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDesc, setEditTaskDesc] = useState("");
  const [editTaskAssignedTo, setEditTaskAssignedTo] = useState("");
  const [editTaskType, setEditTaskType] = useState("Ligação");
  const [editTaskDate, setEditTaskDate] = useState("");
  const [editTaskTime, setEditTaskTime] = useState("");

  // Cada abertura carrega a tarefa (antes era o clique no lápis que preenchia o formulário).
  useEffect(() => {
    if (!task) return;
    setEditTaskTitle(task.title || "");
    setEditTaskDesc(task.description || "");
    const taskAssigned = Array.isArray(task.assignedTo) ? task.assignedTo[0] : task.assignedTo;
    setEditTaskAssignedTo(taskAssigned || defaultAssignee);
    setEditTaskType(task.taskType || "Ligação");
    setEditTaskDate(task.dueDate ? format(parseLocalDateValue(task.dueDate) || new Date(task.dueDate), "yyyy-MM-dd") : "");
    setEditTaskTime(task.dueTime || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const handleSaveEditTask = () => {
    if (!task) return;
    if (!editTaskTitle.trim()) {
      toast.error("O assunto da tarefa não pode estar vazio.");
      return;
    }
    editTask(deal.id, task.id, {
      title: editTaskTitle.trim(),
      description: editTaskDesc.trim(),
      assignedTo: editTaskAssignedTo,
      taskType: editTaskType,
      dueDate: createActivityDateISO(editTaskDate, editTaskTime),
      dueTime: editTaskTime || undefined,
      companyId: deal.companyId,
    }, userName);
    toast.success("Atividade editada com sucesso!");
    onClose();
  };

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">Editar atividade</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Empresa da negociação</Label>
            <Input
              value={deal.companyName || deal.contactName || "Sem Empresa"}
              disabled
              className="bg-muted text-muted-foreground disabled:opacity-100"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Negociação</Label>
            <Input
              value={deal.dealName || deal.contactName || "Sem Negociação"}
              disabled
              className="bg-muted text-muted-foreground disabled:opacity-100"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Assunto da tarefa <span className="text-red-500">*</span></Label>
            <Input
              placeholder="Ex: Ligação inicial, Follow Up..."
              value={editTaskTitle}
              onChange={(e) => setEditTaskTitle(e.target.value)}
              className="text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Descrição da tarefa</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none min-h-[80px]"
              placeholder="Detalhes adicionais..."
              value={editTaskDesc}
              onChange={(e) => setEditTaskDesc(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Responsável <span className="text-red-500">*</span></Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={editTaskAssignedTo}
              onChange={(e) => setEditTaskAssignedTo(e.target.value)}
            >
              <option value="">Selecione um responsável</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Tipo de Atividade <span className="text-red-500">*</span></Label>
            <ActivityTypeSelect value={editTaskType} onChange={setEditTaskType} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Data do agendamento</Label>
              <Input
                type="date"
                value={editTaskDate}
                onChange={(e) => setEditTaskDate(e.target.value)}
                className="text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Horário da tarefa</Label>
              <select
                value={editTaskTime}
                onChange={(e) => setEditTaskTime(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sem horário</option>
                {ACTIVITY_TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 mt-4 pt-4 border-t border-border/50">
          <Button type="button" variant="outline" className="font-semibold text-foreground" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" onClick={handleSaveEditTask}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
