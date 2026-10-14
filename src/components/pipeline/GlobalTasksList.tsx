import { useEffect, useMemo, useState } from "react";
import { useDealsStore, type Deal, type DealTask } from "@/lib/dealsStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { useUsersStore } from "@/lib/usersStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Inbox, CheckCircle2, Clock, AlertCircle, XCircle, Search, X } from "lucide-react";
import { getDueDateTime, parseLocalDateValue } from "@/lib/utils";
import { canViewAssignedRecord } from "@/lib/permissions";
import { ACTIVITY_TYPES } from "@/lib/activityTypes";
import {
  DEFAULT_TASK_FILTERS,
  TASK_FILTERS_STORAGE_KEY,
  countActiveTaskFilters,
  matchesTaskFilters,
  readStoredTaskFilters,
  type TaskFilters,
} from "@/lib/taskFilters";
import type { Role } from "@/lib/rolesStore";
import type { UserProfile } from "@/lib/usersStore";

/** O `sessionStorage` pode lançar antes de devolver valor (aba anônima, site data bloqueado). */
const readSessionItem = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

interface Props {
  onOpenDeal: (dealId: string) => void;
  filter?: "all" | "overdue";
  currentUser?: UserProfile;
  currentUserRole?: Role;
}

type GlobalTask = DealTask & {
  dealId: string;
  dealName: string;
  dealValue: number;
  assignedNames: string[];
};

type TaskStatusBadge = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ReactNode;
};

