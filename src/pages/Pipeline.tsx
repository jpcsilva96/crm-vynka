import { useState, useMemo, useCallback, useEffect } from "react";
import { DndContext, DragOverlay, closestCorners, defaultDropAnimationSideEffects, type DragEndEvent, type DragStartEvent, type DropAnimation, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useDealsStore, type Deal, type DealStage, QUALIFICATION_REQUIRED_STAGES } from "@/lib/dealsStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { useUsersStore } from "@/lib/usersStore";
import { useRolesStore } from "@/lib/rolesStore";
import { canDeleteRecords, canViewDeal } from "@/lib/permissions";
import { dealDetailPath, dealListPath, dealOriginFromPath } from "@/lib/dealDetailRoute";
import { usePipelineStagesStore } from "@/lib/pipelineStagesStore";
import { useCRMPipelinesStore } from "@/lib/crmPipelinesStore";
import { useCRMContactsStore } from "@/lib/crmContactsStore";
import { useCRMCompaniesStore } from "@/lib/crmCompaniesStore";
import { useCRMContactCompaniesStore } from "@/lib/crmContactCompaniesStore";
import { setWorkspaceHeader } from "@/integrations/supabase/client";
import { CreateDealDialog } from "@/components/pipeline/CreateDealDialog";
import { CreateActivityDialog } from "@/components/pipeline/CreateActivityDialog";
import { DealView } from "@/components/pipeline/DealView";
import { PipelineColumn } from "@/components/pipeline/PipelineColumn";
import { TaskAttentionBadge } from "@/components/pipeline/TaskAttentionBadge";
import { DealListNameLine } from "@/components/pipeline/DealListNameLine";
import { DealTasksQuickDialog } from "@/components/pipeline/DealTasksQuickDialog";
import { getDealTaskAttention } from "@/lib/dealTaskAttention";
import { CardCopyButton, DealCard, DEFAULT_CARD_FIELDS, CARD_FIELD_LABELS, type CardVisibleFields } from "@/components/pipeline/DealCard";
import { GlobalTasksList } from "@/components/pipeline/GlobalTasksList";
import { GlobalContactsList } from "@/components/pipeline/GlobalContactsList";
import { GlobalCompaniesList } from "@/components/pipeline/GlobalCompaniesList";
import { CompanyView } from "@/components/pipeline/CompanyView";
import { ContactView } from "@/components/pipeline/ContactView";
import { usePipelineNavigationStore } from "@/lib/pipelineNavigationStore";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MoreVertical, Inbox, List, Kanban, SlidersHorizontal, ChevronDown, ChevronRight, Trophy, XCircle, Check, Sparkles, Plus, User, Building2, Expand, LayoutPanelLeft, Search, Filter, BookmarkPlus, Bookmark, X, ArrowUpDown, ArrowUp, ArrowDown, FileText, Download, Eye, EyeOff } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/pipeline/UserAvatar";
import { cn, maskPhone, parseLocalDateValue } from "@/lib/utils";
import { formatClosingDate } from "@/lib/closingDateDraft";
import { getQualificationBadgeTone } from "@/lib/qualificationBadge";
import { exportRowsToExcel } from "@/lib/exportExcel";
import { classifyLead } from "@/lib/leadQualification";
import { matchesSearchTerm, normalizeSearchText } from "@/lib/searchMatch";
import { buildDealSearchIndex } from "@/lib/dealSearch";
import { hexToRgba, normalizeStageColor } from "@/lib/pipelineStageColors";
import { toast } from "sonner";

interface Props {
  userEmail: string;
  activeTab: CRMTab;
}

export type CRMTab = "Negociações" | "Tarefas" | "Contatos" | "Empresas";
type ListGrouping = "none" | "stage" | "owner";
type PipelineFilters = {
  search: string;
  ownerId: string;
  qualification: string;
  stageId: string;
  closingDateFrom: string;
  closingDateTo: string;
  minValue: string;
  maxValue: string;
};
type SavedPipelineView = {
  id: string;
  name: string;
  workspaceId: string;
  pipelineId: string;
  filters: PipelineFilters;
};
type DealSortKey = "dealCode" | "dealName" | "value" | "assignedTo" | "closingDate" | "createdAt" | "updatedAt";
type DealSortDirection = "asc" | "desc";
type DealSortState = {
  key: DealSortKey;
  direction: DealSortDirection;
};

export const DEFAULT_LIST_COLUMNS = {
  dealCode: true,
  dealName: true,
  value: true,
  stage: true,
  qualification: true,
  assignedTo: true,
  closingDate: true,
  createdAt: true,
  updatedAt: false,
};

export const LIST_COLUMN_LABELS: Record<string, string> = {
  dealCode: "ID",
  dealName: "Nome do Negócio",
  value: "Valor",
  stage: "Status",
  qualification: "Qualificação",
  assignedTo: "Responsável",
  closingDate: "Previsão",
  createdAt: "Criado em",
  updatedAt: "Atualizado em",
};

const DEFAULT_PIPELINE_FILTERS: PipelineFilters = {
  search: "",
  ownerId: "all",
  qualification: "all",
  stageId: "all",
  closingDateFrom: "",
  closingDateTo: "",
  minValue: "",
  maxValue: "",
};
const DEFAULT_DEAL_SORT: DealSortState = {
  key: "updatedAt",
  direction: "desc",
};
const SAVED_PIPELINE_VIEWS_KEY = "crm.pipeline.savedViews";
const QUALIFICATION_FILTER_OPTIONS = [
  "Lead Prioritário",
  "Lead Qualificado",
  "Lead Nutrição",
  "Lead Descartado",
];
const INITIAL_LIST_GROUP_RENDER_COUNT = 60;
const LIST_GROUP_RENDER_STEP = 40;
const INITIAL_KANBAN_RENDER_COUNT = 24;
const KANBAN_RENDER_STEP = 16;
const readSessionJSON = <T,>(key: string, fallback: T): T => {
  try {
    const value = sessionStorage.getItem(key);
    return value ? { ...fallback, ...JSON.parse(value) } : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Preferência de VISUALIZAÇÃO do pipeline (modo, agrupamento, campos do card, colunas).
 *
 * Vive em localStorage com o e-mail no nome da chave: sobrevive a fechar o navegador e não vaza
 * entre dois usuários que compartilham a mesma máquina. Antes disso tudo ficava em sessionStorage
 * e morria ao fechar a aba, o que a equipe lia como "a configuração não salva".
 *
 * Filtro e ordenação continuam na sessão de propósito: filtro esquecido de ontem esconde
 * negociação sem o vendedor perceber por quê.
 */
const userPrefKey = (userEmail: string | undefined, key: string) =>
  `crm.pipeline.pref.${(userEmail || "anonimo").trim().toLowerCase()}.${key}`;

const readUserPrefJSON = <T,>(userEmail: string | undefined, key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(userPrefKey(userEmail, key));
    return value ? { ...fallback, ...JSON.parse(value) } : fallback;
  } catch {
    return fallback;
  }
};

const readUserPref = (userEmail: string | undefined, key: string) => {
  try {
    return localStorage.getItem(userPrefKey(userEmail, key));
  } catch {
    return null;
  }
};

const writeUserPref = (userEmail: string | undefined, key: string, value: string) => {
  try {
    localStorage.setItem(userPrefKey(userEmail, key), value);
  } catch {
    // navegador sem localStorage disponível: a tela funciona, só não lembra a preferência
  }
};

const CLOSED_STAGE_KEYS = new Set(["won", "lost", "ganho", "ganha", "perdido", "perdida"]);

const isClosedStage = (stageId?: string | null, stageLabel?: string | null) =>
  CLOSED_STAGE_KEYS.has(normalizeSearchText(stageId)) || CLOSED_STAGE_KEYS.has(normalizeSearchText(stageLabel));

const isClosedDeal = (deal: Deal, stageLabel?: string | null) =>
  deal.outcome === "won" || deal.outcome === "lost" || isClosedStage(deal.stage, stageLabel);

const readLocalJSON = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const getLatestTimestamp = (...values: Array<string | undefined>) =>
  values.reduce((latest, value) => {
    if (!value) return latest;
    const next = new Date(value).getTime();
    return Number.isFinite(next) && next > latest ? next : latest;
  }, 0);

function QualificationBadge({ qualification, score }: { qualification?: string; score?: number }) {
  if (!qualification) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  // Cor: a mesma do card do Kanban (src/lib/qualificationBadge.ts). Aqui só o ícone.
  const config: Record<string, { icon: JSX.Element | null, label: string }> = {
    "Lead Prioritário": { icon: <Sparkles className="w-3.5 h-3.5" />, label: "Lead Prioritário" },
    "Lead Qualificado": { icon: <ChevronDown className="w-4 h-4 rotate-180" />, label: "Lead Qualificado" },
    "Lead Nutrição": { icon: <span className="font-bold text-lg leading-none">=</span>, label: "Lead Nutrição" },
    "Lead Descartado": { icon: <ChevronDown className="w-4 h-4" />, label: "Lead Descartado" },
  };

  const item = config[qualification] || { icon: null, label: qualification };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-bold border whitespace-nowrap uppercase",
        getQualificationBadgeTone(qualification),
      )}
    >
      <span className="flex items-center justify-center w-4 h-4 shrink-0">
        {item.icon}
      </span>
      {item.label}
      {typeof score === "number" && <span className="opacity-80 normal-case">{score}/20</span>}
    </div>
  );
}

