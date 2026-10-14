import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  CopyPlus,
  GripVertical,
  CheckSquare,
  ListChecks,
  MessageSquare,
  MoreVertical,
  Pencil,
  PhoneCall,
  Plus,
  Search,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Workflow,
  FileText,
  Zap,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useCRMPipelinesStore } from "@/lib/crmPipelinesStore";
import { useOrganizationStore } from "@/lib/organizationStore";
import { usePipelineStagesStore } from "@/lib/pipelineStagesStore";
import { useRolesStore } from "@/lib/rolesStore";
import { canManageSettings } from "@/lib/permissions";
import { OptionListsSection } from "@/components/settings/OptionListsSection";
import { useTaskAutomationRulesStore, type TaskAutomationRule } from "@/lib/taskAutomationStore";
import { useUsersStore } from "@/lib/usersStore";
import { DEFAULT_STAGE_COLOR, STAGE_COLOR_PALETTE, hexToRgba, normalizeStageColor } from "@/lib/pipelineStageColors";
import { normalizeWorkspaceDealCodePrefix, useWorkspaceStore } from "@/lib/workspaceStore";

interface Props {
  userEmail: string;
}

type EditablePipelineStage = ReturnType<typeof usePipelineStagesStore.getState>["getStages"] extends (...args: any[]) => infer T
  ? T extends Array<infer U>
    ? U
    : never
  : never;

type SettingsSection =
  | "general"
  | "workspace"
  | "pipelines"
  | "pipeline-stages"
  | "automations"
  | "option-lists";

const SETTINGS_SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
  icon: typeof Settings2;
}> = [
  { id: "general", label: "Geral", description: "Visão geral e preferências do sistema.", icon: Settings2 },
  { id: "workspace", label: "Workspace", description: "Dados básicos e configurações do workspace.", icon: Building2 },
  { id: "pipelines", label: "Pipelines", description: "Criação e gerenciamento dos pipelines.", icon: Workflow },
  { id: "pipeline-stages", label: "Etapas do Funil", description: "Etapas, ordem e percentual de fechamento.", icon: ArrowRight },
  { id: "automations", label: "Automações", description: "Regras automáticas por etapa do funil.", icon: Check },
  { id: "option-lists", label: "Segmento e Cargo", description: "Listas oferecidas no cadastro de empresa e contato.", icon: ListChecks },
];

const WORKSPACE_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"];
const getSectionFromPath = (pathname: string): SettingsSection | null => {
  const [, first, second] = pathname.split("/");
  if (first !== "settings") return null;
  const fallback = second || "workspace";
  return SETTINGS_SECTIONS.some((section) => section.id === fallback as SettingsSection)
    ? (fallback as SettingsSection)
    : null;
};

const SectionShell = ({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="space-y-6">
    <div className="flex flex-col gap-3 border-b border-border/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const CardBlock = ({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
    <div className="mb-4 space-y-1">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
    {children}
  </div>
);

const EmptySection = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
    <h3 className="text-base font-semibold text-foreground">{title}</h3>
    <p className="mt-2 text-sm text-muted-foreground">{description}</p>
  </div>
);

const ScopeNotice = ({
  scope,
  workspaceName,
  organizationName,
}: {
  scope: "workspace" | "organization";
  workspaceName?: string | null;
  organizationName?: string | null;
}) => (
  <CardBlock
    title="Escopo da configuração"
    description={
      scope === "workspace"
        ? "As alterações feitas nesta seção afetam somente o workspace atualmente selecionado."
        : "As alterações feitas nesta seção valem para toda a organização ativa."
    }
  >
    <div className="flex flex-wrap gap-3">
      {scope === "workspace" ? (
        <>
          <div className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Workspace ativo:</span>{" "}
            <span className="font-semibold text-foreground">{workspaceName || "Não selecionado"}</span>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Troque o workspace no seletor superior para configurar outra operação sem misturar os dados.
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Organização ativa:</span>{" "}
            <span className="font-semibold text-foreground">{organizationName || "Não selecionada"}</span>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Use esta área para credenciais e integrações compartilhadas por todos os workspaces da organização.
          </div>
        </>
      )}
    </div>
  </CardBlock>
);

