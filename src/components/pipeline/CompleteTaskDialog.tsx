import { useEffect, useState } from "react";
import { toast } from "sonner";
import { type Deal, type DealTask, useDealsStore } from "@/lib/dealsStore";
import { useUsersStore } from "@/lib/usersStore";
import { ACTIVITY_RESULTS, ACTIVITY_TIME_OPTIONS, createActivityDateISO, getTaskResponsibleName } from "@/lib/activityTypes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActivityTypeSelect } from "./ActivityTypeSelect";

interface Props {
  deal: Deal;
  /** Tarefa a concluir; `null` fecha o diálogo. */
  task: DealTask | null;
  onClose: () => void;
  userName: string;
  defaultAssignee: string;
  /** Chamado antes de gravar e depois de gravar (a lista dos detalhes anima a saída da tarefa). */
  onCompleteStart?: (taskId: string) => void;
  onCompleteEnd?: (taskId: string) => void;
}

/**
 * Concluir atividade: resultado obrigatório, observações e, opcionalmente, a próxima atividade.
 * Extraído dos detalhes da negociação (23/09/2026) para o atalho do selo no card usar o mesmo fluxo.
 */
export function CompleteTaskDialog({ deal, task, onClose, userName, defaultAssignee, onCompleteStart, onCompleteEnd }: Props) {
  const { addTask, completeTask } = useDealsStore();
  const users = useUsersStore((s) => s.users);
  const [activityResult, setActivityResult] = useState("");
  const [activityResultNotes, setActivityResultNotes] = useState("");
  const [createNextActivity, setCreateNextActivity] = useState(false);
  const [nextActivityType, setNextActivityType] = useState("Ligação");
  const [nextActivityTitle, setNextActivityTitle] = useState("");
  const [nextActivityDate, setNextActivityDate] = useState("");
  const [nextActivityTime, setNextActivityTime] = useState("");
  const [nextActivityAssignedTo, setNextActivityAssignedTo] = useState("");

  // Cada abertura começa limpa (antes era o clique em concluir que zerava o formulário).
  useEffect(() => {
    if (!task) return;
    setActivityResult("");
    setActivityResultNotes("");
    setCreateNextActivity(false);
    setNextActivityType("Ligação");
    setNextActivityTitle("");
    setNextActivityDate("");
    setNextActivityTime("");
    setNextActivityAssignedTo(defaultAssignee);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const handleCompleteActivity = async () => {
    if (!task) return;
    if (!activityResult) {
      toast.error("Selecione o resultado da atividade.");
      return;
    }
    if (createNextActivity && !nextActivityTitle.trim()) {
      toast.error("Informe o assunto da próxima atividade.");
      return;
    }
    if (createNextActivity && !nextActivityAssignedTo) {
      toast.error("Selecione o responsável da próxima atividade.");
      return;
    }

    onCompleteStart?.(task.id);

    await completeTask(deal.id, task.id, {
      activityResult,
      resultNotes: activityResultNotes.trim() || undefined,
    }, userName);

    if (createNextActivity) {
      await addTask(deal.id, {
        title: nextActivityTitle.trim(),
        description: "",
        dueDate: createActivityDateISO(nextActivityDate, nextActivityTime),
        dueTime: nextActivityTime || undefined,
        assignedTo: nextActivityAssignedTo,
        taskType: nextActivityType,
        companyId: deal.companyId,
        status: "pending",
      }, userName);
    }

    toast.success(createNextActivity ? "Atividade concluída e próxima atividade criada." : "Atividade concluída.");
    onCompleteEnd?.(task.id);
    onClose();
  };

  return (
    <Dialog
      open={!!task}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">Concluir atividade</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {task && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-semibold text-foreground">
                {task.taskType || "Tarefa interna"} - {task.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Responsável: {getTaskResponsibleName(users, task.assignedTo)}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Resultado da atividade <span className="text-red-500">*</span></Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={activityResult}
              onChange={(e) => setActivityResult(e.target.value)}
            >
              <option value="">Selecione o resultado</option>
              {ACTIVITY_RESULTS.map((result) => <option key={result} value={result}>{result}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Observações</Label>
            <Textarea
              placeholder="Ex: Cliente vai apresentar a proposta para o gerente e pediu retorno na sexta-feira."
              value={activityResultNotes}
              onChange={(event) => setActivityResultNotes(event.target.value)}
              className="min-h-[96px]"
            />
          </div>

          <label className="flex items-center gap-3 rounded-md border p-3 text-sm font-medium text-foreground">
            <Checkbox checked={createNextActivity} onCheckedChange={(checked) => setCreateNextActivity(checked === true)} />
            Criar próxima atividade
          </label>

          {createNextActivity && (
            <div className="space-y-4 rounded-md border bg-muted/20 p-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Tipo da próxima atividade</Label>
                <ActivityTypeSelect value={nextActivityType} onChange={setNextActivityType} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Assunto <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Ex: Retorno sobre análise da proposta"
                  value={nextActivityTitle}
                  onChange={(event) => setNextActivityTitle(event.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">Data</Label>
                  <Input type="date" value={nextActivityDate} onChange={(event) => setNextActivityDate(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">Horário</Label>
                  <select
                    value={nextActivityTime}
                    onChange={(event) => setNextActivityTime(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Sem horário</option>
                    {ACTIVITY_TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Responsável <span className="text-red-500">*</span></Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={nextActivityAssignedTo}
                  onChange={(event) => setNextActivityAssignedTo(event.target.value)}
                >
                  <option value="">Selecione um responsável</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3 mt-4 pt-4 border-t border-border/50">
          <Button type="button" variant="outline" className="font-semibold text-foreground" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" onClick={handleCompleteActivity}>
            Concluir atividade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