export function GlobalTasksList({ onOpenDeal, filter = "all", currentUser, currentUserRole }: Props) {
  const { deals } = useDealsStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const users = useUsersStore((state) => state.users);

  const [filters, setFilters] = useState<TaskFilters>(() => {
    const stored = readStoredTaskFilters(readSessionItem(TASK_FILTERS_STORAGE_KEY));
    return { ...stored, status: filter === "overdue" ? "overdue" : stored.status };
  });

  /**
   * O filtro sobrevive a abrir a negociação e voltar. Sem isto, a lista voltava zerada mesmo com o
   * "voltar" já devolvendo à Tarefas — eram dois defeitos, e consertar só a navegação não bastava.
   */
  useEffect(() => {
    try {
      sessionStorage.setItem(TASK_FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // Aba anônima ou cota estourada: o filtro só não sobrevive à ida e volta. Não é erro de tela.
    }
  }, [filters]);

  /**
   * O Dashboard abre esta tela com `?filter=overdue`. Isso vira o valor do seletor de status em vez
   * de um recorte fixo por cima: o vendedor vê de onde veio o recorte e consegue desfazê-lo.
   */
  useEffect(() => {
    setFilters((current) => ({ ...current, status: filter === "overdue" ? "overdue" : current.status }));
  }, [filter]);

  const getAssignedNames = useMemo(
    () => (assignedTo: DealTask["assignedTo"]) => {
      const values = Array.isArray(assignedTo) ? assignedTo : assignedTo ? [assignedTo] : [];
      return values.map((value) => users.find((user) => user.id === value)?.name || value);
    },
    [users],
  );

  const filteredDeals = useMemo(
    () =>
      activeWorkspaceId ? deals.filter((d: Deal) => d.workspaceId === activeWorkspaceId) : deals,
    [deals, activeWorkspaceId],
  );

  const allTasks = useMemo(() => {
    const tasks: GlobalTask[] = [];
    filteredDeals.forEach((deal) => {
      if (deal.tasks && deal.tasks.length > 0) {
        deal.tasks.forEach((task) => {
          if (!canViewAssignedRecord(currentUserRole, currentUser, task.assignedTo, "tasks")) return;

          tasks.push({
            ...task,
            dealId: deal.id,
            dealName: deal.dealName || deal.contactName || "Sem Nome",
            dealValue: deal.value || 0,
            assignedNames: getAssignedNames(task.assignedTo),
          });
        });
      }
    });

    return tasks.sort((a, b) => {
      const statusA = a.status || (a.completed ? "completed" : "pending");
      const statusB = b.status || (b.completed ? "completed" : "pending");
      if (statusA !== statusB) return statusA === "pending" ? -1 : statusB === "pending" ? 1 : 0;

      const dateA = getDueDateTime(a.dueDate, a.dueTime)?.getTime() ?? 0;
      const dateB = getDueDateTime(b.dueDate, b.dueTime)?.getTime() ?? 0;
      return dateA - dateB;
    });
  }, [currentUser, currentUserRole, filteredDeals, getAssignedNames]);

  const visibleTasks = useMemo(() => allTasks.filter((task) => matchesTaskFilters(task, filters)), [allTasks, filters]);

  const activeFilterCount = countActiveTaskFilters(filters);

  const assignableUsers = useMemo(
    () => users.filter((user) => !activeWorkspaceId || user.workspaces?.includes(activeWorkspaceId) || user.workspaces?.includes("all")),
    [activeWorkspaceId, users],
  );

  const taskTypeOptions = useMemo(() => {
    const fromTasks = allTasks.map((task) => task.taskType).filter((type): type is string => Boolean(type));
    return Array.from(new Set([...ACTIVITY_TYPES, ...fromTasks])).sort((a, b) => a.localeCompare(b));
  }, [allTasks]);

  const updateFilter = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const getTaskStatus = (task: GlobalTask): TaskStatusBadge => {
    const status = task.status || (task.completed ? "completed" : "pending");
    if (status === "completed") return { label: "Concluida", variant: "secondary", icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> };
    if (status === "cancelled") return { label: "Cancelada", variant: "outline", icon: <XCircle className="w-3.5 h-3.5 mr-1" /> };

    const dueDateTime = getDueDateTime(task.dueDate, task.dueTime);
    if (dueDateTime && dueDateTime.getTime() < Date.now()) {
      return { label: "Atrasada", variant: "destructive", icon: <AlertCircle className="w-3.5 h-3.5 mr-1" /> };
    }

    return { label: "Aberta em dia", variant: "default", icon: <Clock className="w-3.5 h-3.5 mr-1" /> };
  };

  const formatTaskDate = (task: GlobalTask) => {
    if (!task.dueDate) return "Sem data";
    try {
      const date = parseLocalDateValue(task.dueDate) || new Date(task.dueDate);
      const dateStr = format(date, "dd/MM/yyyy");
      const timeStr = task.dueTime ? ` as ${task.dueTime}` : "";
      return `${dateStr}${timeStr}`;
    } catch {
      return "Data invalida";
    }
  };

  const getAssignedText = (task: GlobalTask) => (task.assignedNames.length > 0 ? task.assignedNames.join(", ") : "-");

  return (
    <div className="bg-card rounded-md border shadow-sm flex-1 overflow-hidden flex flex-col">
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-[320px] min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Buscar por assunto, negociação, responsável..."
              aria-label="Buscar tarefas"
              className="pl-9"
            />
          </div>

          <Select value={filters.status} onValueChange={(value) => updateFilter("status", value as TaskFilters["status"])}>
            <SelectTrigger className="h-10 w-[170px]" aria-label="Filtrar por status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Aberta em dia</SelectItem>
              <SelectItem value="overdue">Atrasada</SelectItem>
              <SelectItem value="completed">Concluída</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.assignedTo} onValueChange={(value) => updateFilter("assignedTo", value)}>
            <SelectTrigger className="h-10 w-[190px]" aria-label="Filtrar por responsável">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              <SelectItem value="unassigned">Sem responsável</SelectItem>
              {assignableUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.taskType} onValueChange={(value) => updateFilter("taskType", value)}>
            <SelectTrigger className="h-10 w-[180px]" aria-label="Filtrar por tipo de atividade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {taskTypeOptions.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.due} onValueChange={(value) => updateFilter("due", value as TaskFilters["due"])}>
            <SelectTrigger className="h-10 w-[180px]" aria-label="Filtrar por vencimento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer vencimento</SelectItem>
              <SelectItem value="today">Vence hoje</SelectItem>
              <SelectItem value="next7">Próximos 7 dias</SelectItem>
              <SelectItem value="overdue">Vencidas</SelectItem>
              <SelectItem value="custom">Intervalo…</SelectItem>
            </SelectContent>
          </Select>

          {filters.due === "custom" ? (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filters.dueFrom}
                onChange={(event) => updateFilter("dueFrom", event.target.value)}
                aria-label="Vencimento de"
                className="h-10 w-[150px]"
              />
              <span className="text-sm text-muted-foreground">até</span>
              <Input
                type="date"
                value={filters.dueTo}
                onChange={(event) => updateFilter("dueTo", event.target.value)}
                aria-label="Vencimento até"
                className="h-10 w-[150px]"
              />
            </div>
          ) : null}

          {activeFilterCount > 0 ? (
            <Button variant="ghost" className="h-10 gap-1.5" onClick={() => setFilters({ ...DEFAULT_TASK_FILTERS })}>
              <X className="h-4 w-4" />
              Limpar filtros ({activeFilterCount})
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {visibleTasks.length === allTasks.length
            ? `${allTasks.length} ${allTasks.length === 1 ? "tarefa" : "tarefas"}`
            : `${visibleTasks.length} de ${allTasks.length} tarefas`}
        </p>
      </div>

      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b hover:bg-muted/50">
              <TableHead className="font-semibold text-muted-foreground h-10 align-middle">Atividade</TableHead>
              <TableHead className="font-semibold text-muted-foreground h-10 align-middle">Status</TableHead>
              <TableHead className="font-semibold text-muted-foreground h-10 align-middle">Data e hora</TableHead>
              <TableHead className="font-semibold text-muted-foreground h-10 align-middle">Responsavel</TableHead>
              <TableHead className="font-semibold text-muted-foreground h-10 align-middle">Negociacao</TableHead>
              <TableHead className="font-semibold text-muted-foreground h-10 align-middle">Valor Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleTasks.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground opacity-60">
                    <Inbox className="w-16 h-16 stroke-[1] mb-4 text-muted-foreground/30" />
                    <span className="text-sm font-medium">
                      {allTasks.length === 0 ? "Não há atividades criadas" : "Nenhuma atividade para os filtros escolhidos"}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visibleTasks.map((task) => {
                const status = getTaskStatus(task);
                return (
                  <TableRow
                    key={`${task.dealId}-${task.id}`}
                    className="hover:bg-muted/50 transition-colors motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-reduce:animate-none"
                  >
                    <TableCell className="py-3">
                      <button
                        onClick={() => onOpenDeal(task.dealId)}
                        className="font-semibold text-primary hover:underline flex items-center text-left"
                      >
                        {task.taskType ? `${task.taskType} - ` : ""}{task.title}
                      </button>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant={status.variant} className="flex w-fit items-center whitespace-nowrap">
                        {status.icon}
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-muted-foreground text-sm">
                      {formatTaskDate(task)}
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      {getAssignedText(task)}
                    </TableCell>
                    <TableCell className="py-3 font-medium text-foreground">
                      {task.dealName}
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      {formatCurrency(task.dealValue)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