const StageColorPicker = ({
  value,
  onChange,
  compact = false,
}: {
  value?: string | null;
  onChange: (color: string) => void;
  compact?: boolean;
}) => {
  const selectedColor = normalizeStageColor(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        {compact ? (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-11 shrink-0 rounded-lg border-input bg-background p-0"
            aria-label="Selecionar cor da etapa"
          >
            <span className="h-4 w-4 rounded-md border border-black/10" style={{ backgroundColor: selectedColor }} />
          </Button>
        ) : (
          <Button variant="outline" className="h-10 w-full justify-between rounded-md border-input bg-background px-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: selectedColor }} />
              Cor da etapa
            </span>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{selectedColor}</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[240px] p-3">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Selecione uma cor</p>
            <p className="text-xs text-muted-foreground">A cor será usada no Kanban e em futuras visualizações.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {STAGE_COLOR_PALETTE.map((colorOption) => (
              <button
                key={colorOption.value}
                type="button"
                onClick={() => onChange(colorOption.value)}
                aria-label={`Selecionar cor ${colorOption.label}`}
                className={cn(
                  "relative flex h-10 items-center justify-center rounded-lg border transition-colors",
                  "hover:border-primary/35 hover:bg-muted/30",
                  selectedColor === colorOption.value
                    ? "border-primary bg-primary/5 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.08)]"
                    : "border-border bg-background",
                )}
              >
                <span
                  className="h-5 w-5 rounded-md border border-black/10"
                  style={{ backgroundColor: colorOption.value }}
                />
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center">
                  {selectedColor === colorOption.value ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const STAGE_CARD_WIDTH = "w-[280px] min-w-[280px] max-w-[280px]";

const slugifyStageId = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const buildUniqueStageId = (label: string, existingStages: EditablePipelineStage[], fallbackSeed?: string) => {
  const existingIds = new Set(existingStages.map((stage) => stage.id));
  const base = slugifyStageId(label) || slugifyStageId(fallbackSeed || "") || `etapa_${existingStages.length + 1}`;
  let candidate = base;
  let counter = 2;

  while (existingIds.has(candidate)) {
    candidate = `${base}_${counter}`;
    counter += 1;
  }

  return candidate;
};

const getStageVisualMeta = (stageId?: string | null, label?: string | null) => {
  const reference = `${stageId || ""} ${label || ""}`.toLowerCase();

  if (reference.includes("lead")) return { icon: Sparkles, label: "Lead" };
  if (reference.includes("contato") || reference.includes("contact")) return { icon: PhoneCall, label: "Contato" };
  if (reference.includes("proposta") || reference.includes("proposal")) return { icon: FileText, label: "Proposta" };
  if (reference.includes("negoci") || reference.includes("negot")) return { icon: MessageSquare, label: "Negociação" };
  if (reference.includes("fech") || reference.includes("closing") || reference.includes("won")) return { icon: CircleDollarSign, label: "Fechamento" };

  return { icon: Workflow, label: "Etapa" };
};

function SortableStageCard({
  stage,
  onLabelChange,
  onProbabilityChange,
  onColorChange,
  onDuplicate,
  onDelete,
  removing,
}: {
  stage: EditablePipelineStage;
  onLabelChange: (value: string) => void;
  onProbabilityChange: (value: number) => void;
  onColorChange: (value: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  removing?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    data: { type: "pipeline-stage", stageId: stage.id },
  });
  const stageColor = normalizeStageColor(stage.color, stage.id, stage.label, stage.position);
  const visualMeta = getStageVisualMeta(stage.id, stage.label);
  const StageIcon = visualMeta.icon;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.82 : 1,
      }}
      className={cn(
        STAGE_CARD_WIDTH,
        "shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-[transform,box-shadow,border-color] duration-200",
        "hover:border-primary/25 hover:shadow-[0_18px_40px_-30px_hsl(var(--primary)/0.45)]",
        isDragging && "z-20 shadow-[0_22px_45px_-30px_hsl(var(--primary)/0.5)]",
        removing && "animate-item-exit pointer-events-none",
      )}
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: stageColor }} />
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-muted/30"
                style={{ color: stageColor, backgroundColor: hexToRgba(stageColor, 0.08) }}
              >
                <StageIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{stage.label || "Nova etapa"}</p>
                <p className="text-xs text-muted-foreground">Preview do Kanban</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-grab rounded-lg text-muted-foreground active:cursor-grabbing"
              aria-label={`Reordenar etapa ${stage.label}`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={onDuplicate}>
                  <CopyPlus className="mr-2 h-4 w-4" />
                  Duplicar etapa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir etapa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Nome da etapa</Label>
          <Input value={stage.label} onChange={(event) => onLabelChange(event.target.value)} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Percentual</Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={100}
                value={String(stage.probability)}
                onChange={(event) => onProbabilityChange(Number(event.target.value))}
                className="pr-8"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </div>

          <div className="flex items-end">
            <StageColorPicker value={stageColor} onChange={onColorChange} compact />
          </div>
        </div>
      </div>
    </div>
  );
}

type AutomationDraftAction = {
  clientId: string;
  taskTitle: string;
  taskDescription: string;
  dueDays: string;
  active: boolean;
};

type AutomationTriggerType = "deal_created" | "stage_changed" | "deal_won" | "deal_lost";

type AutomationRuleGroup = {
  id: string;
  workspaceId: string;
  pipelineId: string;
  stageId: string;
  rules: TaskAutomationRule[];
  createdAt: string;
};

type AutomationEditorMode = "list" | "create" | "edit";

const ANY_STAGE_TRIGGER_VALUE = "__any_stage__";

const AUTOMATION_TRIGGER_OPTIONS: Array<{ value: AutomationTriggerType; label: string }> = [
  { value: "deal_created", label: "Negociação criada" },
  { value: "stage_changed", label: "Etapa alterada" },
  { value: "deal_won", label: "Negociação ganha" },
  { value: "deal_lost", label: "Negociação perdida" },
];

const createAutomationDraftAction = (overrides?: Partial<AutomationDraftAction>): AutomationDraftAction => ({
  clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  taskTitle: "",
  taskDescription: "",
  dueDays: "0",
  active: true,
  ...overrides,
});

const groupAutomationRules = (rules: TaskAutomationRule[]): AutomationRuleGroup[] => {
  const groups = new Map<string, AutomationRuleGroup>();

  rules.forEach((rule) => {
    const key = `${rule.pipelineId}::${rule.stageId}`;
    const existing = groups.get(key);

    if (existing) {
      existing.rules.push(rule);
      if (new Date(rule.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
        existing.createdAt = rule.createdAt;
      }
      return;
    }

    groups.set(key, {
      id: key,
      workspaceId: rule.workspaceId,
      pipelineId: rule.pipelineId,
      stageId: rule.stageId,
      rules: [rule],
      createdAt: rule.createdAt,
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      rules: [...group.rules].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
    }))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
};

const AutomationConnector = () => (
  <div className="flex justify-center py-1">
    <div className="h-8 w-px bg-border" />
  </div>
);

const AutomationStepCard = ({
  icon,
  title,
  description,
  menu,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  menu?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border bg-card shadow-sm">
    <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
        </div>
      </div>
      {menu}
    </div>
    <div className="space-y-4 p-4">{children}</div>
  </div>
);

const AutomationAddStepButton = ({
  onAddAction,
  onAddCondition,
}: {
  onAddAction: () => void;
  onAddCondition?: () => void;
}) => (
  <div className="flex justify-center">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 rounded-full px-4">
          <Plus className="h-4 w-4" />
          Adicionar etapa
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-44">
        <DropdownMenuItem onClick={onAddAction}>
          <CheckSquare className="mr-2 h-4 w-4" />
          Ação
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (onAddCondition) onAddCondition();
          }}
        >
          <Search className="mr-2 h-4 w-4" />
          Condição
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

const getAutomationGroupLastUpdated = (group: AutomationRuleGroup) =>
  group.rules.reduce((latest, rule) => {
    const timestamp = new Date(rule.updatedAt || rule.createdAt).getTime();
    return Number.isFinite(timestamp) && timestamp > latest ? timestamp : latest;
  }, 0);

export default function Settings({ userEmail }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  const { activeWorkspaceId, workspaces, updateWorkspace } = useWorkspaceStore();
  const { users } = useUsersStore();
  const { roles } = useRolesStore();
  const { organizations, activeOrganizationId } = useOrganizationStore();
  const { fetchPipelines, getPipelines, addPipeline, updatePipeline, deletePipeline } = useCRMPipelinesStore();
  const { fetchStages, getStages, addStage, updateStage, removeStage, reorderStages } = usePipelineStagesStore();
  const { fetchRules, getRules, addRule, updateRule, removeRule, isLoading: automationsLoading } = useTaskAutomationRulesStore();

  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [pipelineForm, setPipelineForm] = useState({ name: "", description: "", isActive: true });
  const [newPipelineForm, setNewPipelineForm] = useState({ name: "", description: "", isActive: true });
  const [stageForm, setStageForm] = useState({ id: "", label: "", probability: "0", color: DEFAULT_STAGE_COLOR });
  const [isStageComposerOpen, setIsStageComposerOpen] = useState(false);

  const [workspaceForm, setWorkspaceForm] = useState({ name: "", color: WORKSPACE_COLORS[0], dealCodePrefix: "VYN" });

  const [automationDraft, setAutomationDraft] = useState({
    triggerType: "stage_changed" as AutomationTriggerType,
    pipelineId: "",
    fromStageId: ANY_STAGE_TRIGGER_VALUE,
    stageId: "",
    actions: [createAutomationDraftAction()],
  });
  const [automationEditorMode, setAutomationEditorMode] = useState<AutomationEditorMode>("list");
  const [editingAutomationGroupId, setEditingAutomationGroupId] = useState<string | null>(null);
  const [removingStageIds, setRemovingStageIds] = useState<string[]>([]);
  const [removingAutomationIds, setRemovingAutomationIds] = useState<string[]>([]);

  const activeSection = getSectionFromPath(location.pathname) || "workspace";
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null;
  const activeOrganization = organizations.find((organization) => organization.id === activeOrganizationId) || null;
  const workspacePipelines = getPipelines(activeWorkspaceId).filter((pipeline) => pipeline.isActive || pipeline.id === selectedPipelineId);
  const selectedPipeline = workspacePipelines.find((pipeline) => pipeline.id === selectedPipelineId) || workspacePipelines[0];
  const selectedPipelineStages = getStages(selectedPipeline?.id, selectedPipeline?.name);
  const stageSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const automationRules = getRules(activeWorkspaceId);
  const automationGroups = useMemo(() => groupAutomationRules(automationRules), [automationRules]);
  const currentUser = users.find((user) => user.email === userEmail);
  const currentUserRole = roles.find((role) => role.id === currentUser?.roleId);
  const currentUserMenus = currentUserRole?.permissions?.menus || [];
  const isOrganizationAdmin =
    !!currentUser?.organizationId &&
    currentUser.organizationId === activeOrganizationId &&
    (!!currentUserRole?.isMaster || (currentUserMenus.includes("settings") && currentUserMenus.includes("users")));

  useEffect(() => {
    if (!getSectionFromPath(location.pathname)) {
      navigate("/settings/workspace", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (activeWorkspace) {
      setWorkspaceForm({
        name: activeWorkspace.name,
        color: activeWorkspace.color || WORKSPACE_COLORS[0],
        dealCodePrefix: activeWorkspace.dealCodePrefix || "VYN",
      });
    }
  }, [activeWorkspace]);

  useEffect(() => {
    setIsStageComposerOpen(false);
    setStageForm({ id: "", label: "", probability: "0", color: DEFAULT_STAGE_COLOR });
  }, [selectedPipeline?.id]);

  useEffect(() => {
    setAutomationDraft((current) => ({
      ...current,
      pipelineId: current.pipelineId || selectedPipeline?.id || "",
    }));
  }, [selectedPipeline?.id]);

  useEffect(() => {
    if (activeWorkspaceId) {
      void fetchPipelines(activeWorkspaceId);
      void fetchRules(activeWorkspaceId);
    }
  }, [activeWorkspaceId, fetchPipelines, fetchRules]);

  useEffect(() => {
    if (!selectedPipelineId && workspacePipelines[0]?.id) {
      setSelectedPipelineId(workspacePipelines[0].id);
    }
  }, [selectedPipelineId, workspacePipelines]);

  useEffect(() => {
    if (selectedPipeline?.id && activeWorkspaceId) {
      fetchStages(selectedPipeline.id, activeWorkspaceId, selectedPipeline.name);
      setPipelineForm({
        name: selectedPipeline.name,
        description: selectedPipeline.description || "",
        isActive: selectedPipeline.isActive,
      });
      setAutomationDraft((current) => ({
        ...current,
        pipelineId: current.pipelineId || selectedPipeline.id,
      }));
    }
  }, [activeWorkspaceId, fetchStages, selectedPipeline?.description, selectedPipeline?.id, selectedPipeline?.isActive, selectedPipeline?.name]);

  const handleSaveWorkspace = async () => {
    if (!activeWorkspaceId || !workspaceForm.name.trim()) {
      toast.error("Informe o nome do workspace.");
      return;
    }

    try {
      await updateWorkspace(activeWorkspaceId, {
        name: workspaceForm.name.trim(),
        color: workspaceForm.color,
        dealCodePrefix: workspaceForm.dealCodePrefix,
      });
      toast.success("Workspace atualizado!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar workspace.");
    }
  };

  const handleCreatePipeline = async () => {
    if (!activeWorkspaceId || !newPipelineForm.name.trim()) {
      toast.error("Informe o nome do pipeline.");
      return;
    }

    try {
      const pipeline = await addPipeline({
        workspaceId: activeWorkspaceId,
        name: newPipelineForm.name.trim(),
        description: newPipelineForm.description.trim(),
        isActive: newPipelineForm.isActive,
      });
      setSelectedPipelineId(pipeline.id);
      setNewPipelineForm({ name: "", description: "", isActive: true });
      toast.success("Pipeline criado!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar pipeline.");
    }
  };

  const handleSavePipeline = async () => {
    if (!selectedPipeline?.id) return;
    try {
      await updatePipeline(selectedPipeline.id, pipelineForm);
      toast.success("Pipeline atualizado!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar pipeline.");
    }
  };

  const handleDeletePipeline = async () => {
    if (!selectedPipeline?.id) return;
    try {
      await deletePipeline(selectedPipeline.id);
      setSelectedPipelineId("");
      toast.success("Pipeline removido.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover pipeline.");
    }
  };

  const handleCreateStage = async () => {
    if (!selectedPipeline?.id || !activeWorkspaceId || !stageForm.label.trim()) {
      toast.error("Informe o nome da etapa.");
      return;
    }

    try {
      const label = stageForm.label.trim();
      const nextStageId = buildUniqueStageId(label, selectedPipelineStages, stageForm.id.trim());
      await addStage(selectedPipeline.id, activeWorkspaceId, {
        id: nextStageId,
        label,
        probability: Number(stageForm.probability) || 0,
        position: selectedPipelineStages.length + 1,
        color: stageForm.color,
      });
      setStageForm({ id: "", label: "", probability: "0", color: DEFAULT_STAGE_COLOR });
      setIsStageComposerOpen(false);
      toast.success("Etapa criada!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar etapa.");
    }
  };

  const handleDuplicateStage = async (stageId: string) => {
    if (!selectedPipeline?.id || !activeWorkspaceId) return;
    const sourceStage = selectedPipelineStages.find((stage) => stage.id === stageId);
    if (!sourceStage) return;

    const duplicatedLabel = `${sourceStage.label} Copia`;
    const duplicatedId = buildUniqueStageId(duplicatedLabel, selectedPipelineStages, sourceStage.id);

    try {
      await addStage(selectedPipeline.id, activeWorkspaceId, {
        id: duplicatedId,
        label: duplicatedLabel,
        probability: sourceStage.probability,
        position: selectedPipelineStages.length + 1,
        color: sourceStage.color,
      });
      toast.success("Etapa duplicada.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao duplicar etapa.");
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!selectedPipeline?.id) return;
    setRemovingStageIds((current) => (current.includes(stageId) ? current : [...current, stageId]));
    window.setTimeout(async () => {
      await removeStage(selectedPipeline.id, stageId);
      setRemovingStageIds((current) => current.filter((item) => item !== stageId));
      toast.success("Etapa removida.");
    }, 170);
  };

  const handleStageDragEnd = async (event: DragEndEvent) => {
    if (!selectedPipeline?.id || !activeWorkspaceId) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const orderedStageIds = selectedPipelineStages.map((stage) => stage.id);
    const activeIndex = orderedStageIds.indexOf(String(active.id));
    const overIndex = orderedStageIds.indexOf(String(over.id));

    if (activeIndex < 0 || overIndex < 0) return;

    const [movedStageId] = orderedStageIds.splice(activeIndex, 1);
    orderedStageIds.splice(overIndex, 0, movedStageId);

    try {
      await reorderStages(selectedPipeline.id, activeWorkspaceId, orderedStageIds);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao reordenar etapas.");
    }
  };

  const resetAutomationDraft = () => {
    setAutomationDraft({
      triggerType: "stage_changed",
      pipelineId: selectedPipeline?.id || "",
      fromStageId: ANY_STAGE_TRIGGER_VALUE,
      stageId: "",
      actions: [createAutomationDraftAction()],
    });
    setEditingAutomationGroupId(null);
  };

  const openCreateAutomationEditor = () => {
    resetAutomationDraft();
    setAutomationEditorMode("create");
  };

  const openEditAutomationEditor = (group: AutomationRuleGroup) => {
    setAutomationDraft({
      triggerType: "stage_changed",
      pipelineId: group.pipelineId,
      fromStageId: ANY_STAGE_TRIGGER_VALUE,
      stageId: group.stageId,
      actions: group.rules.map((rule) =>
        createAutomationDraftAction({
          taskTitle: rule.taskTitle,
          taskDescription: rule.taskDescription || "",
          dueDays: String(rule.dueDays),
          active: rule.active,
        }),
      ),
    });
    setEditingAutomationGroupId(group.id);
    setAutomationEditorMode("edit");
  };

  const handleAddDraftAutomationAction = () => {
    setAutomationDraft((current) => ({
      ...current,
      actions: [...current.actions, createAutomationDraftAction()],
    }));
  };

  const handleDuplicateDraftAutomationAction = (index: number) => {
    setAutomationDraft((current) => {
      const action = current.actions[index];
      if (!action) return current;
      const nextActions = [...current.actions];
      nextActions.splice(
        index + 1,
        0,
        createAutomationDraftAction({
          taskTitle: action.taskTitle,
          taskDescription: action.taskDescription,
          dueDays: action.dueDays,
          active: action.active,
        }),
      );
      return { ...current, actions: nextActions };
    });
  };

  const handleMoveDraftAutomationAction = (index: number, direction: -1 | 1) => {
    setAutomationDraft((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.actions.length) return current;
      const nextActions = [...current.actions];
      [nextActions[index], nextActions[targetIndex]] = [nextActions[targetIndex], nextActions[index]];
      return { ...current, actions: nextActions };
    });
  };

  const handleRemoveDraftAutomationAction = (index: number) => {
    setAutomationDraft((current) => ({
      ...current,
      actions:
        current.actions.length === 1
          ? [createAutomationDraftAction()]
          : current.actions.filter((_, actionIndex) => actionIndex !== index),
    }));
  };

  const handleCreateAutomation = async () => {
    if (!activeWorkspaceId || !automationDraft.pipelineId) {
      toast.error("Preencha o pipeline do acionador.");
      return;
    }

    if (automationDraft.triggerType !== "stage_changed") {
      toast.info("Este tipo de acionador já aparece no editor, mas ainda depende da evolução da estrutura atual para ser salvo sem alterar o backend.");
      return;
    }

    if (!automationDraft.stageId) {
      toast.error("Selecione a etapa em 'Para' para salvar com a estrutura atual.");
      return;
    }

    const normalizedActions = automationDraft.actions.map((action) => ({
      ...action,
      taskTitle: action.taskTitle.trim(),
      taskDescription: action.taskDescription.trim(),
    }));

    if (normalizedActions.some((action) => !action.taskTitle)) {
      toast.error("Preencha o título de todas as ações.");
      return;
    }

    try {
      if (automationEditorMode === "edit" && editingAutomationGroupId) {
        const existingGroup = automationGroups.find((group) => group.id === editingAutomationGroupId);
        if (!existingGroup) {
          toast.error("Automação não encontrada para edição.");
          return;
        }

        const sharedUpdates = {
          pipelineId: automationDraft.pipelineId,
          stageId: automationDraft.stageId,
        };

        const draftCount = normalizedActions.length;
        const existingCount = existingGroup.rules.length;
        const overlapCount = Math.min(draftCount, existingCount);

        for (let index = 0; index < overlapCount; index += 1) {
          const action = normalizedActions[index];
          const existingRule = existingGroup.rules[index];
          await updateRule(existingRule.id, {
            ...sharedUpdates,
            taskTitle: action.taskTitle,
            taskDescription: action.taskDescription || undefined,
            dueDays: Number(action.dueDays) || 0,
            active: action.active,
          });
        }

        if (draftCount > existingCount) {
          for (let index = existingCount; index < draftCount; index += 1) {
            const action = normalizedActions[index];
            await addRule({
              workspaceId: activeWorkspaceId,
              pipelineId: automationDraft.pipelineId,
              stageId: automationDraft.stageId,
              taskTitle: action.taskTitle,
              taskDescription: action.taskDescription || undefined,
              dueDays: Number(action.dueDays) || 0,
              active: action.active,
            });
          }
        }

        if (existingCount > draftCount) {
          for (let index = draftCount; index < existingCount; index += 1) {
            await removeRule(existingGroup.rules[index].id);
          }
        }
      } else {
        for (const action of normalizedActions) {
          await addRule({
            workspaceId: activeWorkspaceId,
            pipelineId: automationDraft.pipelineId,
            stageId: automationDraft.stageId,
            taskTitle: action.taskTitle,
            taskDescription: action.taskDescription || undefined,
            dueDays: Number(action.dueDays) || 0,
            active: action.active,
          });
        }
      }
      resetAutomationDraft();
      setAutomationEditorMode("list");
      toast.success(automationEditorMode === "edit" ? "Automação atualizada!" : "Automação criada!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar automação.");
    }
  };

  const handleDeleteAutomation = async (id: string) => {
    setRemovingAutomationIds((current) => (current.includes(id) ? current : [...current, id]));
    window.setTimeout(async () => {
      await removeRule(id);
      setRemovingAutomationIds((current) => current.filter((item) => item !== id));
      toast.success("Ação removida.");
    }, 170);
  };

  const handleDeleteAutomationGroup = async (group: AutomationRuleGroup) => {
    const ids = group.rules.map((rule) => rule.id);
    setRemovingAutomationIds((current) => [...new Set([...current, ...ids])]);
    window.setTimeout(async () => {
      try {
        for (const id of ids) {
          await removeRule(id);
        }
        toast.success("Automação removida.");
      } catch (error) {
        console.error(error);
        toast.error("Erro ao remover automação.");
      } finally {
        setRemovingAutomationIds((current) => current.filter((item) => !ids.includes(item)));
      }
    }, 170);
  };

  const handleAddConditionPlaceholder = () => {
    toast.info("Não há condições persistidas disponíveis neste MVP sem alterar a estrutura atual.");
  };

  const handleCreateAutomationActionForGroup = async (group: AutomationRuleGroup) => {
    try {
      await addRule({
        workspaceId: group.workspaceId,
        pipelineId: group.pipelineId,
        stageId: group.stageId,
        taskTitle: "Nova tarefa automática",
        taskDescription: undefined,
        dueDays: 0,
        active: true,
      });
      toast.success("Ação adicionada.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao adicionar ação.");
    }
  };

  const handleDuplicateAutomationAction = async (rule: TaskAutomationRule) => {
    try {
      await addRule({
        workspaceId: rule.workspaceId,
        pipelineId: rule.pipelineId,
        stageId: rule.stageId,
        taskTitle: rule.taskTitle,
        taskDescription: rule.taskDescription,
        dueDays: rule.dueDays,
        active: rule.active,
      });
      toast.success("Ação duplicada.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao duplicar ação.");
    }
  };

  const handleMoveAutomationAction = async (group: AutomationRuleGroup, index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= group.rules.length) return;

    const currentRule = group.rules[index];
    const targetRule = group.rules[targetIndex];
    if (!currentRule || !targetRule) return;

    try {
      await updateRule(currentRule.id, {
        taskTitle: targetRule.taskTitle,
        taskDescription: targetRule.taskDescription,
        dueDays: targetRule.dueDays,
        active: targetRule.active,
      });
      await updateRule(targetRule.id, {
        taskTitle: currentRule.taskTitle,
        taskDescription: currentRule.taskDescription,
        dueDays: currentRule.dueDays,
        active: currentRule.active,
      });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao mover ação.");
    }
  };

  const handleDuplicateAutomationGroup = async (group: AutomationRuleGroup) => {
    try {
      for (const rule of group.rules) {
        await addRule({
          workspaceId: rule.workspaceId,
          pipelineId: rule.pipelineId,
          stageId: rule.stageId,
          taskTitle: rule.taskTitle,
          taskDescription: rule.taskDescription,
          dueDays: rule.dueDays,
          active: rule.active,
        });
      }
      toast.success("Automação duplicada.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao duplicar automação.");
    }
  };

  const handleToggleAutomationGroup = async (group: AutomationRuleGroup, enabled: boolean) => {
    try {
      for (const rule of group.rules) {
        await updateRule(rule.id, { active: enabled });
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar status da automação.");
    }
  };

  const selectedAutomationStages = getStages(
    automationDraft.pipelineId,
    workspacePipelines.find((pipeline) => pipeline.id === automationDraft.pipelineId)?.name,
  );

  const sectionContent = useMemo(() => {
    switch (activeSection) {
      case "general":
        return (
          <SectionShell
            title="Configurações"
            description="Uma central única para navegar pelas configurações do workspace ativo sem misturar módulos na mesma tela."
          >
            <ScopeNotice scope="workspace" workspaceName={activeWorkspace?.name} />

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <CardBlock title="Visão geral do ambiente" description="Resumo rápido da organização e do workspace ativos.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Organização</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{activeOrganization?.name || "Não selecionada"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Status: {activeOrganization?.subscriptionStatus || "Sem informação"}</p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Workspace</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{activeWorkspace?.name || "Não selecionado"}</p>
                  </div>
                </div>
              </CardBlock>

              <CardBlock title="Mapa das configurações" description="Cada item do menu abre uma página interna independente, pronta para crescer sem bagunça.">
                <div className="space-y-3">
                  {SETTINGS_SECTIONS.filter((section) => section.id !== "general").map((section) => (
                    <button
                      key={section.id}
                      onClick={() => navigate(`/settings/${section.id}`)}
                      className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{section.label}</p>
                        <p className="text-xs text-muted-foreground">{section.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </CardBlock>
            </div>

          </SectionShell>
        );

      case "workspace":
        return (
          <SectionShell
            title="Workspace"
            description="Configure os dados básicos do workspace ativo sem misturar pipelines, canais ou produtos."
            action={
              <Button onClick={() => void handleSaveWorkspace()} className="gap-2">
                <Save className="h-4 w-4" />
                Salvar workspace
              </Button>
            }
          >
            <ScopeNotice scope="workspace" workspaceName={activeWorkspace?.name} />

            <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
              <CardBlock title="Dados básicos" description="Nome e identidade visual do workspace atual.">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Nome do workspace</Label>
                    <Input value={workspaceForm.name} onChange={(event) => setWorkspaceForm({ ...workspaceForm, name: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prefixo das negociações</Label>
                    <Input
                      value={workspaceForm.dealCodePrefix}
                      maxLength={8}
                      onChange={(event) =>
                        setWorkspaceForm({
                          ...workspaceForm,
                          dealCodePrefix: normalizeWorkspaceDealCodePrefix(event.target.value),
                        })
                      }
                      placeholder="VYN"
                    />
                    <p className="text-xs text-muted-foreground">
                      Proximo ID: {(normalizeWorkspaceDealCodePrefix(workspaceForm.dealCodePrefix) || "VYN")}-{activeWorkspace?.dealCodeNextNumber || 1}
                    </p>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Cor principal</Label>
                    <div className="flex flex-wrap gap-2">
                      {WORKSPACE_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setWorkspaceForm({ ...workspaceForm, color })}
                          className={cn(
                            "h-9 w-9 rounded-full border border-border transition-transform hover:scale-105",
                            workspaceForm.color === color && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardBlock>

              <CardBlock title="Resumo operacional" description="Contexto rápido sobre o workspace ativo.">
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 px-4 py-3">
                    <span>Workspaces na organização</span>
                    <span className="font-semibold text-foreground">{workspaces.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 px-4 py-3">
                    <span>Pipelines ativos</span>
                    <span className="font-semibold text-foreground">{workspacePipelines.length}</span>
                  </div>
                </div>
              </CardBlock>
            </div>
          </SectionShell>
        );

      case "pipelines":
        return (
          <SectionShell
            title="Pipelines"
            description="Cadastre, edite e remova pipelines. As etapas foram separadas em uma tela propria."
          >
            <div className="space-y-4">
              <ScopeNotice scope="workspace" workspaceName={activeWorkspace?.name} />

              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <CardBlock title="Novo pipeline" description="Crie um novo pipeline sem misturar configurações de etapa.">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input value={newPipelineForm.name} onChange={(event) => setNewPipelineForm({ ...newPipelineForm, name: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descrição</Label>
                    <Input value={newPipelineForm.description} onChange={(event) => setNewPipelineForm({ ...newPipelineForm, description: event.target.value })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={newPipelineForm.isActive}
                      onCheckedChange={(checked) => setNewPipelineForm({ ...newPipelineForm, isActive: !!checked })}
                    />
                    Pipeline ativo
                  </label>
                  <Button onClick={() => void handleCreatePipeline()} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Criar pipeline
                  </Button>
                </div>
              </CardBlock>

              <CardBlock title="Gerenciar pipeline" description="Edite apenas os dados estruturais do pipeline selecionado.">
                {workspacePipelines.length === 0 ? (
                  <EmptySection title="Nenhum pipeline encontrado" description="Crie o primeiro pipeline para habilitar essa área." />
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Pipeline selecionado</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={selectedPipeline?.id || ""}
                        onChange={(event) => setSelectedPipelineId(event.target.value)}
                      >
                        {workspacePipelines.map((pipeline) => (
                          <option key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Nome</Label>
                        <Input value={pipelineForm.name} onChange={(event) => setPipelineForm({ ...pipelineForm, name: event.target.value })} />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Descrição</Label>
                        <Input value={pipelineForm.description} onChange={(event) => setPipelineForm({ ...pipelineForm, description: event.target.value })} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={pipelineForm.isActive}
                        onCheckedChange={(checked) => setPipelineForm({ ...pipelineForm, isActive: !!checked })}
                      />
                      Pipeline ativo
                    </label>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" onClick={() => void handleSavePipeline()} className="gap-2">
                        <Save className="h-4 w-4" />
                        Salvar pipeline
                      </Button>
                      <Button variant="ghost" onClick={() => void handleDeletePipeline()} className="gap-2 text-destructive">
                        <Trash2 className="h-4 w-4" />
                        Remover pipeline
                      </Button>
                    </div>
                  </div>
                )}
              </CardBlock>
              </div>
            </div>
          </SectionShell>
        );

      case "pipeline-stages":
        return (
          <SectionShell
            title="Etapas do Funil"
            description="Edite visualmente o fluxo do pipeline em colunas, com preview em tempo real da ordem, do nome e da cor de cada etapa."
          >
            {workspacePipelines.length === 0 ? (
              <EmptySection title="Crie um pipeline primeiro" description="As etapas dependem de um pipeline selecionado para serem configuradas." />
            ) : (
              <div className="space-y-4">
                <ScopeNotice scope="workspace" workspaceName={activeWorkspace?.name} />

                <CardBlock title="Pipeline alvo" description="Escolha o pipeline que tera as etapas gerenciadas.">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm md:max-w-md"
                    value={selectedPipeline?.id || ""}
                    onChange={(event) => setSelectedPipelineId(event.target.value)}
                  >
                    {workspacePipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </option>
                    ))}
                  </select>
                </CardBlock>

                <CardBlock
                  title="Editor visual de etapas"
                  description="Arraste para reordenar, edite direto nos cards e acompanhe a aparencia do pipeline em tempo real."
                >
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="rounded-full border border-border/80 bg-muted/30 px-3 py-1">
                      {selectedPipelineStages.length} etapa{selectedPipelineStages.length === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full border border-border/80 bg-muted/30 px-3 py-1">
                      Fluxo horizontal com rolagem
                    </span>
                    <span className="rounded-full border border-border/80 bg-muted/30 px-3 py-1">
                      Drag and drop ativo
                    </span>
                  </div>

                  {selectedPipelineStages.length === 0 && !isStageComposerOpen ? (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 p-6">
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Nenhuma etapa cadastrada neste pipeline.</p>
                          <p className="text-sm text-muted-foreground">Crie a primeira etapa para começar a montar o fluxo visual.</p>
                        </div>
                        <Button onClick={() => setIsStageComposerOpen(true)} className="gap-2">
                          <Plus className="h-4 w-4" />
                          Nova Etapa
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {(selectedPipelineStages.length > 0 || isStageComposerOpen) && (
                    <div className="overflow-x-auto pb-2">
                      <div className="flex min-w-max items-stretch gap-4">
                        <DndContext sensors={stageSensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleStageDragEnd(event)}>
                          <SortableContext items={selectedPipelineStages.map((stage) => stage.id)} strategy={horizontalListSortingStrategy}>
                            {selectedPipelineStages.map((stage, index) => (
                              <div key={stage.id} className="flex items-center gap-4">
                                {index > 0 ? <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" /> : null}
                                <SortableStageCard
                                  stage={stage}
                                  removing={removingStageIds.includes(stage.id)}
                                  onLabelChange={(value) =>
                                    selectedPipeline?.id &&
                                    activeWorkspaceId &&
                                    void updateStage(selectedPipeline.id, activeWorkspaceId, stage.id, { label: value })
                                  }
                                  onProbabilityChange={(value) =>
                                    selectedPipeline?.id &&
                                    activeWorkspaceId &&
                                    void updateStage(selectedPipeline.id, activeWorkspaceId, stage.id, { probability: value })
                                  }
                                  onColorChange={(color) =>
                                    selectedPipeline?.id &&
                                    activeWorkspaceId &&
                                    void updateStage(selectedPipeline.id, activeWorkspaceId, stage.id, { color })
                                  }
                                  onDuplicate={() => void handleDuplicateStage(stage.id)}
                                  onDelete={() => void handleDeleteStage(stage.id)}
                                />
                              </div>
                            ))}
                          </SortableContext>
                        </DndContext>

                        <div className="flex items-center gap-4">
                          {selectedPipelineStages.length > 0 ? <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" /> : null}
                          {isStageComposerOpen ? (
                            <div className={cn(STAGE_CARD_WIDTH, "shrink-0 overflow-hidden rounded-xl border border-dashed border-primary/30 bg-card shadow-sm")}>
                              <div className="h-1.5 w-full bg-primary/70" />
                              <div className="space-y-4 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{stageForm.label.trim() || "Nova etapa"}</p>
                                    <p className="text-xs text-muted-foreground">A etapa será criada no final do fluxo.</p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-muted-foreground"
                                    onClick={() => {
                                      setIsStageComposerOpen(false);
                                      setStageForm({ id: "", label: "", probability: "0", color: DEFAULT_STAGE_COLOR });
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>

                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium text-muted-foreground">Nome da etapa</Label>
                                  <Input
                                    placeholder="Ex: Qualificação"
                                    value={stageForm.label}
                                    onChange={(event) => setStageForm({ ...stageForm, label: event.target.value })}
                                  />
                                </div>

                                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground">Percentual</Label>
                                    <div className="relative">
                                      <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={stageForm.probability}
                                        onChange={(event) => setStageForm({ ...stageForm, probability: event.target.value })}
                                        className="pr-8"
                                      />
                                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                                    </div>
                                  </div>

                                  <div className="flex items-end">
                                    <StageColorPicker value={stageForm.color} onChange={(color) => setStageForm({ ...stageForm, color })} compact />
                                  </div>
                                </div>

                                <Button onClick={() => void handleCreateStage()} className="w-full gap-2">
                                  <Plus className="h-4 w-4" />
                                  Criar etapa
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsStageComposerOpen(true)}
                              className={cn(
                                STAGE_CARD_WIDTH,
                                "shrink-0 rounded-xl border border-dashed border-border/80 bg-muted/10 px-5 py-6 text-left transition-colors hover:border-primary/35 hover:bg-primary/5",
                              )}
                            >
                              <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3">
                                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/8 text-primary">
                                  <Plus className="h-5 w-5" />
                                </span>
                                <div className="space-y-1 text-center">
                                  <p className="text-sm font-semibold text-foreground">Nova Etapa</p>
                                  <p className="text-xs text-muted-foreground">Adicione uma nova coluna ao final do pipeline.</p>
                                </div>
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardBlock>
              </div>
            )}
          </SectionShell>
        );

      case "automations":
        return (
          <SectionShell
            title="Automações"
            description={
              automationEditorMode === "list"
                ? `Gerencie automações do workspace ativo${activeWorkspace?.name ? `: ${activeWorkspace.name}` : ""} em uma lista organizada, sem alterar a execução atual.`
                : `Monte o fluxo visual da automação mantendo a mesma estrutura e execução já existentes.`
            }
            action={
              automationEditorMode === "list" ? (
                <Button onClick={openCreateAutomationEditor} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar nova automação
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setAutomationEditorMode("list")}>
                  Voltar para lista
                </Button>
              )
            }
          >
            {workspacePipelines.length === 0 ? (
              <EmptySection title="Crie um pipeline primeiro" description="As automações são configuradas por pipeline e etapa." />
            ) : automationEditorMode === "list" ? (
              <div className="space-y-4">
                <ScopeNotice scope="workspace" workspaceName={activeWorkspace?.name} />

                <CardBlock title="Fluxos" description="Lista de automações já cadastradas no workspace atual.">
                  {automationsLoading ? (
                    <div className="space-y-3 py-2">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="grid grid-cols-[minmax(220px,1.8fr)_180px_180px_140px_72px] gap-4 rounded-xl border border-border p-4">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-10" />
                        </div>
                      ))}
                    </div>
                  ) : automationGroups.length === 0 ? (
                    <EmptySection title="Nenhuma automação cadastrada" description="Clique em 'Criar nova automação' para montar o primeiro fluxo." />
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[920px]">
                          <thead className="border-b border-border/70 bg-muted/20">
                            <tr className="text-left">
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nome da automação</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Proprietário</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Última atualização</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Habilitado</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {automationGroups.map((group) => {
                              const groupPipeline = workspacePipelines.find((pipeline) => pipeline.id === group.pipelineId);
                              const stageName = getStages(group.pipelineId, groupPipeline?.name).find((stage) => stage.id === group.stageId)?.label || group.stageId;
                              const lastUpdated = getAutomationGroupLastUpdated(group);
                              const allEnabled = group.rules.every((rule) => rule.active);
                              const actionSummary = group.rules[0]?.taskTitle || "Ação automática";

                              return (
                                <tr key={group.id} className="border-b border-border/60 align-middle last:border-b-0">
                                  <td className="px-4 py-4">
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-foreground">Ao entrar em {stageName}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {groupPipeline?.name || "Pipeline"} - {group.rules.length} {group.rules.length === 1 ? "ação" : "ações"} - {actionSummary}
                                      </p>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-sm text-foreground">{currentUser?.name || "Não informado"}</td>
                                  <td className="px-4 py-4 text-sm text-muted-foreground">
                                    {lastUpdated ? new Date(lastUpdated).toLocaleString("pt-BR") : "Não informado"}
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                      <Switch checked={allEnabled} onCheckedChange={(checked) => void handleToggleAutomationGroup(group, checked)} />
                                      <span className="text-sm text-muted-foreground">{allEnabled ? "Habilitada" : "Desabilitada"}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => openEditAutomationEditor(group)}>
                                          <Pencil className="mr-2 h-4 w-4" />
                                          Editar automação
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => void handleDuplicateAutomationGroup(group)}>
                                          <CopyPlus className="mr-2 h-4 w-4" />
                                          Duplicar automação
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => void handleDeleteAutomationGroup(group)} className="text-destructive focus:text-destructive">
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Excluir automação
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardBlock>
              </div>
            ) : (
              <div className="space-y-4">
                <ScopeNotice scope="workspace" workspaceName={activeWorkspace?.name} />

                <CardBlock
                  title={automationEditorMode === "edit" ? "Editar automação" : "Nova automação"}
                  description="O fluxo visual continua criando as mesmas regras atuais: acionador por etapa e ações de tarefa."
                >
                  <div className="mx-auto max-w-3xl">
                    <AutomationStepCard
                      icon={<Zap className="h-4 w-4" />}
                      title="Acionador"
                      description="Obrigatorio e sempre exibido como a primeira etapa do fluxo."
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Tipo do acionador</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={automationDraft.triggerType}
                            onChange={(event) =>
                              setAutomationDraft((current) => ({
                                ...current,
                                triggerType: event.target.value as AutomationTriggerType,
                                fromStageId: ANY_STAGE_TRIGGER_VALUE,
                                stageId: "",
                              }))
                            }
                          >
                            {AUTOMATION_TRIGGER_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Pipeline</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={automationDraft.pipelineId}
                            onChange={(event) =>
                              setAutomationDraft((current) => ({
                                ...current,
                                pipelineId: event.target.value,
                                fromStageId: ANY_STAGE_TRIGGER_VALUE,
                                stageId: "",
                              }))
                            }
                          >
                            <option value="" disabled>Selecione...</option>
                            {workspacePipelines.map((pipeline) => (
                              <option key={pipeline.id} value={pipeline.id}>
                                {pipeline.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {automationDraft.triggerType === "stage_changed" ? (
                          <>
                            <div className="space-y-1.5">
                              <Label>De</Label>
                              <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={automationDraft.fromStageId}
                                onChange={(event) =>
                                  setAutomationDraft((current) => ({
                                    ...current,
                                    fromStageId: event.target.value,
                                  }))
                                }
                              >
                                <option value={ANY_STAGE_TRIGGER_VALUE}>Qualquer etapa</option>
                                {selectedAutomationStages.map((stage) => (
                                  <option key={stage.id} value={stage.id}>
                                    {stage.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Para</Label>
                              <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={automationDraft.stageId || ANY_STAGE_TRIGGER_VALUE}
                                onChange={(event) =>
                                  setAutomationDraft((current) => ({
                                    ...current,
                                    stageId: event.target.value === ANY_STAGE_TRIGGER_VALUE ? "" : event.target.value,
                                  }))
                                }
                              >
                                <option value={ANY_STAGE_TRIGGER_VALUE}>Qualquer etapa</option>
                                {selectedAutomationStages.map((stage) => (
                                  <option key={stage.id} value={stage.id}>
                                    {stage.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </>
                        ) : null}
                      </div>
                      {automationDraft.triggerType !== "stage_changed" ? (
                        <p className="text-xs text-muted-foreground">
                          Este acionador já está disponível visualmente no editor. A execução continua compatível apenas com o modelo atual de mudança de etapa.
                        </p>
                      ) : null}
                    </AutomationStepCard>

                    {automationDraft.actions.map((action, index) => (
                      <div key={action.clientId}>
                        <AutomationConnector />
                        <AutomationAddStepButton onAddAction={handleAddDraftAutomationAction} onAddCondition={handleAddConditionPlaceholder} />
                        <AutomationConnector />
                        <AutomationStepCard
                          icon={<CheckSquare className="h-4 w-4" />}
                          title="Ação"
                          description="As ações continuam usando o mesmo cadastro de tarefa automática."
                          menu={(
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => handleMoveDraftAutomationAction(index, -1)} disabled={index === 0}>
                                  <ChevronUp className="mr-2 h-4 w-4" />
                                  Mover para cima
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleMoveDraftAutomationAction(index, 1)} disabled={index === automationDraft.actions.length - 1}>
                                  <ChevronDown className="mr-2 h-4 w-4" />
                                  Mover para baixo
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicateDraftAutomationAction(index)}>
                                  <CopyPlus className="mr-2 h-4 w-4" />
                                  Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRemoveDraftAutomationAction(index)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        >
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1.5 md:col-span-2">
                              <Label>Título da tarefa</Label>
                              <Input
                                value={action.taskTitle}
                                onChange={(event) =>
                                  setAutomationDraft((current) => ({
                                    ...current,
                                    actions: current.actions.map((entry, actionIndex) =>
                                      actionIndex === index ? { ...entry, taskTitle: event.target.value } : entry,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                              <Label>Descrição</Label>
                              <Input
                                value={action.taskDescription}
                                onChange={(event) =>
                                  setAutomationDraft((current) => ({
                                    ...current,
                                    actions: current.actions.map((entry, actionIndex) =>
                                      actionIndex === index ? { ...entry, taskDescription: event.target.value } : entry,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Prazo em dias</Label>
                              <Input
                                type="number"
                                min={0}
                                value={action.dueDays}
                                onChange={(event) =>
                                  setAutomationDraft((current) => ({
                                    ...current,
                                    actions: current.actions.map((entry, actionIndex) =>
                                      actionIndex === index ? { ...entry, dueDays: event.target.value } : entry,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <label className="flex items-center gap-2 self-end rounded-md border border-input px-3 py-2 text-sm text-muted-foreground">
                              <Checkbox
                                checked={action.active}
                                onCheckedChange={(checked) =>
                                  setAutomationDraft((current) => ({
                                    ...current,
                                    actions: current.actions.map((entry, actionIndex) =>
                                      actionIndex === index ? { ...entry, active: !!checked } : entry,
                                    ),
                                  }))
                                }
                              />
                              Ação ativa
                            </label>
                          </div>
                        </AutomationStepCard>
                      </div>
                    ))}

                    <div className="mt-6 flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setAutomationEditorMode("list")}>Cancelar</Button>
                      <Button onClick={() => void handleCreateAutomation()} className="gap-2">
                        <Save className="h-4 w-4" />
                        {automationEditorMode === "edit" ? "Salvar automação" : "Criar automação"}
                      </Button>
                    </div>
                  </div>
                </CardBlock>
              </div>
            )}
          </SectionShell>
        );
      case "option-lists":
        return (
          <SectionShell
            title="Segmento e Cargo"
            description="As opções oferecidas nos campos Segmento (empresa) e Cargo (contato). Valem para toda a conta."
          >
            <OptionListsSection podeEditar={canManageSettings(currentUserRole)} />
          </SectionShell>
        );
      default:
        return null;
    }
  }, [
    activeWorkspaceId,
    activeOrganization?.name,
    activeOrganization?.subscriptionStatus,
    activeSection,
    activeWorkspace?.name,
    automationDraft,
    automationGroups,
    automationsLoading,
    isOrganizationAdmin,
    navigate,
    newPipelineForm,
    pipelineForm,
    selectedAutomationStages,
    selectedPipeline?.id,
    selectedPipelineStages,
    stageForm,
    workspaceForm,
    workspacePipelines,
    workspaces.length,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-chat-header px-4 sm:px-6">
        <h1 className="text-lg font-semibold text-chat-header-foreground">Configurações</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto border-b border-border bg-card/70 lg:border-b-0 lg:border-r">
            <div className="space-y-4 p-4 sm:p-5">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Navegação</p>
                <h2 className="text-lg font-semibold text-foreground">Central de Configurações</h2>
              </div>

              <div className="lg:hidden">
                <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">Seção</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={activeSection}
                  onChange={(event) => navigate(`/settings/${event.target.value}`)}
                >
                  {SETTINGS_SECTIONS.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.label}
                    </option>
                  ))}
                </select>
              </div>

              <nav className="hidden space-y-1 lg:block">
                {SETTINGS_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const active = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => navigate(`/settings/${section.id}`)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors",
                        active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted/60",
                      )}
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground")} />
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", active ? "text-primary-foreground" : "text-foreground")}>{section.label}</p>
                        <p className={cn("mt-0.5 text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{section.description}</p>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl p-4 pb-24 sm:p-6 sm:pb-28">{sectionContent}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
