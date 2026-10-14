import { useState } from "react";
import { useDealsStore, STAGES, type DealStage, type DealTag, type Deal } from "@/lib/dealsStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { useCRMPipelinesStore } from "@/lib/crmPipelinesStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, DollarSign, Tag, StickyNote, Plus, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  phone: string;
}

export function DealCrmActions({ phone }: Props) {
  const deal = useDealsStore((s) => s.getDealByPhone(phone));
  const { updateDeal, moveDeal, addDeal, addNote } = useDealsStore();
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const pipelines = useCRMPipelinesStore((state) => state.getPipelines(activeWorkspaceId).filter((pipeline) => pipeline.isActive));
  const [editingValue, setEditingValue] = useState(false);
  const [tempValue, setTempValue] = useState("");
  const [noteText, setNoteText] = useState("");
  const [showNote, setShowNote] = useState(false);

  if (!deal) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => {
            const defaultPipeline = pipelines[0];
            if (!activeWorkspaceId || !defaultPipeline) {
              toast.error("Selecione um workspace com pipeline ativo.");
              return;
            }
            addDeal({
              pipelineId: defaultPipeline.id,
              phone,
              contactName: phone,
              stage: "leads",
              value: 0,
              tags: [],
              notes: [],
              workspaceId: activeWorkspaceId,
            });
            toast.success("Oportunidade criada!");
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Criar Oportunidade
        </Button>
      </div>
    );
  }

  const formatValue = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const toggleTag = (t: DealTag) => {
    const newTags = deal.tags.includes(t)
      ? deal.tags.filter((x) => x !== t)
      : [...deal.tags, t];
    updateDeal(deal.id, { tags: newTags });
  };

  const handleSaveValue = () => {
    updateDeal(deal.id, { value: parseFloat(tempValue) || 0 });
    setEditingValue(false);
    toast.success("Valor atualizado");
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote(deal.id, noteText.trim());
    setNoteText("");
    setShowNote(false);
    toast.success("Nota adicionada");
  };

  return (
    <div className="flex items-center gap-2">
      {/* Stage */}
      <div className="flex items-center gap-1">
        <Target className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          className="h-7 rounded-md border border-input bg-background px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
          value={deal.stage}
          onChange={(e) => {
            const nextStage = e.target.value as DealStage;
            const nextStageLabel = STAGES.find((stage) => stage.id === nextStage)?.label;
            moveDeal(deal.id, nextStage, undefined, nextStageLabel);
            toast.success("Etapa atualizada");
          }}
        >
          {STAGES.filter(s => s.id !== "won" && s.id !== "lost").map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Value */}
      <div className="flex items-center gap-1">
        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
        {editingValue ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              className="h-7 w-24 text-[11px]"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveValue()}
              autoFocus
            />
            <button onClick={handleSaveValue} className="text-primary hover:text-primary/80">
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setTempValue(String(deal.value)); setEditingValue(true); }}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            {formatValue(deal.value)}
          </button>
        )}
      </div>

      {/* Tags */}
      <div className="flex items-center gap-1">
        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
        {(["hot", "cold", "urgent"] as DealTag[]).map((t) => (
          <button
            key={t}
            onClick={() => toggleTag(t)}
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium border transition-colors ${
              deal.tags.includes(t)
                ? "bg-primary/20 text-primary border-primary/40"
                : "border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            {t === "hot" ? "🔥" : t === "cold" ? "❄️" : "⚠️"}
          </button>
        ))}
      </div>

      {/* Note */}
      {showNote ? (
        <div className="flex items-center gap-1">
          <Input
            className="h-7 w-40 text-[11px]"
            placeholder="Nota..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
            autoFocus
          />
          <button onClick={handleAddNote} className="text-primary"><Check className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <button onClick={() => setShowNote(true)} className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground">
          <StickyNote className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