function StatusBadge({
  stage,
  stages,
  onSelect,
}: {
  stage: DealStage;
  stages: Array<{ id: string; label: string; color?: string }>;
  onSelect: (stage: DealStage) => void;
}) {
  const currentStage = stages.find((s) => s.id === stage) || { id: stage, label: stage };
  
  const getStageClasses = (s: string) => {
    switch (s) {
      case "lead": return "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200";
      case "contact": return "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200";
      case "proposal": return "bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200";
      case "negotiation": return "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200";
      case "won": return "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200";
      case "lost": return "bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200";
      default: return "bg-muted text-muted-foreground hover:bg-muted/80 border-transparent";
    }
  };

  const customColor = currentStage.color ? normalizeStageColor(currentStage.color, currentStage.id, currentStage.label) : null;
  const customStyle = customColor
    ? {
        backgroundColor: hexToRgba(customColor, 0.12),
        color: customColor,
        borderColor: hexToRgba(customColor, 0.24),
      }
    : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase border cursor-pointer transition-colors whitespace-nowrap",
          !customStyle && getStageClasses(stage)
        )} style={customStyle}>
          {currentStage.label}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {stages.map((s) => (
          <DropdownMenuItem 
            key={s.id} 
            onClick={() => onSelect(s.id as DealStage)}
            className="text-[11px] font-bold uppercase"
          >
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Pipeline({ userEmail, activeTab: activeCRMTab }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { dealId, contactId, companyId } = useParams();
  const { deals, updateDeal, removeDeal, moveDeal, fetchDeals, setOutcome } = useDealsStore();
  const { contacts, fetchContacts } = useCRMContactsStore();
  const fetchContactCompanyLinks = useCRMContactCompaniesStore((state) => state.fetchLinks);
  const { companies, fetchCompanies } = useCRMCompaniesStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { fetchStages, getStages } = usePipelineStagesStore();
  const { fetchPipelines, getPipelines } = useCRMPipelinesStore();
  const users = useUsersStore(s => s.users);
  const currentUser = users.find(u => u.email === userEmail);
  const roles = useRolesStore((state) => state.roles);
  const currentUserRole = roles.find((role) => role.id === currentUser?.roleId);
  const allowDeleteRecords = canDeleteRecords(currentUserRole);
  const workspacePipelines = getPipelines(activeWorkspaceId).filter((pipeline) => pipeline.isActive);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(() => readUserPref(userEmail, "selectedPipelineId") || "");
  const tasksViewFilter = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("filter") === "overdue" ? "overdue" : "all";
  }, [location.search]);
  const selectedPipeline = workspacePipelines.find((pipeline) => pipeline.id === selectedPipelineId) || workspacePipelines[0];
  const pipelinesReady = !activeWorkspaceId || workspacePipelines.length > 0;
  const pipelineStages = getStages(selectedPipeline?.id, selectedPipeline?.name);
  const userName = currentUser?.name || "Usuário";
  const [filters, setFilters] = useState<PipelineFilters>(() => readSessionJSON("crm.pipeline.filters", DEFAULT_PIPELINE_FILTERS));
  const [savedViews, setSavedViews] = useState<SavedPipelineView[]>(() => readLocalJSON(SAVED_PIPELINE_VIEWS_KEY, []));
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [viewsPopoverOpen, setViewsPopoverOpen] = useState(false);
  const [hideClosedDeals, setHideClosedDeals] = useState(() => readUserPref(userEmail, "hideClosedDeals") === "true");
  const [quickSearch, setQuickSearch] = useState("");
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [dealSort, setDealSort] = useState<DealSortState>(() => readSessionJSON("crm.pipeline.dealSort", DEFAULT_DEAL_SORT));
  const [selectedDealIds, setSelectedDealIds] = useState<string[]>([]);
  const [listRenderCounts, setListRenderCounts] = useState<Record<string, number>>({});
  const [kanbanRenderCounts, setKanbanRenderCounts] = useState<Record<string, number>>({});
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [dealPendingDelete, setDealPendingDelete] = useState<Deal | null>(null);
  
  const pipelineDeals = useMemo(
    () => {
      if (!activeWorkspaceId) return deals;
      if (!pipelinesReady || !selectedPipeline?.id) return [];
      return deals.filter((d) => d.workspaceId === activeWorkspaceId && d.pipelineId === selectedPipeline.id && canViewDeal(currentUserRole, currentUser, d));
    },
    [deals, activeWorkspaceId, currentUser, currentUserRole, pipelinesReady, selectedPipeline?.id]
  );

  // Fetch initial data from Supabase
  useEffect(() => {
    if (activeWorkspaceId) {
      setWorkspaceHeader(activeWorkspaceId);
      fetchDeals(activeWorkspaceId);
      fetchContacts(activeWorkspaceId);
      fetchCompanies(activeWorkspaceId);
      fetchContactCompanyLinks(activeWorkspaceId);
      fetchPipelines(activeWorkspaceId);
    } else {
      setWorkspaceHeader(null);
    }
  }, [activeWorkspaceId, fetchDeals, fetchContacts, fetchCompanies, fetchContactCompanyLinks, fetchPipelines]);

  useEffect(() => {
    if (workspacePipelines.length === 0) return;

    const selectedPipelineStillExists = workspacePipelines.some((pipeline) => pipeline.id === selectedPipelineId);
    if (!selectedPipelineId || !selectedPipelineStillExists) {
      setSelectedPipelineId(workspacePipelines[0].id);
    }
  }, [selectedPipelineId, workspacePipelines]);

  useEffect(() => {
    if (selectedPipeline?.id && activeWorkspaceId) {
      fetchStages(selectedPipeline.id, activeWorkspaceId, selectedPipeline.name);
    }
  }, [activeWorkspaceId, fetchStages, selectedPipeline?.id, selectedPipeline?.name]);

  
  const [showCreate, setShowCreate] = useState(false);
  const [createPersonType, setCreatePersonType] = useState<"Fisica" | "Juridica">("Fisica");
  const [activityDealTarget, setActivityDealTarget] = useState<Deal | null>(null);
  // Atalho do selo de tarefas (card e lista): abre só as tarefas atrasadas e de hoje da negociação.
  const [tasksDealId, setTasksDealId] = useState<string | null>(null);
  
  const { showCreateDeal, defaultPhone, defaultName, defaultContactId, openDealId, clearState } = usePipelineNavigationStore();

  useEffect(() => {
    if (showCreateDeal) {
      setShowCreate(true);
      // We don't call clearState() here anymore, it was wiping the defaults before the dialog could read them!
    } else if (openDealId) {
      navigate(`/pipeline/${openDealId}`);
      clearState();
    }
  }, [showCreateDeal, openDealId, clearState, navigate]);

  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => readUserPref(userEmail, "viewMode") === "kanban" ? "kanban" : "list");
  const [kanbanGrouping, setKanbanGrouping] = useState<"stage" | "owner">(
    () => readUserPref(userEmail, "kanbanGrouping") === "owner" ? "owner" : "stage",
  );
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dropStageHighlight, setDropStageHighlight] = useState<string | null>(null);
  const [cardFields, setCardFields] = useState<CardVisibleFields>(() => readUserPrefJSON(userEmail, "cardFields", { ...DEFAULT_CARD_FIELDS }));
  const [listColumns, setListColumns] = useState(() => readUserPrefJSON(userEmail, "listColumns", { ...DEFAULT_LIST_COLUMNS }));
  const [listGrouping, setListGrouping] = useState<ListGrouping>(() => {
    const stored = readUserPref(userEmail, "listGrouping");
    return stored === "owner" ? "owner" : "stage";
  });
  const [collapsedListGroups, setCollapsedListGroups] = useState<Record<string, boolean>>(() =>
    readUserPrefJSON(userEmail, "listGroups", {}),
  );
  useEffect(() => {
    if (selectedPipeline?.id) {
      writeUserPref(userEmail, "selectedPipelineId", selectedPipeline.id);
    }
  }, [selectedPipeline?.id, userEmail]);

  useEffect(() => {
    sessionStorage.setItem("crm.pipeline.filters", JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem(SAVED_PIPELINE_VIEWS_KEY, JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    sessionStorage.setItem("crm.pipeline.dealSort", JSON.stringify(dealSort));
  }, [dealSort]);

  useEffect(() => {
    writeUserPref(userEmail, "hideClosedDeals", String(hideClosedDeals));
  }, [hideClosedDeals, userEmail]);

  useEffect(() => {
    writeUserPref(userEmail, "viewMode", viewMode);
  }, [viewMode, userEmail]);

  useEffect(() => {
    writeUserPref(userEmail, "kanbanGrouping", kanbanGrouping);
  }, [kanbanGrouping, userEmail]);

  useEffect(() => {
    writeUserPref(userEmail, "cardFields", JSON.stringify(cardFields));
  }, [cardFields, userEmail]);

  useEffect(() => {
    writeUserPref(userEmail, "listColumns", JSON.stringify(listColumns));
  }, [listColumns, userEmail]);

  useEffect(() => {
    writeUserPref(userEmail, "listGrouping", listGrouping);
  }, [listGrouping, userEmail]);

  useEffect(() => {
    if (listGrouping === "none") {
      setListGrouping("stage");
    }
  }, [listGrouping]);

  useEffect(() => {
    writeUserPref(userEmail, "listGroups", JSON.stringify(collapsedListGroups));
  }, [collapsedListGroups, userEmail]);

  useEffect(() => {
    if (pipelineStages.length === 0) return;

    setCollapsedListGroups((current) => {
      let changed = false;
      const next = { ...current };

      pipelineStages.forEach((stage) => {
        if (!(stage.id in next)) {
          next[stage.id] = false;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [selectedPipeline?.id, pipelineStages]);

  useEffect(() => {
    if (activeCRMTab !== "Negociações") return undefined;

    const elementId = viewMode === "list" ? "crm-pipeline-list-scroll" : "crm-pipeline-kanban-scroll";
    const scrollElement = document.getElementById(elementId);
    if (!scrollElement) return undefined;

    const scrollScope = viewMode === "list" ? listGrouping : kanbanGrouping;
    const storageKey = `crm.pipeline.scroll.${viewMode}.${scrollScope}.${selectedPipeline?.id || "all"}`;
    const saved = readSessionJSON(storageKey, { top: 0, left: 0 });
    window.requestAnimationFrame(() => {
      scrollElement.scrollTop = saved.top || 0;
      scrollElement.scrollLeft = saved.left || 0;
    });

    const saveScroll = () => {
      sessionStorage.setItem(storageKey, JSON.stringify({
        top: scrollElement.scrollTop,
        left: scrollElement.scrollLeft,
      }));
    };

    scrollElement.addEventListener("scroll", saveScroll, { passive: true });
    return () => {
      saveScroll();
      scrollElement.removeEventListener("scroll", saveScroll);
    };
  }, [activeCRMTab, pipelineDeals.length, filters, kanbanGrouping, listGrouping, selectedPipeline?.id, viewMode]);

  const updateFilterValue = useCallback(<K extends keyof PipelineFilters>(key: K, value: PipelineFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...DEFAULT_PIPELINE_FILTERS });
  }, []);

  const saveCurrentView = useCallback(() => {
    const trimmedName = newViewName.trim();
    if (!trimmedName || !activeWorkspaceId || !selectedPipeline?.id) {
      toast.error("Informe um nome para a view.");
      return;
    }

    const newView: SavedPipelineView = {
      id: `${Date.now()}`,
      name: trimmedName,
      workspaceId: activeWorkspaceId,
      pipelineId: selectedPipeline.id,
      filters: { ...filters },
    };

    setSavedViews((current) => {
      const withoutSameName = current.filter(
        (view) =>
          !(view.workspaceId === activeWorkspaceId
            && view.pipelineId === selectedPipeline.id
            && view.name.toLowerCase() === trimmedName.toLowerCase()),
      );
      return [...withoutSameName, newView].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    });
    setNewViewName("");
    toast.success("View salva com sucesso.");
  }, [activeWorkspaceId, filters, newViewName, selectedPipeline?.id]);

  const applySavedView = useCallback((view: SavedPipelineView) => {
    setFilters({ ...DEFAULT_PIPELINE_FILTERS, ...view.filters });
    setViewsPopoverOpen(false);
    toast.success(`View "${view.name}" aplicada.`);
  }, []);

  const deleteSavedView = useCallback((viewId: string) => {
    setSavedViews((current) => current.filter((view) => view.id !== viewId));
  }, []);

  const toggleListColumn = (field: keyof typeof DEFAULT_LIST_COLUMNS) => {
    setListColumns(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const toggleCardField = (field: keyof CardVisibleFields) => {
    setCardFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const routeState = location.state as {
    dealMode?: "page" | "modal";
    /** de onde a tela de contato/empresa foi aberta, para o "voltar" devolver ao mesmo lugar */
    from?: string;
    fromLabel?: string;
    fromState?: { dealMode?: "page" | "modal" };
  } | null;
  const dealDetailMode: "page" | "modal" = routeState?.dealMode === "modal" ? "modal" : "page";
  /** Tarefas ou Kanban: decide a rota do detalhe e para onde o fechar devolve. */
  const dealOrigin = dealOriginFromPath(location.pathname);

  const selectedDeal = dealId
    ? deals.find((d) => d.id === dealId && (!activeWorkspaceId || d.workspaceId === activeWorkspaceId)) ?? null
    : null;

  // DnD sensors — require 8px movement before drag starts so clicks still work
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const formatDate = (dateStr: string) => 
    new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(dateStr));

  const getDealDisplayName = useCallback((deal: Deal) => {
    const companyName = deal.companyName || companies.find((company) => company.id === deal.companyId)?.name;
    const isCompanyDeal = deal.personType === "Juridica" || !!deal.companyId;
    return isCompanyDeal
      ? companyName || deal.dealName || deal.contactName || "Sem Nome"
      : deal.dealName || deal.contactName || "Sem Nome";
  }, [companies]);

  const getDealSecondaryLabel = (deal: Deal) => {
    const companyName = deal.companyName || companies.find((company) => company.id === deal.companyId)?.name;
    const primaryName = getDealDisplayName(deal);
    const primaryContact = getPrimaryContact(deal);
    const secondaryParts = [
      deal.personType === "Juridica" || deal.companyId ? primaryContact?.name || deal.contactName : companyName,
      primaryContact?.phone || deal.phone ? maskPhone(primaryContact?.phone || deal.phone || "") : "",
    ].filter((value) => value && value !== primaryName);

    return secondaryParts.join(" • ");
  };

  const getPrimaryContact = useCallback((deal: Deal) => {
    return (
      (deal.primaryContactId ? contacts.find((contact) => contact.id === deal.primaryContactId) : null)
      || (deal.contactId ? contacts.find((contact) => contact.id === deal.contactId) : null)
      || (deal.contactIds || []).map((id) => contacts.find((contact) => contact.id === id)).find(Boolean)
      || null
    );
  }, [contacts]);

  const getDealQualification = useCallback((deal: Deal) => {
    const primaryContact = getPrimaryContact(deal);
    const isCompanyDeal = deal.personType === "Juridica" || !!deal.companyId;
    const qualificationScore = isCompanyDeal
      ? primaryContact?.qualificationScore
      : typeof deal.qualificationScore === "number"
        ? deal.qualificationScore
        : primaryContact?.qualificationScore;
    const qualification = isCompanyDeal
      ? primaryContact?.qualificationClassification || (typeof qualificationScore === "number" ? classifyLead(qualificationScore) : undefined)
      : deal.qualificationClassification || primaryContact?.qualificationClassification || (typeof qualificationScore === "number" ? classifyLead(qualificationScore) : undefined);

    return {
      primaryContact,
      qualification,
      qualificationScore,
    };
  }, [getPrimaryContact]);

  const getResponsibleName = useCallback(
    (deal: Deal) => users.find((user) => user.id === deal.assignedTo)?.name || "",
    [users],
  );

  const dealSearchIndex = useCallback(
    (deal: Deal) => buildDealSearchIndex(deal, contacts, companies, getDealDisplayName(deal)),
    [companies, contacts, getDealDisplayName],
  );

  const filteredDeals = useMemo(() => {
    return pipelineDeals.filter((deal) => {
      const { qualification } = getDealQualification(deal);
      if (filters.ownerId === "unassigned" && deal.assignedTo) return false;
      if (filters.ownerId !== "all" && filters.ownerId !== "unassigned" && deal.assignedTo !== filters.ownerId) return false;
      if (filters.qualification === "unqualified" && qualification) return false;
      if (filters.qualification !== "all" && filters.qualification !== "unqualified" && qualification !== filters.qualification) return false;
      if (filters.stageId !== "all" && deal.stage !== filters.stageId) return false;
      if (hideClosedDeals) {
        const stage = pipelineStages.find((item) => item.id === deal.stage);
        if (isClosedDeal(deal, stage?.label)) return false;
      }

      if (filters.closingDateFrom || filters.closingDateTo) {
        if (!deal.closingDate) return false;
        const closingTime = parseLocalDateValue(deal.closingDate)?.getTime() ?? NaN;
        if (Number.isNaN(closingTime)) return false;
        if (filters.closingDateFrom) {
          const minClosing = new Date(`${filters.closingDateFrom}T00:00:00`).getTime();
          if (closingTime < minClosing) return false;
        }
        if (filters.closingDateTo) {
          const maxClosing = new Date(`${filters.closingDateTo}T23:59:59`).getTime();
          if (closingTime > maxClosing) return false;
        }
      }

      const minValue = filters.minValue ? Number(filters.minValue) : null;
      const maxValue = filters.maxValue ? Number(filters.maxValue) : null;
      if (minValue !== null && !Number.isNaN(minValue) && (deal.value || 0) < minValue) return false;
      if (maxValue !== null && !Number.isNaN(maxValue) && (deal.value || 0) > maxValue) return false;

      return true;
    });
  }, [filters, getDealQualification, hideClosedDeals, pipelineDeals, pipelineStages]);

  const visiblePipelineStages = useMemo(
    () => hideClosedDeals ? pipelineStages.filter((stage) => !isClosedStage(stage.id, stage.label)) : pipelineStages,
    [hideClosedDeals, pipelineStages],
  );

  const searchSuggestionDeals = useMemo(() => {
    if (!quickSearch.trim() || !activeWorkspaceId) return [];

    return deals
      .filter((deal) => deal.workspaceId === activeWorkspaceId && canViewDeal(currentUserRole, currentUser, deal))
      .filter((deal) => {
        const { text, digits } = dealSearchIndex(deal);
        return matchesSearchTerm(quickSearch, text, digits);
      })
      .slice(0, 8);
  }, [activeWorkspaceId, currentUser, currentUserRole, deals, dealSearchIndex, quickSearch]);

  const hasActiveFilters = useMemo(
    () => Object.entries(filters).some(([key, value]) => key !== "search" && String(value || "").trim() !== "" && value !== "all"),
    [filters],
  );
  const activeFilterCount = useMemo(
    () =>
      [
        filters.ownerId !== "all" ? filters.ownerId : "",
        filters.qualification !== "all" ? filters.qualification : "",
        filters.stageId !== "all" ? filters.stageId : "",
        filters.closingDateFrom,
        filters.closingDateTo,
        filters.minValue,
        filters.maxValue,
      ].filter(Boolean).length,
    [filters],
  );

  const savedViewsForScope = useMemo(
    () =>
      savedViews.filter((view) =>
        view.workspaceId === (activeWorkspaceId || "")
        && view.pipelineId === (selectedPipeline?.id || ""),
      ),
    [activeWorkspaceId, savedViews, selectedPipeline?.id],
  );

  const getDealStageColor = useCallback(
    (stageId: string, stageLabel?: string) => {
      const stage = pipelineStages.find((item) => item.id === stageId);
      return normalizeStageColor(stage?.color, stageId, stageLabel || stage?.label || stageId);
    },
    [pipelineStages],
  );

  const moveDealToStage = useCallback(async (dealToMove: Deal, nextStage: DealStage) => {
    if (QUALIFICATION_REQUIRED_STAGES.has(String(nextStage)) && !dealToMove.qualificationCompletedAt) {
      toast.error("Esta negociação ainda não possui uma qualificação concluída. Preencha a aba Qualificação para continuar o processo comercial.");
      navigate(`/pipeline/${dealToMove.id}`, { state: { dealMode: "modal" } });
      return;
    }

    if (dealToMove.stage !== nextStage) {
      const nextStageLabel = pipelineStages.find((stage) => stage.id === nextStage)?.label;
      await moveDeal(dealToMove.id, nextStage, userName, nextStageLabel);
      toast.success(`Card movido para ${nextStageLabel || nextStage}`);
    }
  }, [moveDeal, navigate, pipelineStages, userName]);

  const dealAttentionById = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const staleThreshold = 7 * 24 * 60 * 60 * 1000;

    return Object.fromEntries(
      pipelineDeals.map((deal) => {
        const latestTaskTimestamp = Math.max(
          0,
          ...((deal.tasks || []).map((task) => getLatestTimestamp(task.updatedAt, task.completedAt, task.canceledAt, task.createdAt))),
        );
        const latestHistoryTimestamp = Math.max(
          0,
          ...((deal.history || []).map((event) => getLatestTimestamp(event.date))),
        );
        const lastActivityAt = Math.max(
          getLatestTimestamp(deal.updatedAt, deal.createdAt),
          latestTaskTimestamp,
          latestHistoryTimestamp,
        );

        const taskAttention = getDealTaskAttention(deal.tasks, new Date(now));

        const closingDate = parseLocalDateValue(deal.closingDate);

        return [
          deal.id,
          {
            hasOverdueClosingDate: !!closingDate && closingDate.getTime() < startOfToday.getTime(),
            hasStaleActivity: !lastActivityAt || now - lastActivityAt > staleThreshold,
            overdueTaskCount: taskAttention.overdue.length,
            todayTaskCount: taskAttention.today.length,
          },
        ];
      }),
    ) as Record<string, { hasOverdueClosingDate: boolean; hasStaleActivity: boolean; overdueTaskCount: number; todayTaskCount: number }>;
  }, [pipelineDeals]);

  const sortedDeals = useMemo(() => {
    const directionFactor = dealSort.direction === "asc" ? 1 : -1;

    return [...filteredDeals].sort((leftDeal, rightDeal) => {
      const leftName = getDealDisplayName(leftDeal);
      const rightName = getDealDisplayName(rightDeal);
      const leftResponsible = getResponsibleName(leftDeal);
      const rightResponsible = getResponsibleName(rightDeal);

      let comparison = 0;
      switch (dealSort.key) {
        case "dealName":
          comparison = leftName.localeCompare(rightName, "pt-BR");
          break;
        case "dealCode":
          comparison = (leftDeal.dealCodeNumber || 0) - (rightDeal.dealCodeNumber || 0);
          if (comparison === 0) comparison = (leftDeal.dealCode || "").localeCompare(rightDeal.dealCode || "", "pt-BR");
          break;
        case "value":
          comparison = (leftDeal.value || 0) - (rightDeal.value || 0);
          break;
        case "assignedTo":
          comparison = leftResponsible.localeCompare(rightResponsible, "pt-BR");
          break;
        case "closingDate":
          comparison =
            (parseLocalDateValue(leftDeal.closingDate)?.getTime() || 0)
            - (parseLocalDateValue(rightDeal.closingDate)?.getTime() || 0);
          break;
        case "createdAt":
          comparison = new Date(leftDeal.createdAt).getTime() - new Date(rightDeal.createdAt).getTime();
          break;
        case "updatedAt":
        default:
          comparison = new Date(leftDeal.updatedAt || leftDeal.createdAt).getTime() - new Date(rightDeal.updatedAt || rightDeal.createdAt).getTime();
          break;
      }

      if (comparison !== 0) return comparison * directionFactor;
      return leftName.localeCompare(rightName, "pt-BR");
    });
  }, [dealSort.direction, dealSort.key, filteredDeals, getDealDisplayName, getResponsibleName]);

  const handleExportDeals = useCallback(() => {
    const rows = sortedDeals.map((deal) => {
      const { primaryContact, qualification, qualificationScore } = getDealQualification(deal);
      const stage = pipelineStages.find((pipelineStage) => pipelineStage.id === deal.stage);
      const company = companies.find((item) => item.id === deal.companyId)
        || companies.find((item) => item.name.toLowerCase() === (deal.companyName || "").toLowerCase());
      const companyName = deal.companyName || company?.name || "—";
      const cpfOrCnpj = deal.personType === "Fisica"
        ? deal.cpf || primaryContact?.cpf || "—"
        : deal.cnpj || company?.cnpj || "—";
      const companyStructure = company?.companyType === "FILIAL" ? "Filial" : company?.companyType === "MATRIZ" ? "Matriz" : "—";
      const parentCompanyName = company?.parentCompanyId
        ? companies.find((item) => item.id === company.parentCompanyId)?.name || "—"
        : company?.companyType === "MATRIZ"
          ? company.name
          : "—";

      return {
        idNegociacao: deal.dealCode || "—",
        negocio: getDealDisplayName(deal),
        tipoPessoa: deal.personType || "—",
        cpfCnpj: cpfOrCnpj,
        empresa: companyName,
        estruturaEmpresa: companyStructure,
        nomeMatriz: parentCompanyName,
        contato: primaryContact?.name || deal.contactName || "—",
        telefone: primaryContact?.phone || deal.phone || "",
        email: primaryContact?.email || deal.email || "",
        responsavel: getResponsibleName(deal) || "Sem responsável",
        pipeline: selectedPipeline?.name || "Pipeline",
        etapa: stage?.label || deal.stage,
        valor: formatCurrency(deal.value || 0),
        qualificacao: qualification || "Sem qualificação",
        pontuacao: typeof qualificationScore === "number" ? `${qualificationScore}/20` : "—",
        fechamento: formatClosingDate(deal.closingDate),
        criadoEm: formatDate(deal.createdAt),
        atualizadoEm: formatDate(deal.updatedAt || deal.createdAt),
      };
    });

    exportRowsToExcel({
      filename: `negociacoes-${selectedPipeline?.name || "pipeline"}-${new Date().toISOString().slice(0, 10)}`,
      sheetName: "Negociações",
      rows,
      columns: [
        { header: "ID", value: "idNegociacao" },
        { header: "Negociação", value: "negocio" },
        { header: "Tipo de Pessoa", value: "tipoPessoa" },
        { header: "CPF/CNPJ", value: "cpfCnpj" },
        { header: "Empresa", value: "empresa" },
        { header: "Estrutura da Empresa", value: "estruturaEmpresa" },
        { header: "Nome da Matriz", value: "nomeMatriz" },
        { header: "Contato", value: "contato" },
        { header: "Telefone", value: (row) => row.telefone ? maskPhone(row.telefone) : "—" },
        { header: "E-mail", value: "email" },
        { header: "Responsável", value: "responsavel" },
        { header: "Pipeline", value: "pipeline" },
        { header: "Etapa", value: "etapa" },
        { header: "Valor", value: "valor" },
        { header: "Qualificação", value: "qualificacao" },
        { header: "Pontuação", value: "pontuacao" },
        { header: "Fechamento", value: "fechamento" },
        { header: "Criado em", value: "criadoEm" },
        { header: "Atualizado em", value: "atualizadoEm" },
      ],
    });

    toast.success(`Excel exportado com ${rows.length} ${rows.length === 1 ? "negociação filtrada" : "negociações filtradas"}.`);
  }, [sortedDeals, getDealQualification, pipelineStages, companies, getDealDisplayName, getResponsibleName, selectedPipeline?.name]);

  const responsibleLanes = useMemo(() => {
    const grouped = new Map<string, Deal[]>();

    sortedDeals.forEach((deal) => {
      const laneId = deal.assignedTo || "unassigned";
      const existing = grouped.get(laneId) || [];
      grouped.set(laneId, [...existing, deal]);
    });

    const lanes = Array.from(grouped.entries()).map(([laneId, laneDeals]) => {
      const user = users.find((item) => item.id === laneId);
      return {
        id: laneId,
        label: user?.name || "Sem responsável",
        avatar: user?.avatar,
        deals: laneDeals,
        totalValue: laneDeals.reduce((sum, deal) => sum + (deal.value || 0), 0),
      };
    });

    const sortedLanes = lanes.sort((a, b) => {
      if (a.id === "unassigned") return 1;
      if (b.id === "unassigned") return -1;
      return a.label.localeCompare(b.label, "pt-BR");
    });

    return sortedLanes.length > 0
      ? sortedLanes
      : [
          {
            id: "unassigned",
            label: "Sem responsável",
            avatar: undefined,
            deals: [],
            totalValue: 0,
          },
        ];
  }, [sortedDeals, users]);

  const listGroups = useMemo(() => {
    if (listGrouping === "none") {
      return [
        {
          id: "all-deals",
          label: "Todas as negociações",
          description: "Visualização contínua de todas as negociações do pipeline selecionado.",
          deals: sortedDeals,
          totalValue: sortedDeals.reduce((sum, deal) => sum + (deal.value || 0), 0),
          collapsible: false,
          color: undefined,
        },
      ];
    }

    if (listGrouping === "owner") {
      const grouped = new Map<string, Deal[]>();

      sortedDeals.forEach((deal) => {
        const key = deal.assignedTo || "unassigned";
        const existing = grouped.get(key) || [];
        grouped.set(key, [...existing, deal]);
      });

      return Array.from(grouped.entries())
        .map(([ownerId, ownerDeals]) => {
          const owner = users.find((user) => user.id === ownerId);
          return {
            id: `owner:${ownerId}`,
            label: owner?.name || "Sem responsável",
            description: "Agrupamento por responsável da negociação.",
            deals: ownerDeals,
            totalValue: ownerDeals.reduce((sum, deal) => sum + (deal.value || 0), 0),
            collapsible: true,
            color: undefined,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    }

    return visiblePipelineStages.map((stage) => {
      const stageDeals = sortedDeals.filter((deal) => deal.stage === stage.id);

      return {
        id: `stage:${stage.id}`,
        label: stage.label,
        description: "Agrupamento por etapa do pipeline selecionado.",
        deals: stageDeals,
        totalValue: stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0),
        collapsible: true,
        color: normalizeStageColor(stage.color, stage.id, stage.label),
      };
    });
  }, [listGrouping, sortedDeals, users, visiblePipelineStages]);

  const visibleListGroups = useMemo(
    () => (listGrouping === "none" ? listGroups : listGroups.filter((group) => group.deals.length > 0)),
    [listGrouping, listGroups],
  );

  useEffect(() => {
    setSelectedDealIds((current) => current.filter((dealId) => filteredDeals.some((deal) => deal.id === dealId)));
  }, [filteredDeals]);

  useEffect(() => {
    setListRenderCounts((current) => {
      const next = { ...current };
      let changed = false;

      listGroups.forEach((group) => {
        if (!next[group.id]) {
          next[group.id] = INITIAL_LIST_GROUP_RENDER_COUNT;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [listGroups]);

  useEffect(() => {
    setKanbanRenderCounts((current) => {
      const next = { ...current };
      let changed = false;

      if (kanbanGrouping === "stage") {
        visiblePipelineStages.forEach((stage) => {
          if (!next[stage.id]) {
            next[stage.id] = INITIAL_KANBAN_RENDER_COUNT;
            changed = true;
          }
        });
      } else {
        responsibleLanes.forEach((lane) => {
          visiblePipelineStages.forEach((stage) => {
            const key = `${lane.id}::${stage.id}`;
            if (!next[key]) {
              next[key] = INITIAL_KANBAN_RENDER_COUNT;
              changed = true;
            }
          });
        });
      }

      return changed ? next : current;
    });
  }, [kanbanGrouping, responsibleLanes, visiblePipelineStages]);

  const toggleDealSort = useCallback((key: DealSortKey) => {
    setDealSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: key === "value" || key === "closingDate" || key === "createdAt" || key === "updatedAt" ? "desc" : "asc",
      };
    });
  }, []);

  const loadMoreListGroupDeals = useCallback((groupId: string) => {
    setListRenderCounts((current) => ({
      ...current,
      [groupId]: (current[groupId] || INITIAL_LIST_GROUP_RENDER_COUNT) + LIST_GROUP_RENDER_STEP,
    }));
  }, []);

  const loadMoreKanbanDeals = useCallback((laneKey: string) => {
    setKanbanRenderCounts((current) => ({
      ...current,
      [laneKey]: (current[laneKey] || INITIAL_KANBAN_RENDER_COUNT) + KANBAN_RENDER_STEP,
    }));
  }, []);

  const selectedDeals = useMemo(
    () => filteredDeals.filter((deal) => selectedDealIds.includes(deal.id)),
    [filteredDeals, selectedDealIds],
  );

  const toggleDealSelection = useCallback((dealId: string, checked: boolean) => {
    setSelectedDealIds((current) => {
      if (checked) return current.includes(dealId) ? current : [...current, dealId];
      return current.filter((id) => id !== dealId);
    });
  }, []);

  const toggleMultipleDealsSelection = useCallback((dealIds: string[], checked: boolean) => {
    setSelectedDealIds((current) => {
      const next = new Set(current);
      dealIds.forEach((dealId) => {
        if (checked) next.add(dealId);
        else next.delete(dealId);
      });
      return Array.from(next);
    });
  }, []);

  const clearDealSelection = useCallback(() => {
    setSelectedDealIds([]);
  }, []);

  const sortIconFor = useCallback((key: DealSortKey) => {
    if (dealSort.key !== key) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />;
    return dealSort.direction === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 text-primary" />;
  }, [dealSort.direction, dealSort.key]);

  const handleBulkAssignResponsible = useCallback(async (assignedTo?: string) => {
    if (selectedDeals.length === 0) return;
    await Promise.all(selectedDeals.map((deal) => updateDeal(deal.id, { assignedTo: assignedTo || "" })));
    const responsibleName = assignedTo ? users.find((user) => user.id === assignedTo)?.name || "Responsável" : "Sem responsável";
    toast.success(`Responsável em massa atualizado para ${responsibleName}.`);
    clearDealSelection();
  }, [clearDealSelection, selectedDeals, updateDeal, users]);

  const handleBulkOutcomeChange = useCallback(async (outcome: Deal["outcome"]) => {
    if (selectedDeals.length === 0) return;
    await Promise.all(selectedDeals.map((deal) => setOutcome(deal.id, outcome || null, undefined, undefined, userName)));
    toast.success("Status dos negócios atualizado em massa.");
    clearDealSelection();
  }, [clearDealSelection, selectedDeals, setOutcome, userName]);

  const handleBulkStageChange = useCallback(async (nextStage: DealStage) => {
    if (selectedDeals.length === 0) return;

    const blocked: string[] = [];
    const eligible: Deal[] = [];

    for (const deal of selectedDeals) {
      if (QUALIFICATION_REQUIRED_STAGES.has(String(nextStage)) && !deal.qualificationCompletedAt) {
        blocked.push(`${getDealDisplayName(deal)} sem qualificação concluída`);
        continue;
      }

      eligible.push(deal);
    }

    const nextStageLabel = pipelineStages.find((stage) => stage.id === nextStage)?.label;
    await Promise.all(eligible.map((deal) => moveDeal(deal.id, nextStage, userName, nextStageLabel)));

    if (eligible.length > 0) toast.success(`${eligible.length} negócio(s) atualizado(s) para a nova etapa.`);
    if (blocked.length > 0) toast.warning(`Alguns negócios não puderam ser movidos: ${blocked.slice(0, 2).join("; ")}${blocked.length > 2 ? "..." : ""}`);

    clearDealSelection();
  }, [clearDealSelection, getDealDisplayName, moveDeal, pipelineStages, selectedDeals, userName]);

  const handleConfirmBulkDelete = useCallback(async () => {
    if (selectedDeals.length === 0) return;
    if (!allowDeleteRecords) {
      toast.error("Seu perfil não permite excluir registros.");
      setBulkDeleteOpen(false);
      return;
    }
    await Promise.all(selectedDeals.map((deal) => removeDeal(deal.id)));
    toast.success(`${selectedDeals.length} negócio(s) removido(s).`);
    setBulkDeleteOpen(false);
    clearDealSelection();
  }, [allowDeleteRecords, clearDealSelection, removeDeal, selectedDeals]);

  // Kanban drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    const overId = over.id as string;
    const overData = over.data.current as { stageId?: string; deal?: Deal } | undefined;
    const targetStage =
      overData?.stageId ||
      overData?.deal?.stage ||
      (pipelineStages.some((stage) => stage.id === overId) ? overId : undefined) ||
      filteredDeals.find((deal) => deal.id === overId)?.stage;

    if (targetStage) {
      const deal = filteredDeals.find(d => d.id === dealId);
      if (deal && deal.stage !== targetStage) {
        setDropStageHighlight(targetStage);
        moveDealToStage(deal, targetStage as DealStage);
      }
    }
  };

  const activeDeal = activeDragId ? filteredDeals.find(d => d.id === activeDragId) : null;
  useEffect(() => {
    if (!dropStageHighlight) return undefined;

    const timeout = window.setTimeout(() => setDropStageHighlight(null), 450);
    return () => window.clearTimeout(timeout);
  }, [dropStageHighlight]);

  const dropAnimation = useMemo<DropAnimation>(
    () => ({
      duration: 260,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      sideEffects: defaultDropAnimationSideEffects({
        styles: {
          active: {
            opacity: "0.38",
          },
        },
      }),
    }),
    [],
  );
  const openDealDetails = useCallback((dealId: string, mode: "page" | "modal" = "page") => {
    navigate(dealDetailPath(dealOrigin, dealId, location.search), {
      state: mode === "modal" ? { dealMode: "modal" } : undefined,
    });
  }, [dealOrigin, location.search, navigate]);
  const toggleListGroup = useCallback((groupId: string) => {
    setCollapsedListGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  }, []);
  const assignDealResponsible = useCallback(async (deal: Deal, assignedTo?: string) => {
    await updateDeal(deal.id, { assignedTo: assignedTo || "" });
    const responsibleName = assignedTo ? users.find((user) => user.id === assignedTo)?.name || "Responsável" : null;
    toast.success(responsibleName ? `Responsável alterado para ${responsibleName}` : "Responsável removido");
  }, [updateDeal, users]);
  const handleDeleteDeal = useCallback((deal: Deal) => {
    if (!allowDeleteRecords) {
      toast.error("Seu perfil não permite excluir registros.");
      return;
    }
    setDealPendingDelete(deal);
  }, [allowDeleteRecords]);

  const handleConfirmDeleteDeal = useCallback(async () => {
    if (!dealPendingDelete) return;
    if (!allowDeleteRecords) {
      toast.error("Seu perfil não permite excluir registros.");
      setDealPendingDelete(null);
      return;
    }

    await removeDeal(dealPendingDelete.id);
    toast.success("Negociação removida");
    setDealPendingDelete(null);
  }, [allowDeleteRecords, dealPendingDelete, removeDeal]);
  // Fechar devolve à lista de ONDE a negociação foi aberta — Tarefas ou Kanban. Era `/pipeline`
  // fixo, e quem vinha de uma tarefa caía no Kanban sem referência nenhuma.
  const closeDealDetails = useCallback(() => {
    navigate(dealListPath(dealOrigin, location.search));
  }, [dealOrigin, location.search, navigate]);
  // Expandir troca só o MODO, mantendo a rota: da Tarefas em modal para a Tarefas em página cheia.
  // Se apontasse para /pipeline/:dealId, o Voltar da tela cheia voltaria a cair no Kanban.
  const expandDealDetails = useCallback(() => {
    if (dealId) {
      navigate(dealDetailPath(dealOrigin, dealId, location.search), {
        replace: true,
        state: { dealMode: "page" },
      });
    }
  }, [dealId, dealOrigin, location.search, navigate]);

  if (selectedDeal && dealDetailMode === "page") {
    return (
      <DealView 
        deal={selectedDeal}
        onBack={closeDealDetails}
        userEmail={userEmail}
        mode="page"
        onOpenCompany={(companyId) => {
          navigate(`/companies/${companyId}`);
        }}
        onOpenContact={(contactId) => {
          navigate(`/contacts/${contactId}`, {
            // A origem sai da rota atual: se a negociação foi aberta pela Tarefas, o voltar do
            // contato devolve a ela, e não a /pipeline/:dealId, que jogaria a Tarefas fora.
            state: {
              from: dealDetailPath(dealOrigin, selectedDeal.id, location.search),
              fromLabel: "Negociação",
            },
          });
        }}
      />
    );
  }

  if (contactId) {
    return (
      <ContactView
        contactId={contactId}
        // Aberto de dentro de uma negociação, o "voltar" devolve à negociação — e no mesmo modo
        // (página ou modal) em que ela estava. Sem isso o vendedor caía na lista de contatos e
        // tinha de reencontrar a negociação de onde saiu.
        onBack={() => (routeState?.from ? navigate(routeState.from, { state: routeState.fromState }) : navigate("/contacts"))}
        backLabel={routeState?.fromLabel}
        onOpenDeal={(dealId) => {
          navigate(`/pipeline/${dealId}`);
        }}
        onOpenCompany={(companyId) => {
          navigate(`/companies/${companyId}`);
        }}
        currentUser={currentUser}
        currentUserRole={currentUserRole}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col",
        companyId && activeCRMTab === "Empresas"
          ? "overflow-hidden p-0 space-y-0"
          : activeCRMTab === "Negociações"
            ? "overflow-hidden p-6 space-y-6"
            : "overflow-auto p-6 space-y-6"
      )}>
        
        {activeCRMTab === "Negociações" && (
          <>
            {/* Header */}
            <div
              className="crm-surface-glow rounded-[28px] border border-primary/10 bg-card/80 px-4 py-3 shadow-[0_24px_60px_-42px_hsl(var(--primary)/0.45)] backdrop-blur-sm"
            >
              <div className="flex w-full flex-wrap items-center justify-end gap-3">
                <div className="relative z-[200] mr-auto">
                  <Popover
                    open={searchSuggestionsOpen && Boolean(quickSearch.trim())}
                    onOpenChange={setSearchSuggestionsOpen}
                  >
                    <PopoverTrigger asChild>
                      <div className="relative min-w-[260px] sm:min-w-[420px]">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={quickSearch}
                          onChange={(event) => {
                            setQuickSearch(event.target.value);
                            setSearchSuggestionsOpen(true);
                          }}
                          onFocus={() => {
                            if (quickSearch.trim()) setSearchSuggestionsOpen(true);
                          }}
                          placeholder="Buscar negociação, ID, telefone ou empresa"
                          className="h-10 rounded-xl border-primary/15 bg-background/90 pl-9 pr-9 shadow-sm"
                        />
                        {quickSearch ? (
                          <button
                            type="button"
                            onClick={() => {
                              setQuickSearch("");
                              setSearchSuggestionsOpen(false);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Limpar busca"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      sideOffset={8}
                      onOpenAutoFocus={(event) => event.preventDefault()}
                      className="z-[9999] w-[min(680px,calc(100vw-48px))] overflow-hidden rounded-xl border border-border bg-background p-0 text-foreground shadow-2xl ring-1 ring-black/10"
                    >
                        <div className="flex items-center gap-4 border-b border-border bg-background px-4 py-2 text-sm">
                          <span className="font-medium text-muted-foreground">Todos</span>
                          <span className="border-b-2 border-primary pb-2 font-semibold text-primary">Negociações</span>
                        </div>
                        <div className="max-h-[360px] overflow-auto bg-background py-2">
                          <div className="px-4 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                            Negociações <span className="ml-1 rounded bg-muted px-1.5 py-0.5">{searchSuggestionDeals.length}</span>
                          </div>
                          {searchSuggestionDeals.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-muted-foreground">Nenhuma negociação encontrada.</div>
                          ) : (
                            searchSuggestionDeals.map((deal) => {
                              const pipelineName = workspacePipelines.find((pipeline) => pipeline.id === deal.pipelineId)?.name;
                              return (
                                <button
                                  key={deal.id}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    setSearchSuggestionsOpen(false);
                                    openDealDetails(deal.id, "page");
                                  }}
                                  className="flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/70"
                                >
                                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-foreground">
                                      {deal.dealCode ? `${deal.dealCode} ` : ""}{getDealDisplayName(deal)}
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                      {[pipelineName, getDealSecondaryLabel(deal), getResponsibleName(deal)].filter(Boolean).join(" • ")}
                                    </span>
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-wrap items-center gap-3">
            <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 gap-2 rounded-xl border-primary/15 bg-background/90 px-3 text-sm font-semibold text-foreground shadow-sm hover:bg-primary/5">
                  <Filter className="h-4 w-4" />
                  Filtros
                  {activeFilterCount > 0 ? (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[380px] p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Filtrar negociações</p>
                      <p className="text-xs text-muted-foreground">Aplicado na lista e no kanban.</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters} disabled={!hasActiveFilters}>
                      Limpar
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Responsável</Label>
                      <select
                        className="flex h-10 w-full rounded-xl border border-primary/15 bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        value={filters.ownerId}
                        onChange={(event) => updateFilterValue("ownerId", event.target.value)}
                      >
                        <option value="all">Todos</option>
                        <option value="unassigned">Sem responsável</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Qualificação</Label>
                      <select
                        className="flex h-10 w-full rounded-xl border border-primary/15 bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        value={filters.qualification}
                        onChange={(event) => updateFilterValue("qualification", event.target.value)}
                      >
                        <option value="all">Todas</option>
                        <option value="unqualified">Sem qualificação</option>
                        {QUALIFICATION_FILTER_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Estágio</Label>
                      <select
                        className="flex h-10 w-full rounded-xl border border-primary/15 bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        value={filters.stageId}
                        onChange={(event) => updateFilterValue("stageId", event.target.value)}
                      >
                        <option value="all">Todos</option>
                        {pipelineStages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Fechamento de</Label>
                      <Input type="date" value={filters.closingDateFrom} onChange={(event) => updateFilterValue("closingDateFrom", event.target.value)} className="h-10 rounded-xl border-primary/15" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fechamento até</Label>
                      <Input type="date" value={filters.closingDateTo} onChange={(event) => updateFilterValue("closingDateTo", event.target.value)} className="h-10 rounded-xl border-primary/15" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor mínimo</Label>
                      <Input type="number" min="0" step="0.01" value={filters.minValue} onChange={(event) => updateFilterValue("minValue", event.target.value)} placeholder="0,00" className="h-10 rounded-xl border-primary/15" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor máximo</Label>
                      <Input type="number" min="0" step="0.01" value={filters.maxValue} onChange={(event) => updateFilterValue("maxValue", event.target.value)} placeholder="0,00" className="h-10 rounded-xl border-primary/15" />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Popover open={viewsPopoverOpen} onOpenChange={setViewsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 gap-2 rounded-xl border-primary/15 bg-background/90 px-3 text-sm font-semibold text-foreground shadow-sm hover:bg-primary/5">
                  <Bookmark className="h-4 w-4" />
                  Views
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[340px] p-4">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Views customizadas</p>
                    <p className="text-xs text-muted-foreground">Salve combinações de filtros deste pipeline.</p>
                  </div>

                  <div className="flex gap-2">
                    <Input value={newViewName} onChange={(event) => setNewViewName(event.target.value)} placeholder="Ex: Meus deals quentes" className="h-10 rounded-xl border-primary/15" />
                    <Button type="button" onClick={saveCurrentView} className="h-10 shrink-0 rounded-xl px-3">
                      <BookmarkPlus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {savedViewsForScope.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                        Nenhuma view salva neste pipeline.
                      </div>
                    ) : (
                      savedViewsForScope.map((view) => (
                        <div key={view.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                          <button type="button" onClick={() => applySavedView(view)} className="min-w-0 flex-1 text-left">
                            <p className="truncate text-sm font-semibold text-foreground">{view.name}</p>
                            <p className="text-xs text-muted-foreground">Aplicar filtros salvos</p>
                          </button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted" onClick={() => deleteSavedView(view.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {workspacePipelines.length > 0 && (
              <div className="min-w-[220px]">
                <select
                  className="flex h-10 w-full rounded-xl border border-primary/15 bg-background/90 px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
            )}
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setHideClosedDeals((current) => !current)}
                    className={cn(
                      "h-10 w-10 rounded-xl border-primary/15 bg-background/90 text-foreground shadow-sm hover:bg-primary/5",
                      hideClosedDeals && "border-primary/35 bg-primary/10 text-primary hover:bg-primary/15",
                    )}
                    aria-label={hideClosedDeals ? "Mostrar ganhos e perdidos" : "Ocultar ganhos e perdidos"}
                    aria-pressed={hideClosedDeals}
                  >
                    {hideClosedDeals ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {hideClosedDeals ? "Mostrar ganhos e perdidos" : "Ocultar ganhos e perdidos"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {viewMode === "list" && (
              <div className="flex h-11 items-center rounded-xl border border-primary/15 bg-background/80 p-1 shadow-sm">
                <button
                  onClick={() => setListGrouping("stage")}
                  className={`flex h-full items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-all ${
                    listGrouping === "stage"
                      ? "bg-primary text-primary-foreground shadow-[0_12px_26px_-16px_hsl(var(--primary)/0.9)]"
                      : "text-sidebar-foreground hover:bg-primary/5"
                  }`}
                >
                  <Kanban className="w-3.5 h-3.5" />
                  Por etapa
                </button>
                <button
                  onClick={() => setListGrouping("owner")}
                  className={`flex h-full items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-all ${
                    listGrouping === "owner"
                      ? "bg-primary text-primary-foreground shadow-[0_12px_26px_-16px_hsl(var(--primary)/0.9)]"
                      : "text-sidebar-foreground hover:bg-primary/5"
                  }`}
                >
                  <LayoutPanelLeft className="w-3.5 h-3.5" />
                  Por responsável
                </button>
              </div>
            )}
            {viewMode === "kanban" && (
              <div className="flex h-11 items-center rounded-xl border border-primary/15 bg-background/80 p-1 shadow-sm">
                <button
                  onClick={() => setKanbanGrouping("stage")}
                  className={`flex h-full items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-all ${
                    kanbanGrouping === "stage"
                      ? "bg-primary text-primary-foreground shadow-[0_12px_26px_-16px_hsl(var(--primary)/0.9)]"
                      : "text-sidebar-foreground hover:bg-primary/5"
                  }`}
                >
                  <Kanban className="w-3.5 h-3.5" />
                  Por etapa
                </button>
                <button
                  onClick={() => setKanbanGrouping("owner")}
                  className={`flex h-full items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-all ${
                    kanbanGrouping === "owner"
                      ? "bg-primary text-primary-foreground shadow-[0_12px_26px_-16px_hsl(var(--primary)/0.9)]"
                      : "text-sidebar-foreground hover:bg-primary/5"
                  }`}
                >
                  <LayoutPanelLeft className="w-3.5 h-3.5" />
                  Por responsável
                </button>
              </div>
            )}
            {/* View Toggle */}
            <div className="flex h-11 items-center rounded-xl border border-primary/15 bg-background/80 p-1 shadow-sm">
              <button
                onClick={() => setViewMode("list")}
                className={`flex h-full items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-all ${
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground shadow-[0_12px_26px_-16px_hsl(var(--primary)/0.9)]"
                    : "text-sidebar-foreground hover:bg-primary/5"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Lista
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={`flex h-full items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-all ${
                  viewMode === "kanban"
                    ? "bg-primary text-primary-foreground shadow-[0_12px_26px_-16px_hsl(var(--primary)/0.9)]"
                    : "text-sidebar-foreground hover:bg-primary/5"
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                Kanban
              </button>
            </div>
            {viewMode === "kanban" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="w-9 h-9 rounded-xl border-primary/15 text-muted-foreground hover:bg-primary/5">
                    <SlidersHorizontal className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[280px] p-0">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold text-foreground">Campos do Card</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Escolha quais informações exibir</p>
                  </div>
                  <div className="p-3 space-y-1 max-h-[320px] overflow-y-auto">
                    {(Object.keys(CARD_FIELD_LABELS) as (keyof CardVisibleFields)[]).map((field) => (
                      <label
                        key={field}
                        className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={cardFields[field]}
                          onCheckedChange={() => toggleCardField(field)}
                        />
                        <span className="text-sm text-foreground">{CARD_FIELD_LABELS[field]}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {viewMode === "list" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="w-9 h-9 rounded-xl border-primary/15 text-muted-foreground hover:bg-primary/5">
                    <SlidersHorizontal className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="end">
                  <div className="space-y-3">
                    <div className="mb-2 flex items-center justify-between border-b pb-2">
                      <span className="text-sm font-bold text-foreground">Colunas</span>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setListColumns({ ...DEFAULT_LIST_COLUMNS })}>
                        Restaurar
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {Object.keys(DEFAULT_LIST_COLUMNS).map((col) => (
                        <div key={col} className="flex items-center gap-2">
                          <Checkbox
                            id={`col-${col}`}
                            checked={listColumns[col as keyof typeof listColumns]}
                            onCheckedChange={() => toggleListColumn(col as keyof typeof listColumns)}
                          />
                          <Label htmlFor={`col-${col}`} className="flex-1 cursor-pointer text-sm">
                            {LIST_COLUMN_LABELS[col] || col}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-10 gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_18px_34px_-20px_hsl(var(--primary)/0.9)] hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  Criar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  className="gap-2 font-medium"
                  onClick={() => {
                    setCreatePersonType("Fisica");
                    setShowCreate(true);
                  }}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  Criar Negociação PF
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 font-medium"
                  onClick={() => {
                    setCreatePersonType("Juridica");
                    setShowCreate(true);
                  }}
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Criar Negociação PJ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleExportDeals}
                    className="h-10 w-10 rounded-xl border-primary/15 bg-background/90 text-foreground shadow-sm hover:bg-primary/5"
                    disabled={sortedDeals.length === 0}
                    aria-label="Exportar Excel"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Exportar Excel</TooltipContent>
              </Tooltip>
            </TooltipProvider>
                </div>
              </div>
        </div>

        {/* VIEW: List or Kanban */}
        {viewMode === "list" ? (
          <div className="bg-card rounded-md border shadow-sm flex-1 overflow-hidden flex flex-col">
              {selectedDeals.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-amber-50/70 px-4 py-3">
                  <div className="mr-auto flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Checkbox checked disabled />
                    {selectedDeals.length} negócio{selectedDeals.length === 1 ? "" : "s"} selecionado{selectedDeals.length === 1 ? "" : "s"}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-9 rounded-lg">Reatribuir dono</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => void handleBulkAssignResponsible()}>Sem responsável</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {users.map((user) => (
                        <DropdownMenuItem key={user.id} onClick={() => void handleBulkAssignResponsible(user.id)}>
                          {user.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-9 rounded-lg">Alterar status</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => void handleBulkOutcomeChange(null)}>Em andamento</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleBulkOutcomeChange("won")}>Ganho</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleBulkOutcomeChange("lost")}>Perdido</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-9 rounded-lg">Alterar etapa</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {pipelineStages.map((stage) => (
                        <DropdownMenuItem key={stage.id} onClick={() => void handleBulkStageChange(stage.id as DealStage)}>
                          {stage.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" className="h-9 rounded-lg" onClick={clearDealSelection}>Limpar</Button>
                  {allowDeleteRecords && (
                    <Button variant="destructive" className="h-9 rounded-lg" onClick={() => setBulkDeleteOpen(true)}>Excluir em massa</Button>
                  )}
                </div>
              )}
              <div id="crm-pipeline-list-scroll" className="flex-1 overflow-auto">
                <div className="min-w-[980px] space-y-4 p-4">
                  {pipelineStages.length === 0 ? (
                    <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-center text-muted-foreground">
                      <Inbox className="mb-4 h-14 w-14 stroke-[1.2] text-muted-foreground/30" />
                      <span className="text-sm font-medium">Nenhuma etapa configurada neste pipeline.</span>
                    </div>
                  ) : visibleListGroups.length === 0 || (listGrouping === "none" && sortedDeals.length === 0) ? (
                    <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-center text-muted-foreground">
                      <Inbox className="mb-4 h-14 w-14 stroke-[1.2] text-muted-foreground/30" />
                      <span className="text-sm font-medium">Nenhuma negociação encontrada.</span>
                    </div>
                  ) : (
                    visibleListGroups.map((group) => {
                      const isCollapsed = collapsedListGroups[group.id] ?? false;
                      const renderedDeals = group.deals.slice(0, listRenderCounts[group.id] || INITIAL_LIST_GROUP_RENDER_COUNT);
                      const groupDealIds = group.deals.map((deal) => deal.id);
                      const selectedCount = groupDealIds.filter((dealId) => selectedDealIds.includes(dealId)).length;
                      const groupSelectionState =
                        selectedCount === 0
                          ? false
                          : selectedCount === groupDealIds.length
                            ? true
                            : "indeterminate";
                      const visibleColumns = Object.values(listColumns).filter(Boolean).length + 2;
                      const showGroupHeader = group.collapsible;
                      const groupAccentStyle = group.color
                        ? {
                            borderColor: hexToRgba(group.color, 0.18),
                            boxShadow: `0 18px 45px -36px ${hexToRgba(group.color, 0.35)}`,
                          }
                        : undefined;
                      const groupBadgeStyle = group.color
                        ? {
                            backgroundColor: hexToRgba(group.color, 0.12),
                            borderColor: hexToRgba(group.color, 0.22),
                            color: group.color,
                          }
                        : undefined;

                      return (
                        <section
                          key={group.id}
                          style={groupAccentStyle}
                          className="overflow-hidden rounded-[22px] border border-primary/10 bg-background shadow-[0_18px_45px_-36px_hsl(var(--primary)/0.45)]"
                        >
                          {showGroupHeader && (
                            <button
                              type="button"
                              onClick={() => toggleListGroup(group.id)}
                              className="flex w-full items-center justify-between gap-4 border-b border-border/70 bg-background/88 px-5 py-4 text-left backdrop-blur-sm transition-colors hover:bg-background"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/90 text-muted-foreground">
                                  <ChevronDown
                                    className={cn("h-4 w-4 transition-transform", isCollapsed && "-rotate-90")}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
                                      style={groupBadgeStyle}
                                    >
                                      {group.color ? (
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} />
                                      ) : null}
                                      {group.label}
                                    </span>
                                    {group.deals.length > 0 ? (
                                      <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                        {group.deals.length} {group.deals.length === 1 ? "negócio" : "negócios"}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              {group.deals.length > 0 ? (
                                <div className="shrink-0 text-right">
                                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                    Valor total
                                  </p>
                                  <p className="text-sm font-bold text-[#e11d48]">{formatCurrency(group.totalValue)}</p>
                                </div>
                              ) : null}
                            </button>
                          )}

                          {listGrouping === "none" && (
                            <div className="flex items-center justify-between gap-4 border-b border-border/70 bg-muted/10 px-5 py-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">Todas as negociações</p>
                                <p className="text-xs text-muted-foreground">
                                  Visualização contínua sem agrupamento.
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                  Total
                                </p>
                                <p className="text-sm font-bold text-[#e11d48]">{formatCurrency(group.totalValue)}</p>
                              </div>
                            </div>
                          )}

                          {(!showGroupHeader || !isCollapsed) && (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                  <TableRow className="border-b bg-background/95 hover:bg-background/95">
                                    <TableHead className="w-[52px] align-middle">
                                      <div onClick={(event) => event.stopPropagation()}>
                                        <Checkbox
                                          checked={groupSelectionState as boolean | "indeterminate"}
                                          onCheckedChange={(checked) => toggleMultipleDealsSelection(groupDealIds, checked === true)}
                                          aria-label={`Selecionar negociações do grupo ${group.label}`}
                                        />
                                      </div>
                                    </TableHead>
                                    {listColumns.dealCode && (
                                      <TableHead className="h-11 min-w-[110px] align-middle font-semibold text-muted-foreground">
                                        <button type="button" className="inline-flex items-center gap-1.5" onClick={() => toggleDealSort("dealCode")}>
                                          ID
                                          {sortIconFor("dealCode")}
                                        </button>
                                      </TableHead>
                                    )}
                                    {listColumns.dealName && (
                                      <TableHead className="h-11 min-w-[320px] align-middle font-semibold text-muted-foreground">
                                        <button type="button" className="inline-flex items-center gap-1.5" onClick={() => toggleDealSort("dealName")}>
                                          Negócio
                                          {sortIconFor("dealName")}
                                        </button>
                                      </TableHead>
                                    )}
                                    {listColumns.value && (
                                      <TableHead className="h-11 min-w-[140px] align-middle font-semibold text-muted-foreground">
                                        <button type="button" className="inline-flex items-center gap-1.5" onClick={() => toggleDealSort("value")}>
                                          Valor
                                          {sortIconFor("value")}
                                        </button>
                                      </TableHead>
                                    )}
                                    {listColumns.qualification && <TableHead className="h-11 min-w-[150px] align-middle font-semibold text-muted-foreground">Qualificação</TableHead>}
                                    {listColumns.stage && <TableHead className="h-11 min-w-[140px] align-middle font-semibold text-muted-foreground">Etapa</TableHead>}
                                    {listColumns.assignedTo && (
                                      <TableHead className="h-11 min-w-[180px] align-middle font-semibold text-muted-foreground">
                                        <button type="button" className="inline-flex items-center gap-1.5" onClick={() => toggleDealSort("assignedTo")}>
                                          Responsável
                                          {sortIconFor("assignedTo")}
                                        </button>
                                      </TableHead>
                                    )}
                                    {listColumns.closingDate && (
                                      <TableHead className="h-11 min-w-[160px] align-middle font-semibold text-muted-foreground">
                                        <button type="button" className="inline-flex items-center gap-1.5" onClick={() => toggleDealSort("closingDate")}>
                                          Previsão
                                          {sortIconFor("closingDate")}
                                        </button>
                                      </TableHead>
                                    )}
                                    {listColumns.createdAt && (
                                      <TableHead className="h-11 min-w-[170px] align-middle font-semibold text-muted-foreground">
                                        <button type="button" className="inline-flex items-center gap-1.5" onClick={() => toggleDealSort("createdAt")}>
                                          Criação
                                          {sortIconFor("createdAt")}
                                        </button>
                                      </TableHead>
                                    )}
                                    {listColumns.updatedAt && (
                                      <TableHead className="h-11 min-w-[170px] align-middle font-semibold text-muted-foreground">
                                        <button type="button" className="inline-flex items-center gap-1.5" onClick={() => toggleDealSort("updatedAt")}>
                                          Atualização
                                          {sortIconFor("updatedAt")}
                                        </button>
                                      </TableHead>
                                    )}
                                    <TableHead className="h-11 w-[80px] align-middle text-right font-semibold text-muted-foreground">Ações</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.deals.length === 0 ? (
                                    <TableRow className="hover:bg-transparent">
                                      <TableCell colSpan={visibleColumns} className="h-24 text-center text-sm text-muted-foreground">
                                        {listGrouping === "none" ? "Nenhuma negociação encontrada." : "Nenhum negócio neste grupo."}
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    renderedDeals.map((deal) => {
                                      const responsible = users.find((user) => user.id === deal.assignedTo);
                                      const secondaryLabel = getDealSecondaryLabel(deal);
                                      const rowStageColor = getDealStageColor(deal.stage, deal.dealName || deal.contactName);
                                      const { qualification, qualificationScore } = getDealQualification(deal);
                                      const attention = dealAttentionById[deal.id];
                                      const isSelected = selectedDealIds.includes(deal.id);

                                      return (
                                        <TableRow
                                          key={deal.id}
                                          className={cn(
                                            "cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/35 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-reduce:animate-none",
                                            attention?.hasOverdueClosingDate && "border-l-4 border-l-red-500 bg-red-50/40",
                                            isSelected && "bg-primary/5",
                                          )}
                                          onClick={() => openDealDetails(deal.id, "page")}
                                        >
                                          <TableCell className="py-4" onClick={(event) => event.stopPropagation()}>
                                            <Checkbox
                                              checked={isSelected}
                                              onCheckedChange={(checked) => toggleDealSelection(deal.id, checked === true)}
                                              aria-label={`Selecionar ${getDealDisplayName(deal)}`}
                                            />
                                          </TableCell>
                                          {listColumns.dealCode && (
                                            <TableCell className="py-4">
                                              {/* Igual ao card do Kanban: texto simples + copiar, sem selo (23/09/2026). */}
                                              <div data-testid="deal-list-code" className="flex items-center gap-0.5 whitespace-nowrap text-[11px] font-medium text-muted-foreground">
                                                <span className="tabular-nums">{deal.dealCode || "—"}</span>
                                                <CardCopyButton value={deal.dealCode} label="ID da negociação" />
                                              </div>
                                            </TableCell>
                                          )}
                                          {listColumns.dealName && (
                                            <TableCell className="py-4">
                                              <div className="space-y-1">
                                                <div className="flex items-start gap-2">
                                                  <span
                                                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                                                    style={{ backgroundColor: rowStageColor }}
                                                  />
                                                  <div className="min-w-0">
                                                    <DealListNameLine
                                                      name={getDealDisplayName(deal)}
                                                      hasStaleActivity={Boolean(attention?.hasStaleActivity)}
                                                      trailing={
                                                        <TaskAttentionBadge
                                                          size="list"
                                                          overdueCount={attention?.overdueTaskCount || 0}
                                                          todayCount={attention?.todayTaskCount || 0}
                                                          onOpen={() => setTasksDealId(deal.id)}
                                                        />
                                                      }
                                                    />
                                                    <div className="flex flex-wrap items-center gap-2">
                                                      <p className="text-xs text-muted-foreground">{secondaryLabel || "Sem contato complementar"}</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </TableCell>
                                          )}
                                          {listColumns.value && (
                                            <TableCell className="py-4 text-sm font-semibold text-[#e11d48]">
                                              {formatCurrency(deal.value || 0)}
                                            </TableCell>
                                          )}
                                          {listColumns.qualification && (
                                            <TableCell className="py-4" onClick={(event) => event.stopPropagation()}>
                                              <QualificationBadge qualification={qualification} score={qualificationScore} />
                                            </TableCell>
                                          )}
                                          {listColumns.stage && (
                                            <TableCell className="py-4" onClick={(event) => event.stopPropagation()}>
                                              <StatusBadge
                                                stage={deal.stage as DealStage}
                                                stages={pipelineStages}
                                                onSelect={(newStage) => moveDealToStage(deal, newStage)}
                                              />
                                            </TableCell>
                                          )}
                                          {listColumns.assignedTo && (
                                            <TableCell className="py-4">
                                              {responsible ? (
                                                <div className="flex items-center gap-2">
                                                  <UserAvatar name={responsible.name || "S"} avatar={responsible.avatar} size="sm" />
                                                  <span className="text-sm text-foreground">{responsible.name}</span>
                                                </div>
                                              ) : (
                                                <span className="text-sm text-muted-foreground">Sem responsável</span>
                                              )}
                                            </TableCell>
                                          )}
                                          {listColumns.closingDate && (
                                            <TableCell className={cn("py-4 text-xs text-muted-foreground", attention?.hasOverdueClosingDate && "font-semibold text-red-600")}>
                                              {formatClosingDate(deal.closingDate)}
                                            </TableCell>
                                          )}
                                          {listColumns.createdAt && (
                                            <TableCell className="py-4 text-xs text-muted-foreground">
                                              {formatDate(deal.createdAt)}
                                            </TableCell>
                                          )}
                                          {listColumns.updatedAt && (
                                            <TableCell className="py-4 text-xs text-muted-foreground">
                                              {formatDate(deal.updatedAt || deal.createdAt)}
                                            </TableCell>
                                          )}
                                          <TableCell className="py-4 text-right" onClick={(event) => event.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Incluir atividade"
                                                aria-label="Incluir atividade"
                                                className="h-9 w-9 rounded-lg text-primary hover:bg-primary/10"
                                                onClick={() => setActivityDealTarget(deal)}
                                              >
                                                <Plus className="h-4 w-4" />
                                              </Button>
                                              <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-9 w-9 rounded-lg p-0 hover:bg-muted">
                                                  <span className="sr-only">Abrir menu</span>
                                                  <MoreVertical className="h-4 w-4" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end" className="w-56">
                                                <DropdownMenuItem onClick={() => openDealDetails(deal.id, "page")}>
                                                  Abrir negociação
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openDealDetails(deal.id, "modal")}>
                                                  Abrir em modal
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuSub>
                                                  <DropdownMenuSubTrigger>Mover etapa</DropdownMenuSubTrigger>
                                                  <DropdownMenuSubContent className="w-52">
                                                    {pipelineStages.map((pipelineStage) => (
                                                      <DropdownMenuItem
                                                        key={pipelineStage.id}
                                                        onClick={() => moveDealToStage(deal, pipelineStage.id as DealStage)}
                                                      >
                                                        <span className="flex items-center gap-2">
                                                          {deal.stage === pipelineStage.id ? <Check className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-transparent" />}
                                                          {pipelineStage.label}
                                                        </span>
                                                      </DropdownMenuItem>
                                                    ))}
                                                  </DropdownMenuSubContent>
                                                </DropdownMenuSub>
                                                <DropdownMenuSub>
                                                  <DropdownMenuSubTrigger>Alterar responsável</DropdownMenuSubTrigger>
                                                  <DropdownMenuSubContent className="w-56">
                                                    <DropdownMenuItem onClick={() => void assignDealResponsible(deal)}>
                                                      Sem responsável
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {users.map((user) => (
                                                      <DropdownMenuItem
                                                        key={user.id}
                                                        onClick={() => void assignDealResponsible(deal, user.id)}
                                                      >
                                                        <span className="flex items-center gap-2">
                                                          {deal.assignedTo === user.id ? <Check className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-transparent" />}
                                                          {user.name}
                                                        </span>
                                                      </DropdownMenuItem>
                                                    ))}
                                                  </DropdownMenuSubContent>
                                                </DropdownMenuSub>
                                                {allowDeleteRecords && (
                                                  <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                      onClick={() => handleDeleteDeal(deal)}
                                                      className="cursor-pointer font-medium text-red-600 focus:bg-red-50 focus:text-red-700"
                                                    >
                                                      Excluir
                                                    </DropdownMenuItem>
                                                  </>
                                                )}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })
                                  )}
                                </TableBody>
                              </Table>
                              {renderedDeals.length < group.deals.length && (
                                <div className="border-t border-border/60 px-4 py-3">
                                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => loadMoreListGroupDeals(group.id)}>
                                    Mostrar mais {group.deals.length - renderedDeals.length} negócio{group.deals.length - renderedDeals.length === 1 ? "" : "s"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </section>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
        ) : (
          /* Kanban Board */
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div id="crm-pipeline-kanban-scroll" className="min-h-0 min-w-0 flex-1 overflow-auto pb-3">
              {kanbanGrouping === "stage" ? (
                <div className="inline-flex h-full min-w-max gap-5 pr-6">
                  {visiblePipelineStages.map((stage) => {
                    const stageDeals = sortedDeals.filter((deal) => deal.stage === stage.id);
                    return (
                      <PipelineColumn
                        key={stage.id}
                        id={stage.id}
                        label={stage.label}
                        stageColor={stage.color}
                        probability={stage.probability}
                        deals={stageDeals}
                        onDealClick={(deal) => openDealDetails(deal.id, "modal")}
                        onDealCreateActivity={(deal) => setActivityDealTarget(deal)}
                        visibleFields={cardFields}
                        dropHighlighted={dropStageHighlight === stage.id}
                        visibleCount={kanbanRenderCounts[stage.id] || INITIAL_KANBAN_RENDER_COUNT}
                        hasMore={stageDeals.length > (kanbanRenderCounts[stage.id] || INITIAL_KANBAN_RENDER_COUNT)}
                        onLoadMore={() => loadMoreKanbanDeals(stage.id)}
                        getDealHasOverdueClosingDate={(dealId) => dealAttentionById[dealId]?.hasOverdueClosingDate || false}
                        getDealHasStaleActivity={(dealId) => dealAttentionById[dealId]?.hasStaleActivity || false}
                        getDealTaskCounts={(dealId) => {
                          const attention = dealAttentionById[dealId];
                          return attention ? { overdue: attention.overdueTaskCount, today: attention.todayTaskCount } : undefined;
                        }}
                        onDealOpenTasks={(deal) => setTasksDealId(deal.id)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="min-w-max space-y-5 pr-6">
                  {responsibleLanes.map((lane) => (
                    <section
                      key={lane.id}
                      className="rounded-[24px] border border-primary/10 bg-card/70 p-4 shadow-[0_24px_60px_-42px_hsl(var(--primary)/0.4)] backdrop-blur-sm"
                    >
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={lane.label} avatar={lane.avatar} size="sm" />
                          <div>
                            <h3 className="text-sm font-bold text-foreground">{lane.label}</h3>
                            <p className="text-xs text-muted-foreground">
                              {lane.deals.length} {lane.deals.length === 1 ? "negociação" : "negociações"}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
                          {formatCurrency(lane.totalValue)}
                        </div>
                      </div>

                      <div className="inline-flex min-w-max gap-4">
                        {visiblePipelineStages.map((stage) => {
                          const columnKey = `${lane.id}::${stage.id}`;
                          const stageDeals = lane.deals.filter((deal) => deal.stage === stage.id);
                          return (
                            <PipelineColumn
                              key={`${lane.id}-${stage.id}`}
                              id={stage.id}
                              droppableId={columnKey}
                              label={stage.label}
                              stageColor={stage.color}
                              probability={stage.probability}
                              deals={stageDeals}
                              onDealClick={(deal) => openDealDetails(deal.id, "modal")}
                              onDealCreateActivity={(deal) => setActivityDealTarget(deal)}
                              visibleFields={cardFields}
                              dropHighlighted={dropStageHighlight === stage.id}
                              variant="swimlane"
                              visibleCount={kanbanRenderCounts[columnKey] || INITIAL_KANBAN_RENDER_COUNT}
                              hasMore={stageDeals.length > (kanbanRenderCounts[columnKey] || INITIAL_KANBAN_RENDER_COUNT)}
                              onLoadMore={() => loadMoreKanbanDeals(columnKey)}
                              getDealHasOverdueClosingDate={(dealId) => dealAttentionById[dealId]?.hasOverdueClosingDate || false}
                              getDealHasStaleActivity={(dealId) => dealAttentionById[dealId]?.hasStaleActivity || false}
                              getDealTaskCounts={(dealId) => {
                          const attention = dealAttentionById[dealId];
                          return attention ? { overdue: attention.overdueTaskCount, today: attention.todayTaskCount } : undefined;
                        }}
                        onDealOpenTasks={(deal) => setTasksDealId(deal.id)}
                            />
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            <DragOverlay dropAnimation={dropAnimation}>
              {activeDeal ? (
                <div className="opacity-90 rotate-2 scale-105">
                  <DealCard
                    deal={activeDeal}
                    onClick={() => {}}
                    visibleFields={cardFields}
                    hasOverdueClosingDate={dealAttentionById[activeDeal.id]?.hasOverdueClosingDate || false}
                    hasStaleActivity={dealAttentionById[activeDeal.id]?.hasStaleActivity || false}
                    overdueTaskCount={dealAttentionById[activeDeal.id]?.overdueTaskCount || 0}
                    todayTaskCount={dealAttentionById[activeDeal.id]?.todayTaskCount || 0}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
          </>
        )}

        {activeCRMTab === "Tarefas" && (
          <div className="flex flex-col h-full space-y-4">
             <div className="flex items-start justify-between">
               <div>
                 <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
                 <p className="text-sm text-muted-foreground mt-1">Visualize e gerencie todas as tarefas pendentes e concluídas.</p>
               </div>
             </div>
             {/* Modal, não página cheia: a lista fica montada atrás e o filtro sobrevive à ida e
                 à volta. O botão de expandir do modal leva à página cheia sem perder a origem. */}
             <GlobalTasksList onOpenDeal={(dealId) => openDealDetails(dealId, "modal")} filter={tasksViewFilter} currentUser={currentUser} currentUserRole={currentUserRole} />
          </div>
        )}
        {activeCRMTab === "Contatos" && (
          <div className="flex flex-col h-full space-y-4">
             <div className="flex items-start justify-between">
               <div>
                 <h1 className="text-2xl font-bold text-foreground">Contatos</h1>
                 <p className="text-sm text-muted-foreground mt-1">Visualize e gerencie todos os contatos vinculados às negociações.</p>
               </div>
             </div>
             <GlobalContactsList 
                onOpenDeal={(dealId) => openDealDetails(dealId, "page")} 
                onOpenContact={(id) => navigate(`/contacts/${id}`)} 
                currentUser={currentUser}
                currentUserRole={currentUserRole}
              />
          </div>
        )}
        
        {activeCRMTab === "Empresas" && (
          companyId ? (
            <CompanyView 
              companyId={companyId} 
              onBack={() => navigate("/companies")} 
              onOpenDeal={(id) => {
                navigate(`/pipeline/${id}`);
              }}
              onOpenCompany={(id) => navigate(`/companies/${id}`)}
              currentUser={currentUser}
              currentUserRole={currentUserRole}
            />
          ) : (
            <div className="flex flex-col h-full space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
                  <p className="text-sm text-muted-foreground mt-1">Visualize e gerencie todas as empresas vinculadas às negociações.</p>
                </div>
              </div>
              <GlobalCompaniesList onOpenCompany={(id) => navigate(`/companies/${id}`)} currentUser={currentUser} currentUserRole={currentUserRole} />
            </div>
          )
        )}
      </div>

      <Dialog open={!!selectedDeal && dealDetailMode === "modal"} onOpenChange={(open) => !open && closeDealDetails()}>
        <DialogContent className="h-[92dvh] w-[min(99vw,1650px)] max-w-[1650px] overflow-hidden rounded-2xl border-none p-0 shadow-2xl sm:h-[90dvh]">
          <DialogTitle className="sr-only">{selectedDeal?.dealName || selectedDeal?.contactName || "Detalhes do negócio"}</DialogTitle>

          <div className="flex h-14 items-center justify-between border-b border-border/70 bg-background/96 px-4 backdrop-blur">
            <div className="flex min-w-0 items-center gap-2">
              <LayoutPanelLeft className="h-4 w-4 text-primary" />
              <span className="truncate text-sm font-semibold text-foreground">
                {selectedDeal?.dealName || selectedDeal?.contactName || "Negócio"}
              </span>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={expandDealDetails}
              className="mr-10 h-9 w-9 rounded-lg border-border bg-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              aria-label="Expandir para tela cheia"
            >
              <Expand className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-[calc(100%-3.5rem)] min-h-0 min-w-0">
            {selectedDeal && (
              <DealView
                deal={selectedDeal}
                onBack={closeDealDetails}
                userEmail={userEmail}
                mode="modal"
                onOpenCompany={(companyId) => {
                  navigate(`/companies/${companyId}`);
                }}
                onOpenContact={(contactId) => {
                  navigate(`/contacts/${contactId}`, {
                    state: {
                      from: dealDetailPath(dealOrigin, selectedDeal.id, location.search),
                      fromLabel: "Negociação",
                      fromState: { dealMode: "modal" },
                    },
                  });
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CreateDealDialog 
        open={showCreate} 
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) clearState();
        }} 
        defaultPhone={defaultPhone}
        defaultName={defaultName}
        defaultContactId={defaultContactId}
        initialPersonType={createPersonType}
        lockPersonType={!defaultContactId}
        defaultPipelineId={selectedPipeline?.id}
      />
      <DealTasksQuickDialog
        dealId={tasksDealId}
        onClose={() => setTasksDealId(null)}
        userName={userName}
        currentUserId={currentUser?.id}
      />
      {activityDealTarget && (
        <CreateActivityDialog
          open
          onOpenChange={(open) => !open && setActivityDealTarget(null)}
          deal={activityDealTarget}
          users={users}
          defaultAssigneeId={currentUser?.id}
          userName={userName}
        />
      )}
      <AlertDialog open={!!dealPendingDelete} onOpenChange={(open) => !open && setDealPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir negociação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {dealPendingDelete ? `"${dealPendingDelete.dealCode ? `${dealPendingDelete.dealCode} - ` : ""}${getDealDisplayName(dealPendingDelete)}"` : "esta negociação"}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDeleteDeal()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir negociação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir negócios selecionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá {selectedDeals.length} negócio{selectedDeals.length === 1 ? "" : "s"} selecionado{selectedDeals.length === 1 ? "" : "s"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmBulkDelete()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir em massa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


