import type { MouseEvent } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTaskAttentionLabel } from "@/lib/dealTaskAttention";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const TONE_TODAY =
  "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-300";
const TONE_OVERDUE =
  "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/20 dark:text-rose-300";

interface Props {
  overdueCount: number;
  todayCount: number;
  /** Com `onOpen`, o selo vira o atalho para as tarefas; sem ele (ex.: card sendo arrastado), só informa. */
  onOpen?: () => void;
  size?: "card" | "list";
}

/**
 * Selo de tarefas do card e da lista (23/09/2026). O próprio selo é o botão: nenhum elemento novo
 * no card, só o balão "Abrir tarefa" no hover (pedido do operador para não poluir o card).
 */
export function TaskAttentionBadge({ overdueCount, todayCount, onOpen, size = "card" }: Props) {
  const label = getTaskAttentionLabel(overdueCount, todayCount);
  if (!label) return null;

  const total = overdueCount + todayCount;
  const hint = total === 1 ? "Abrir tarefa" : "Abrir tarefas";
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-full border font-semibold",
    size === "card" ? "px-2.5 py-1 text-[10px]" : "gap-1 px-2 py-0.5 text-[10px]",
    overdueCount > 0 ? TONE_OVERDUE : TONE_TODAY,
  );

  if (!onOpen) {
    return (
      <span data-testid="task-attention-badge" className={className}>
        <Clock className="h-3 w-3 shrink-0" />
        {label}
      </span>
    );
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // O card é arrastável e o clique nele abre a negociação: o selo não pode acionar nenhum dos dois.
    event.preventDefault();
    event.stopPropagation();
    onOpen();
  };

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid="task-attention-badge"
          aria-label={`${label}. ${hint}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={handleClick}
          className={cn(className, "cursor-pointer transition-opacity hover:opacity-80")}
        >
          <Clock className="h-3 w-3 shrink-0" />
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{hint}</TooltipContent>
    </Tooltip>
  );
}
