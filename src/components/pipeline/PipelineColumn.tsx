import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Deal } from "@/lib/dealsStore";
import { hexToRgba, normalizeStageColor } from "@/lib/pipelineStageColors";
import { DealCard, type CardVisibleFields } from "./DealCard";

interface Props {
  id: string;
  droppableId?: string;
  label: string;
  stageColor?: string;
  probability?: number;
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  onDealCreateActivity?: (deal: Deal) => void;
  visibleFields?: CardVisibleFields;
  dropHighlighted?: boolean;
  variant?: "default" | "swimlane";
  visibleCount?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  getDealHasOverdueClosingDate?: (dealId: string) => boolean;
  getDealHasStaleActivity?: (dealId: string) => boolean;
  getDealTaskCounts?: (dealId: string) => { overdue: number; today: number } | undefined;
  onDealOpenTasks?: (deal: Deal) => void;
}

export function PipelineColumn({
  id,
  droppableId,
  label,
  stageColor,
  probability,
  deals,
  onDealClick,
  onDealCreateActivity,
  visibleFields,
  dropHighlighted = false,
  variant = "default",
  visibleCount,
  hasMore = false,
  onLoadMore,
  getDealHasOverdueClosingDate,
  getDealHasStaleActivity,
  getDealTaskCounts,
  onDealOpenTasks,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId || id,
    data: { type: "stage", stageId: id },
  });

  const rawTotalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
  const weightedTotalValue = rawTotalValue * ((probability ?? 100) / 100);
  const visibleDeals = typeof visibleCount === "number" ? deals.slice(0, visibleCount) : deals;
  const formatValue = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const resolvedColor = normalizeStageColor(stageColor, id, label);
  const badgeStyle = {
    backgroundColor: hexToRgba(resolvedColor, 0.12),
    borderColor: hexToRgba(resolvedColor, 0.2),
    color: resolvedColor,
  };
  const dropStateStyle = isOver
    ? {
        borderColor: hexToRgba(resolvedColor, 0.45),
        backgroundColor: hexToRgba(resolvedColor, 0.06),
      }
    : undefined;
  const emptyStateStyle = isOver
    ? {
        borderColor: hexToRgba(resolvedColor, 0.45),
        backgroundColor: hexToRgba(resolvedColor, 0.06),
        color: resolvedColor,
      }
    : {
        borderColor: hexToRgba(resolvedColor, 0.18),
      };

  return (
    <div
      ref={setNodeRef}
      style={dropStateStyle}
      className={`crm-stage-glow flex min-h-0 shrink-0 flex-col rounded-2xl border border-border/70 bg-muted/20 shadow-sm transition-all duration-300 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 motion-reduce:animate-none ${
        variant === "swimlane" ? "h-[420px] w-[320px] min-w-[320px]" : "h-full w-[352px] min-w-[352px]"
      } ${dropHighlighted ? "animate-drop-flash ring-2 ring-primary/25" : ""}`}
    >
      <div className="border-b border-border/70 bg-background/88 px-4 py-3.5 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <span
              className="inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
              style={badgeStyle}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: resolvedColor }} />
              <span className="truncate">{label}</span>
            </span>
            <p className="text-sm font-medium text-muted-foreground">{formatValue(weightedTotalValue)}</p>
          </div>
          <span className="mt-0.5 inline-flex min-w-[22px] items-center justify-center text-sm font-bold" style={{ color: resolvedColor }}>
            {deals.length}
          </span>
        </div>
      </div>

      <SortableContext items={visibleDeals.map((deal) => deal.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3 pt-2.5">
          {visibleDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onClick={onDealClick}
              onCreateActivity={onDealCreateActivity}
              visibleFields={visibleFields}
              stageColor={resolvedColor}
              hasOverdueClosingDate={getDealHasOverdueClosingDate?.(deal.id)}
              hasStaleActivity={getDealHasStaleActivity?.(deal.id)}
              overdueTaskCount={getDealTaskCounts?.(deal.id)?.overdue}
              todayTaskCount={getDealTaskCounts?.(deal.id)?.today}
              onOpenTasks={onDealOpenTasks}
            />
          ))}

          {hasMore && onLoadMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              className="mt-3 rounded-xl border border-dashed border-primary/20 bg-background/80 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              Mostrar mais {deals.length - visibleDeals.length} negocio{deals.length - visibleDeals.length === 1 ? "" : "s"}
            </button>
          ) : null}

          {deals.length === 0 && (
            <div
              style={emptyStateStyle}
              className={`flex flex-1 items-center justify-center rounded-xl border border-dashed bg-background/70 px-6 text-center transition-colors ${
                variant === "swimlane" ? "min-h-[180px]" : "min-h-[260px]"
              } ${isOver ? "" : "text-muted-foreground"}`}
            >
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Solte uma negociação aqui</p>
                <p className="text-xs text-muted-foreground">Arraste cards para mover esta etapa do pipeline.</p>
              </div>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
