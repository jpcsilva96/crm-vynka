import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { type Deal, useDealsStore } from "@/lib/dealsStore";
import { ActivityTypeSelect } from "./ActivityTypeSelect";
import { ACTIVITY_TIME_OPTIONS, createActivityDateISO } from "@/lib/activityTypes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal;
  users: { id: string; name: string }[];
  defaultAssigneeId?: string;
  userName?: string;
}

export function CreateActivityDialog({ open, onOpenChange, deal, users, defaultAssigneeId, userName }: Props) {
  const { addTask } = useDealsStore();

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskType, setTaskType] = useState("Ligação");
  const [taskDate, setTaskDate] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [assignedTo, setAssignedTo] = useState(deal.assignedTo || defaultAssigneeId || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!taskTitle.trim()) {
      toast.error("O assunto da tarefa não pode estar vazio.");
      return;
    }
    if (!assignedTo) {
      toast.error("Selecione pelo menos um responsável.");
      return;
    }
    setIsSaving(true);
    try {
      await addTask(deal.id, {
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        dueDate: createActivityDateISO(taskDate, taskTime),
        dueTime: taskTime || undefined,
        assignedTo,
        taskType,
        companyId: deal.companyId,
        status: "pending",
      }, userName);
      toast.success("Atividade adicionada!");
      handleClose();
    } catch (error) {
      console.error("Error creating activity:", error);
      toast.error("Não foi possível criar a atividade. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : handleClose())}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">Incluir atividade</DialogTitle>
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
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Descrição da tarefa</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none min-h-[80px]"
              placeholder="Detalhes adicionais..."
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Tipo de Atividade <span className="text-red-500">*</span></Label>
            <ActivityTypeSelect value={taskType} onChange={setTaskType} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Responsável <span className="text-red-500">*</span></Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="">Selecione um responsável</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Data do agendamento</Label>
              <Input
                type="date"
                value={taskDate}
                onChange={(e) => setTaskDate(e.target.value)}
                className="text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Hora do Agendamento</Label>
              <select
                value={taskTime}
                onChange={(e) => setTaskTime(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sem horário</option>
                {ACTIVITY_TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 mt-4 pt-4 border-t border-border/50">
          <Button type="button" variant="outline" className="font-semibold text-foreground" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" onClick={handleCreate}>
            Criar atividade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
