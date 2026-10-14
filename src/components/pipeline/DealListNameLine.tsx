import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STALE_ACTIVITY_LABEL, staleBadgeFits } from "@/lib/staleActivityBadge";

const STALE_TONE =
  "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-300";

interface Props {
  name: string;
  hasStaleActivity: boolean;
  /** Selos que seguem o nome na mesma linha (hoje, o de tarefas). */
  trailing?: ReactNode;
}

/**
 * Linha do nome na lista do Pipeline (23/09/2026, pedido do operador): o selo "Sem atividade" nunca
 * desce para a linha de baixo. Se o texto por extenso não couber ao lado do nome, vira só o triângulo
 * (o texto fica no balão e no leitor de tela), como no card do Kanban. O nome não é abreviado.
 */
export function DealListNameLine({ name, hasStaleActivity, trailing }: Props) {
  const lineRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const trailingRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    const line = lineRef.current;
    const ghost = ghostRef.current;
    if (!hasStaleActivity || !line || !ghost) return;

    const measure = () => {
      const gap = Number.parseFloat(getComputedStyle(line).columnGap) || 0;
      const fits = staleBadgeFits({
        available: line.clientWidth,
        fullWidth: ghost.offsetWidth,
        trailingWidth: trailingRef.current ? trailingRef.current.offsetWidth : null,
        gap,
      });
      setCompact(!fits);
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(line);
    observer.observe(ghost);
    if (trailingRef.current) observer.observe(trailingRef.current);
    return () => observer.disconnect();
  }, [hasStaleActivity, name]);

  return (
    <div className="relative">
      <div ref={lineRef} data-testid="deal-list-name-line" className="flex flex-nowrap items-center gap-2">
        <p className="min-w-0 font-semibold text-foreground">{name}</p>
        {hasStaleActivity ? (
          compact ? (
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <span
                  data-testid="stale-activity-badge"
                  data-compact="true"
                  role="img"
                  aria-label={STALE_ACTIVITY_LABEL}
                  className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", STALE_TONE)}
                >
                  <AlertTriangle className="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{STALE_ACTIVITY_LABEL}</TooltipContent>
            </Tooltip>
          ) : (
            <span
              data-testid="stale-activity-badge"
              data-compact="false"
              className={cn(
                "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                STALE_TONE,
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              {STALE_ACTIVITY_LABEL}
            </span>
          )
        ) : null}
        {trailing ? (
          <div ref={trailingRef} className="flex shrink-0 items-center">
            {trailing}
          </div>
        ) : null}
      </div>

      {hasStaleActivity ? (
        // Régua invisível: nome + selo por extenso sem quebra. Fica num recorte de tamanho zero para
        // não criar rolagem na tabela nem ocupar espaço.
        <div aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden">
          <div ref={ghostRef} className="flex w-max items-center gap-2 whitespace-nowrap">
            <p className="font-semibold">{name}</p>
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold">
              <AlertTriangle className="h-3 w-3" />
              {STALE_ACTIVITY_LABEL}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
