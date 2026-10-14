import React, { useState, useMemo, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Deal, useDealsStore, ALL_STAGES, type PipelineStage, QUALIFICATION_REQUIRED_STAGES } from "@/lib/dealsStore";
import { useCRMContactsStore } from "@/lib/crmContactsStore";
import { useOptionLabels } from "@/lib/optionListsStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCRMCompaniesStore } from "@/lib/crmCompaniesStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { useUsersStore } from "@/lib/usersStore";
import { useRolesStore } from "@/lib/rolesStore";
import { canDeleteRecords } from "@/lib/permissions";
import { usePipelineStagesStore } from "@/lib/pipelineStagesStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { usePipelineNavigationStore } from "@/lib/pipelineNavigationStore";
import { useCRMPipelinesStore } from "@/lib/crmPipelinesStore";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ArrowRightLeft, CheckSquare, History, MessageSquare, Calendar, User, Briefcase, Trophy, XCircle, X, RotateCcw, FileText, Plus, Pencil, Clock, Check, ChevronsUpDown, ExternalLink, ChevronDown, Copy, MoreVertical, Trash2, Phone, Mail, TrendingUp, Activity, Sparkles, Paperclip } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn, getDueDateTime, isPastLocalDate, isValidBrazilianPhone, maskPhone, maskCNPJ, parseLocalDateValue } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { InlineEditField } from "@/components/pipeline/InlineEditField";
import { getQualificationBadgeTone } from "@/lib/qualificationBadge";
import { ClosingDateInput } from "@/components/pipeline/ClosingDateInput";
import { formatClosingDate } from "@/lib/closingDateDraft";
import { ActivityTypeSelect } from "./ActivityTypeSelect";
import { CompleteTaskDialog } from "./CompleteTaskDialog";
import { EditTaskDialog } from "./EditTaskDialog";
import { TASK_DELAY_OPTIONS, getTaskDelayUpdates, type TaskDelayMode } from "@/lib/taskDelay";
import { getActivityTypeMeta, ACTIVITY_TIME_OPTIONS, createActivityDateISO, getTaskResponsibleName } from "@/lib/activityTypes";
import { UserAvatar } from "./UserAvatar";
import { CardCopyButton } from "./DealCard";
import { AssociateDealContactDialog } from "./AssociateDealContactDialog";
import { DealFilesTab } from "./DealFilesTab";
import { DealQualificationTab } from "./DealQualificationTab";
import { CustomerAnalysis } from "./CustomerAnalysis";
import { DealCommentsTab } from "./DealCommentsTab";
import { getQualificationNextActions } from "@/lib/leadQualification";
import { ConfettiBurst } from "@/components/ui/confetti-burst";
import { buildMentionableUsers } from "@/lib/commentMentions";

interface Props {
  deal: Deal;
  onBack: () => void;
  userEmail: string;
  onOpenCompany?: (companyId: string) => void;
  onOpenContact?: (contactId: string) => void;
  mode?: "page" | "modal";
}

const EMPTY_TRANSFER_STAGES: PipelineStage[] = [];

const EditableField = ({ label, value, onChange, type = "text", as = "input", options = [], disabled = false }: any) => {
  const formatCurrency = (val: any) => {
    if (val === undefined || val === null || val === "") return "";
    const num = typeof val === "string" ? parseFloat(val.replace(/\D/g, "")) / 100 : val;
    if (isNaN(num)) return "";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  const [localVal, setLocalVal] = useState(as === "currency" ? formatCurrency(value) : (value || ""));
  
  useEffect(() => {
    setLocalVal(as === "currency" ? formatCurrency(value) : (value || ""));
  }, [value, as]);

  const handleBlur = () => {
    if (disabled) return;
    if (as === "currency") {
       const numericValue = localVal ? parseFloat(localVal.replace(/\D/g, "")) / 100 : 0;
       if (numericValue !== (value || 0)) {
         onChange(numericValue);
       }
    } else {
       if (localVal !== (value || "")) {
         onChange(localVal);
       }
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground uppercase font-semibold pl-1">{label}</Label>
      {as === "input" || as === "currency" ? (
        <Input 
          type={as === "currency" ? "text" : type} 
          value={localVal} 
          disabled={disabled}
          onChange={e => {
            if (disabled) return;
            if (as === "currency") {
              const raw = e.target.value.replace(/\D/g, "");
              if (!raw) { setLocalVal(""); return; }
              const num = parseInt(raw, 10) / 100;
              setLocalVal(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num));
            } else {
              setLocalVal(e.target.value);
            }
          }} 
          onBlur={handleBlur} 
          className="h-8 text-sm shadow-none bg-transparent border-transparent hover:border-input focus-visible:border-input focus-visible:bg-background px-2 disabled:cursor-not-allowed disabled:opacity-100"
        />
      ) : as === "select" ? (
        <select 
          value={localVal} 
          disabled={disabled}
          onChange={e => {
            if (disabled) return;
            setLocalVal(e.target.value);
            onChange(e.target.value);
          }}
          className="flex h-8 w-full text-sm rounded-md border border-transparent bg-transparent px-2 shadow-none focus-visible:outline-none focus-visible:border-input hover:border-input disabled:cursor-not-allowed"
        >
          {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : null}
    </div>
  );
};

const DealStageStepper = ({
  currentStage,
  stages,
  onStageChange,
}: {
  currentStage: string;
  stages: Array<{ id: string; label: string }>;
  onStageChange: (s: string) => void;
}) => {
  return (
    <div className="flex w-full gap-1 mt-6">
      {stages.map((s, i) => {
        const isActive = currentStage === s.id;
        
        let clipPath = "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)";
        if (i === 0) {
          clipPath = "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)";
        } else if (i === stages.length - 1) {
          clipPath = "polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%)";
        }

        return (
          <button
            key={s.id}
            onClick={() => onStageChange(s.id)}
            style={{ clipPath }}
            className={`flex-1 h-9 flex items-center justify-center text-[12px] font-bold tracking-wide transition-colors ${
              isActive 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'bg-muted/80 text-muted-foreground hover:bg-muted-foreground/10'
            }`}
          >
            <span className={i === 0 ? "" : "ml-2"}>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export function DealView({ deal, onBack, userEmail, onOpenCompany, onOpenContact, mode = "page" }: Props) {
  const { deals, updateDeal, moveDeal, transferDealPipeline, addTask, editTask, toggleTask, cancelTask, setOutcome, removeDeal, addHistoryEvent } = useDealsStore();
  const { contacts, updateContact, addContact } = useCRMContactsStore();
  const { companies, updateCompany } = useCRMCompaniesStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { fetchStages, getStages } = usePipelineStagesStore();
  const relatedDeals = useMemo(() => {
    if (!deals) return [];
    return deals.filter(d => {
      // Respeitar o Workspace atual
      if (activeWorkspaceId && d.workspaceId !== activeWorkspaceId) return false;

      if (d.id === deal.id) return true;
      
      // Se a negociação possuir empresa vinculada, buscar negociações da mesma empresa
      if (deal.companyId) {
        return d.companyId === deal.companyId;
      }
      
      // Se a negociação possuir contato vinculado, buscar negociações do mesmo contato
      if (deal.contactId || (deal.contactIds && deal.contactIds.length > 0)) {
        const currentContactIds = deal.contactIds?.length ? deal.contactIds : (deal.contactId ? [deal.contactId] : []);
        const otherContactIds = d.contactIds?.length ? d.contactIds : (d.contactId ? [d.contactId] : []);
        return currentContactIds.some(id => otherContactIds.includes(id));
      }
      
      return false;
    }).sort((a, b) => {
      // Ordenar pela data mais recente
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [deals, deal, activeWorkspaceId]);

  const triggerOpenDeal = usePipelineNavigationStore(s => s.triggerOpenDeal);
  const [expandedDeals, setExpandedDeals] = useState<Record<string, boolean>>({});
  const [historyFilter, setHistoryFilter] = useState<"all" | "company" | "contact" | "won" | "lost" | "ongoing">("ongoing");

  const indicators = useMemo(() => {
    const allDeals = [deal, ...relatedDeals];
    const total = allDeals.length;
    const won = allDeals.filter(d => d.outcome === "won" || d.stage === "won");
    const lost = allDeals.filter(d => d.outcome === "lost" || d.stage === "lost");
    const ongoing = allDeals.filter(d => !d.outcome && d.stage !== "won" && d.stage !== "lost");
    
    const totalValue = allDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const totalWonValue = won.reduce((sum, d) => sum + (d.value || 0), 0);
    const ticketMedio = total > 0 ? totalValue / total : 0;
    const conversionRate = total > 0 ? (won.length / total) * 100 : 0;
    
    let firstDealDate: string | null = null;
    let lastDealDate: string | null = null;
    
    if (total > 0) {
      const dates = allDeals.map(d => new Date(d.createdAt).getTime());
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      firstDealDate = new Date(minDate).toISOString();
      lastDealDate = new Date(maxDate).toISOString();
    }
    
    const totalLostValue = lost.reduce((sum, d) => sum + (d.value || 0), 0);
    
    return {
      total,
      won: won.length,
      lost: lost.length,
      ongoing: ongoing.length,
      totalValue,
      totalWonValue,
      totalLostValue,
      ticketMedio,
      conversionRate,
      firstDealDate,
      lastDealDate
    };
  }, [deal, relatedDeals]);

  const analysisMetrics = useMemo(() => {
    const allDeals = [deal, ...relatedDeals];
    const total = allDeals.length;
    const wonDeals = allDeals.filter(d => d.outcome === "won" || d.stage === "won");
    const lostDeals = allDeals.filter(d => d.outcome === "lost" || d.stage === "lost");
    const ongoingDeals = allDeals.filter(d => !d.outcome && d.stage !== "won" && d.stage !== "lost");
    
    const wonCount = wonDeals.length;
    const lostCount = lostDeals.length;
    const ongoingCount = ongoingDeals.length;
    
    const totalValue = allDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const totalWonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const totalLostValue = lostDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    
    const conversionRate = total > 0 ? (wonCount / total) * 100 : 0;
    const ticketMedio = wonCount > 0 ? totalWonValue / wonCount : (total > 0 ? totalValue / total : 0);

    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;
    if (total > 0) {
      const dates = allDeals.map(d => new Date(d.createdAt));
      dates.sort((a, b) => a.getTime() - b.getTime());
      oldestDate = dates[0];
      newestDate = dates[dates.length - 1];
    }
    
    const relationshipDays = oldestDate 
      ? Math.max(0, Math.ceil((new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    let daysSinceLastWon: number | null = null;
    if (wonDeals.length > 0) {
      const wonDates = wonDeals.map(d => new Date(d.createdAt).getTime());
      const maxWonDate = Math.max(...wonDates);
      daysSinceLastWon = Math.max(0, Math.ceil((new Date().getTime() - maxWonDate) / (1000 * 60 * 60 * 24)));
    }

    let daysSinceLastDeal = 0;
    if (newestDate) {
      daysSinceLastDeal = Math.max(0, Math.ceil((new Date().getTime() - newestDate.getTime()) / (1000 * 60 * 60 * 24)));
    }

    let avgIntervalDays: number | null = null;
    if (total > 1) {
      const sortedDates = allDeals.map(d => new Date(d.createdAt).getTime()).sort((a, b) => a - b);
      let totalDiff = 0;
      for (let i = 1; i < sortedDates.length; i++) {
        totalDiff += sortedDates[i] - sortedDates[i - 1];
      }
      avgIntervalDays = Math.ceil(totalDiff / (total - 1) / (1000 * 60 * 60 * 24));
    }

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const evolutionMap: Record<string, { monthStr: string; sortKey: string; Total: number; Ganhas: number; Perdidas: number }> = {};
    
    allDeals.forEach(d => {
      const date = new Date(d.createdAt);
      const m = date.getMonth();
      const y = date.getFullYear();
      const monthStr = `${monthNames[m]}/${y}`;
      const sortKey = `${y}-${String(m).padStart(2, '0')}`;
      if (!evolutionMap[sortKey]) {
        evolutionMap[sortKey] = { monthStr, sortKey, Total: 0, Ganhas: 0, Perdidas: 0 };
      }
      evolutionMap[sortKey].Total += 1;
      if (d.outcome === "won" || d.stage === "won") {
        evolutionMap[sortKey].Ganhas += 1;
      } else if (d.outcome === "lost" || d.stage === "lost") {
        evolutionMap[sortKey].Perdidas += 1;
      }
    });

    const evolutionData = Object.values(evolutionMap)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-6);

    const lossReasonsMap: Record<string, number> = {};
    lostDeals.forEach(d => {
      const reason = d.lossReason || "Não Informado";
      lossReasonsMap[reason] = (lossReasonsMap[reason] || 0) + 1;
    });
    const lossReasonsData = Object.entries(lossReasonsMap).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);

    const pieData = [
      { name: "Ganhas", value: wonCount, color: "#10b981" },
      { name: "Perdidas", value: lostCount, color: "#ef4444" },
      { name: "Em andamento", value: ongoingCount, color: "#f59e0b" }
    ].filter(d => d.value > 0);

    const insights: string[] = [];
    if (total > 3) {
      insights.push("Alta Recorrência: Cliente possui histórico frequente de negociações no funil.");
    } else if (total > 1) {
      insights.push("Relacionamento em Maturação: Cliente possui mais de uma negociação no histórico comercial.");
    }

    if (conversionRate >= 60) {
      insights.push("Histórico Positivo de Conversão: A maior parte das negociações foi concluída com sucesso (taxa de conversão elevada).");
    } else if (conversionRate > 0 && conversionRate < 30) {
      insights.push("Atenção à Conversão: Taxa de conversão comercial está abaixo de 30%. Sugere-se revisar a abordagem.");
    }

    if (daysSinceLastWon !== null && avgIntervalDays !== null && daysSinceLastWon > avgIntervalDays * 1.5) {
      insights.push(`Cliente fora do Prazo de Recompra: Já se passaram ${daysSinceLastWon} dias desde a última compra ganha (acima do intervalo médio de recompra de ${avgIntervalDays} dias).`);
    }

    if (lossReasonsData.length > 0) {
      const mainReason = lossReasonsData[0];
      insights.push(`Obstáculo Comercial Comum: A maioria das negociações perdidas ocorreu por "${mainReason.name}" (${mainReason.value} ocorrências).`);
    }

    if (relationshipDays > 180) {
      insights.push("Parceria Estabelecida: Cliente possui relacionamento comercial ativo há mais de 6 meses.");
    }

    if (insights.length === 0) {
      insights.push("Histórico inicial. Conforme novas negociações forem criadas no funil, novos insights serão calculados automaticamente.");
    }

    return {
      total,
      wonCount,
      lostCount,
      ongoingCount,
      totalValue,
      totalWonValue,
      totalLostValue,
      conversionRate,
      ticketMedio,
      oldestDate,
      newestDate,
      relationshipDays,
      daysSinceLastWon,
      daysSinceLastDeal,
      avgIntervalDays,
      evolutionData,
      lossReasonsData,
      pieData,
      insights
    };
  }, [deal, relatedDeals]);

  const filteredHistoryDeals = useMemo(() => {
    return relatedDeals.filter(d => {
      if (historyFilter === "all") return true;
      if (historyFilter === "company") return d.companyId && d.companyId === deal.companyId;
      if (historyFilter === "contact") {
        const currentContactIds = deal.contactIds?.length ? deal.contactIds : (deal.contactId ? [deal.contactId] : []);
        const otherContactIds = d.contactIds?.length ? d.contactIds : (d.contactId ? [d.contactId] : []);
        return currentContactIds.some(id => otherContactIds.includes(id));
      }
      if (historyFilter === "won") return d.outcome === "won" || d.stage === "won";
      if (historyFilter === "lost") return d.outcome === "lost" || d.stage === "lost";
      if (historyFilter === "ongoing") return !d.outcome && d.stage !== "won" && d.stage !== "lost";
      return true;
    });
  }, [relatedDeals, historyFilter, deal]);

  const getLastInteraction = (d: Deal) => {
    const dates: { type: string; date: Date }[] = [];
    if (d.history && d.history.length > 0) {
      const latestEvent = d.history[d.history.length - 1];
      dates.push({ type: "Histórico", date: new Date(latestEvent.date) });
    }
    if (d.tasks && d.tasks.length > 0) {
      const latestTask = d.tasks[d.tasks.length - 1];
      dates.push({ type: "Tarefa", date: new Date(latestTask.createdAt) });
    }
    
    if (dates.length === 0) return "Sem interações";
    
    dates.sort((a, b) => b.date.getTime() - a.date.getTime());
    const latest = dates[0];
    
    const diffTime = Math.abs(new Date().getTime() - latest.date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let timeStr = "";
    if (diffDays <= 1) {
      timeStr = "hoje";
    } else if (diffDays === 2) {
      timeStr = "ontem";
    } else {
      timeStr = `há ${diffDays} dias`;
    }
    
    return `${latest.type} • ${timeStr}`;
  };

  // Resolve live data from CRM stores (source of truth)
  const liveContact = deal.contactId ? contacts.find(c => c.id === deal.contactId) : null;
  const liveCompany = deal.companyId ? companies.find(c => c.id === deal.companyId) : null;

  // Multi-contact: merge legacy contactId + contactIds array, deduplicate
  const allContactIds = useMemo(() => {
    const ids = new Set<string>();
    if (deal.contactIds?.length) {
      deal.contactIds.forEach(id => ids.add(id));
    } else if (deal.contactId) {
      ids.add(deal.contactId);
    }
    return Array.from(ids);
  }, [deal.contactId, deal.contactIds]);

  const liveContacts = useMemo(() => {
    return allContactIds
      .map(id => contacts.find(c => c.id === id))
      .filter(Boolean) as typeof contacts;
  }, [allContactIds, contacts]);

  const primaryContact = useMemo(
    () => liveContacts.find((contact) => contact.id === deal.primaryContactId) || liveContacts[0] || null,
    [deal.primaryContactId, liveContacts],
  );
  const [detailedAnalysisScope, setDetailedAnalysisScope] = useState<"company" | "contact">("company");
  const [selectedAnalysisContactId, setSelectedAnalysisContactId] = useState<string | undefined>(deal.primaryContactId);

  useEffect(() => {
    if (deal.personType !== "Juridica" || !primaryContact || deal.primaryContactId) return;
    void updateDeal(deal.id, { primaryContactId: primaryContact.id });
  }, [deal.id, deal.personType, deal.primaryContactId, primaryContact, updateDeal]);

  useEffect(() => {
    if (!selectedAnalysisContactId || !liveContacts.some((contact) => contact.id === selectedAnalysisContactId)) {
      setSelectedAnalysisContactId(primaryContact?.id);
    }
  }, [liveContacts, primaryContact?.id, selectedAnalysisContactId]);

  const selectedAnalysisContact = liveContacts.find((contact) => contact.id === selectedAnalysisContactId) || primaryContact;
  const companyAnalysisDeals = useMemo(
    () => deal.companyId ? deals.filter((item) => item.companyId === deal.companyId) : [deal],
    [deal, deals],
  );
  const contactAnalysisDeals = useMemo(() => {
    if (!selectedAnalysisContact) return [deal];
    return deals.filter((item) => {
      const ids = item.contactIds?.length ? item.contactIds : item.contactId ? [item.contactId] : [];
      return ids.includes(selectedAnalysisContact.id);
    });
  }, [deal, deals, selectedAnalysisContact]);

  // Per-contact expanded "Informações adicionais" state
  const [expandedInfo, setExpandedInfo] = useState<Record<string, boolean>>({});
  const toggleInfo = (id: string) => setExpandedInfo(prev => ({ ...prev, [id]: !prev[id] }));

  // Company picker state (for switching company)
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [showAssociateContact, setShowAssociateContact] = useState(false);
  const wsCompanies = companies.filter(c => c.workspaceId === activeWorkspaceId);
  const [activeTab, setActiveTab] = useState("tasks");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskType, setTaskType] = useState("Ligação");
  const [taskDate, setTaskDate] = useState("");
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [showLossDialog, setShowLossDialog] = useState(false);
  const [lossReason, setLossReason] = useState("");
  const [lossDescription, setLossDescription] = useState("");
  const [customReasons, setCustomReasons] = useState<string[]>([]);
  const [newCustomReason, setNewCustomReason] = useState("");
  const [showAddReason, setShowAddReason] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTransferPipelineDialog, setShowTransferPipelineDialog] = useState(false);
  const [transferPipelineId, setTransferPipelineId] = useState("");
  const [transferStageId, setTransferStageId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferringPipeline, setTransferringPipeline] = useState(false);
  const [contactToRemove, setContactToRemove] = useState<string | null>(null);
  const [openAssignedBox, setOpenAssignedBox] = useState(false);
  const [showTypeChangeDialog, setShowTypeChangeDialog] = useState<"Fisica" | "Juridica" | null>(null);
  const [tempCompanyId, setTempCompanyId] = useState<string | null>(null);
  const [tempContactIds, setTempContactIds] = useState<string[]>([]);
  const [isCreatingContactDialog, setIsCreatingContactDialog] = useState(false);
  const [searchContactDialog, setSearchContactDialog] = useState("");
  const [contactPhoneDialog, setContactPhoneDialog] = useState("");
  const [contactEmailDialog, setContactEmailDialog] = useState("");
  const [contactRoleDialog, setContactRoleDialog] = useState("");
  // uma lista só para os cartões (o valor atual varia por contato, e o campo o inclui sozinho)
  const roleOptions = useOptionLabels("contact_role");
  const dialogRoleOptions = useOptionLabels("contact_role", contactRoleDialog);
  const [internalContactSearch, setInternalContactSearch] = useState("");
  
  const [editingTask, setEditingTask] = useState<any>(null);
  const [activityToComplete, setActivityToComplete] = useState<any>(null);
  const [showWinConfetti, setShowWinConfetti] = useState(false);
  const [outcomeFeedback, setOutcomeFeedback] = useState<"won" | "lost" | null>(null);
  const [exitingTaskIds, setExitingTaskIds] = useState<string[]>([]);
  const [recentlyCompletedTaskIds, setRecentlyCompletedTaskIds] = useState<string[]>([]);

  const users = useUsersStore(s => s.users);
  const roles = useRolesStore((state) => state.roles);
  const getPipelineById = useCRMPipelinesStore((state) => state.getPipelineById);
  const currentUser = users.find(u => u.email === userEmail);
  const currentUserRole = roles.find((role) => role.id === currentUser?.roleId);
  const allowDeleteRecords = canDeleteRecords(currentUserRole);
  const userName = currentUser?.name || "Usuário";
  const mentionableUsers = useMemo(
    () =>
      buildMentionableUsers(
        users.filter((user) =>
          activeWorkspaceId
            ? user.workspaces.includes(activeWorkspaceId) || user.email === userEmail
            : user.email === userEmail,
        ),
      ),
    [activeWorkspaceId, userEmail, users],
  );
  const defaultActivityAssignee = deal.assignedTo || currentUser?.id || "";
  const getResponsibleName = (assignedTo?: string | string[]) => getTaskResponsibleName(users, assignedTo);
  const getActivityStatus = (task: any) => task.status || (task.completed ? "completed" : "pending");
  const isModal = mode === "modal";
  const currentPipeline = getPipelineById(deal.pipelineId);
  const qualificationLabel = primaryContact?.qualificationClassification || deal.qualificationClassification || liveContact?.qualificationClassification || deal.qualification;
  const qualificationScore = primaryContact?.qualificationScore ?? deal.qualificationScore ?? liveContact?.qualificationScore;
  const pipelineStages = getStages(deal.pipelineId, currentPipeline?.name);
  const stageCatalog = [...pipelineStages, ...ALL_STAGES.filter((stage) => stage.id === "won" || stage.id === "lost")];
  const workspacePipelines = useCRMPipelinesStore((state) => state.getPipelines(activeWorkspaceId));
  const availableTransferPipelines = workspacePipelines.filter((pipeline) => pipeline.isActive && pipeline.id !== deal.pipelineId);
  const selectedTransferPipeline = availableTransferPipelines.find((pipeline) => pipeline.id === transferPipelineId) || null;
  const transferPipelineStages = transferPipelineId ? getStages(transferPipelineId, selectedTransferPipeline?.name) : EMPTY_TRANSFER_STAGES;

  useEffect(() => {
    if (activeWorkspaceId && deal.pipelineId) {
      void fetchStages(deal.pipelineId, activeWorkspaceId, currentPipeline?.name);
    }
  }, [activeWorkspaceId, currentPipeline?.name, deal.pipelineId, fetchStages]);

  useEffect(() => {
    if (showTransferPipelineDialog && activeWorkspaceId && transferPipelineId && selectedTransferPipeline) {
      void fetchStages(transferPipelineId, activeWorkspaceId, selectedTransferPipeline.name);
    }
  }, [activeWorkspaceId, fetchStages, selectedTransferPipeline, showTransferPipelineDialog, transferPipelineId]);

  useEffect(() => {
    if (!showTransferPipelineDialog) return;

    if (!transferPipelineId && availableTransferPipelines[0]?.id) {
      setTransferPipelineId(availableTransferPipelines[0].id);
      return;
    }

    if (!transferPipelineStages.length) {
      setTransferStageId("");
      return;
    }

    if (!transferPipelineStages.some((stage) => stage.id === transferStageId)) {
      setTransferStageId(transferPipelineStages[0].id);
    }
  }, [availableTransferPipelines, showTransferPipelineDialog, transferPipelineId, transferPipelineStages, transferStageId]);

  const timeOptions = ACTIVITY_TIME_OPTIONS;
  const createDateISO = createActivityDateISO;

  const handleDelayTask = (task: any, mode: TaskDelayMode, label: string) => {
    void editTask(deal.id, task.id, getTaskDelayUpdates(task, mode), userName).then(() => {
      toast.success(`Atividade adiada para ${label.toLowerCase()}.`);
    });
  };

  const DEFAULT_LOSS_REASONS = [
    "Preço elevado",
    "Concorrente escolhido",
    "Sem orçamento",
    "Sem resposta do cliente",
    "Timing inadequado",
    "Produto não atende",
  ];

  const allReasons = [...DEFAULT_LOSS_REASONS, ...customReasons];

  useEffect(() => {
    if (!showWinConfetti) return undefined;
    const timeout = window.setTimeout(() => setShowWinConfetti(false), 900);
    return () => window.clearTimeout(timeout);
  }, [showWinConfetti]);

  useEffect(() => {
    if (!outcomeFeedback) return undefined;
    const timeout = window.setTimeout(() => setOutcomeFeedback(null), 700);
    return () => window.clearTimeout(timeout);
  }, [outcomeFeedback]);

  const handleMarkWon = async () => {
    await setOutcome(deal.id, "won", undefined, undefined, userName);
    setOutcomeFeedback("won");
    setShowWinConfetti(true);
    toast.success("Negociação marcada como Ganha!");
  };

  const handleConfirmLoss = async () => {
    if (!lossReason.trim()) {
      toast.error("Selecione ou adicione um motivo da perda.");
      return;
    }
    await setOutcome(deal.id, "lost", lossReason, lossDescription.trim() || undefined, userName);
    setOutcomeFeedback("lost");
    toast.success("Negociação marcada como Perdida");
    setShowLossDialog(false);
    setLossReason("");
    setLossDescription("");
  };

  const handleToggleTaskState = (task: any) => {
    const status = getActivityStatus(task);
    if (status === "completed") {
      void toggleTask(deal.id, task.id, userName).then(() => toast.success("Tarefa reaberta"));
      return;
    }

    if (status === "cancelled") {
      void editTask(deal.id, task.id, { status: "pending", canceledAt: undefined, canceledBy: undefined }, userName).then(() => toast.success("Atividade reaberta"));
      return;
    }

    setActivityToComplete(task);
  };

  const handleCreateTask = () => {
    if (!taskTitle.trim()) {
      toast.error("O assunto da tarefa não pode estar vazio.");
      return;
    }
    if (!newTaskAssignedTo) {
      toast.error("Selecione pelo menos um responsável.");
      return;
    }
    addTask(deal.id, {
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      dueDate: createDateISO(taskDate, newTaskTime),
      dueTime: newTaskTime || undefined,
      assignedTo: newTaskAssignedTo,
      taskType,
      companyId: deal.companyId,
      status: "pending",
    }, userName);
    setTaskTitle("");
    setTaskDesc("");
    setTaskType("Ligação");
    setTaskDate("");
    setNewTaskTime("");
    setNewTaskAssignedTo(defaultActivityAssignee);
    setShowCreateTaskDialog(false);
    toast.success("Atividade adicionada!");
  };

  const openEditTask = (task: any) => {
    setEditingTask(task);
  };

  const handleUpdate = (field: keyof Deal, val: any) => {
    if (field === "stage" && QUALIFICATION_REQUIRED_STAGES.has(String(val)) && !deal.qualificationCompletedAt) {
      toast.error(
        "Esta negociação ainda não possui uma qualificação concluída. Preencha a aba Qualificação para continuar o processo comercial.",
        {
          action: {
            label: "Abrir Qualificação",
            onClick: () => setActiveTab("qualification"),
          },
        },
      );
      setActiveTab("qualification");
      return;
    }

    if (field === "stage") {
      const stageLabel = stageCatalog.find((s) => s.id === val)?.label || val;
      moveDeal(deal.id, val, userName, stageLabel);
      toast.success(`Alteração salva automaticamente.`);
      return;
    }

    if (field === "closingDate" && val && isPastLocalDate(String(val))) {
      toast.error("A previsão de fechamento não pode ser uma data passada.");
      return;
    }

    updateDeal(deal.id, { [field]: val === "" && typeof deal[field] === "number" ? 0 : val });
    
    let actionText = "";
    if (field === 'dealName') {
       actionText = `alterou o nome da negociação para "${val}"`;
    } else if (field === 'value') {
       const numVal = typeof val === 'string' ? parseFloat(val) : val;
       actionText = `alterou o valor da negociação para ${formatCurrency(numVal || 0)}`;
    } else if (field === 'contactName') {
       actionText = `alterou o nome do contato para "${val}"`;
    } else if (field === 'phone') {
       actionText = `alterou o telefone para "${val}"`;
    } else if (field === 'personType') {
       actionText = `alterou o tipo de cliente para ${val === 'Fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'}`;
    } else if (field === 'closingDate') {
       actionText = `alterou a previsão de fechamento para ${val}`;
    } else if (field === 'assignedTo') {
        const assignedUser = users.find((user) => user.id === val);
        actionText = `alterou o responsável para ${assignedUser?.name || val || "Ninguém"}`;
    } else if (field === 'pipelineId') {
       const pipeline = getPipelineById(val);
       actionText = `alterou o pipeline da negociação para ${pipeline?.name || "Pipeline selecionado"}`;
    }
    
    if (actionText) {
      useDealsStore.getState().addHistoryEvent(deal.id, actionText, userName);
    }

    toast.success(`Alteração salva automaticamente.`);
  };

  const openTransferPipelineDialog = () => {
    const firstPipeline = availableTransferPipelines[0] || null;
    setTransferPipelineId(firstPipeline?.id || "");
    setTransferStageId("");
    setTransferReason("");
    setShowTransferPipelineDialog(true);
  };

  const handleTransferPipeline = async () => {
    if (!selectedTransferPipeline) {
      toast.error("Selecione um pipeline de destino.");
      return;
    }

    const destinationStage = transferPipelineStages.find((stage) => stage.id === transferStageId);
    if (!destinationStage) {
      toast.error("Selecione uma etapa de destino.");
      return;
    }

    if (QUALIFICATION_REQUIRED_STAGES.has(destinationStage.id) && !deal.qualificationCompletedAt) {
      toast.error("Esta negociação ainda não possui uma qualificação concluída. Preencha a aba Qualificação para continuar o processo comercial.");
      setActiveTab("qualification");
      return;
    }

    setTransferringPipeline(true);

    try {
      await transferDealPipeline({
        dealId: deal.id,
        destinationPipelineId: selectedTransferPipeline.id,
        destinationStage: destinationStage.id,
        fromPipelineName: currentPipeline?.name || "Pipeline atual",
        toPipelineName: selectedTransferPipeline.name,
        fromStageLabel: stageCatalog.find((stage) => stage.id === deal.stage)?.label || deal.stage,
        toStageLabel: destinationStage.label,
        reason: transferReason,
        userName,
      });

      setShowTransferPipelineDialog(false);
      setTransferPipelineId("");
      setTransferStageId("");
      setTransferReason("");
      toast.success("Negociação transferida com sucesso.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao transferir negociação entre pipelines.");
    } finally {
      setTransferringPipeline(false);
    }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const pendingTasksCount = deal.tasks?.filter((task) => getActivityStatus(task) === "pending").length || 0;
  const compactTabs = isModal;
  const detailTabs = [
    { value: "customer_analysis", label: deal.personType === "Juridica" ? "Análise Detalhada" : "Análise do Cliente", icon: TrendingUp },
    { value: "history", label: "Histórico", icon: History },
    { value: "comments", label: "Comentários", icon: MessageSquare },
    { value: "tasks", label: "Atividades", icon: CheckSquare, count: pendingTasksCount },
    { value: "files", label: "Anexos", icon: Paperclip },
    { value: "qualification", label: "Qualificação", icon: Sparkles },
    { value: "commercial_history", label: "Outras Negociações", icon: Briefcase },
  ];

  const renderTabTrigger = (tab: (typeof detailTabs)[number]) => {
    const Icon = tab.icon;
    return (
      <TabsTrigger
        key={tab.value}
        value={tab.value}
        className={cn(
          "shrink-0 rounded-none py-3 flex items-center gap-2 whitespace-nowrap",
          compactTabs ? "h-10 px-2 text-xs" : "h-10 px-3 text-[13px]",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{tab.label}</span>
        {tab.count ? (
          <span className="bg-primary text-primary-foreground text-[10px] rounded-full px-2 py-0.5">
            {tab.count}
          </span>
        ) : null}
      </TabsTrigger>
    );
  };

  return (
    <>
      {showWinConfetti ? <ConfettiBurst /> : null}
      <div className={cn(
        "relative flex h-full min-h-0 w-full min-w-0 items-stretch bg-background fade-in-0 animate-in duration-300 motion-reduce:animate-none",
        isModal ? "h-full overflow-hidden" : "h-full overflow-y-auto",
      )}>
      
      {/* LEFT SIDEBAR (Contatos/Empresa) */}
      <div className={cn(
        "flex flex-col shrink-0 border-r border-border bg-muted/10 shadow-sm z-10",
        isModal ? "min-h-0 w-[280px] xl:w-[320px]" : "min-h-full w-[320px] lg:w-[380px]",
      )}>
        
        <div className="p-4 border-b border-border sticky top-0 bg-muted/10 backdrop-blur-md z-20 flex items-center justify-between">
          {isModal ? (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Detalhes do negócio</span>
              <span className="text-xs text-muted-foreground">Visualização rápida no Kanban</span>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground gap-2 -ml-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
          )}
          <span className="text-xs text-muted-foreground">Salvamento automático ativo</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Accordion type="multiple" defaultValue={["negociacao", "contatos", "empresa"]} className="flex w-full flex-col">
            <AccordionItem value="negociacao" className="border-b border-border/50">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 text-sm font-bold">
                <div className="flex items-center gap-2">
                  Negociação
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-2 space-y-4">
                <div className="space-y-3">
                  {/* Código da negociação: texto simples com o copiar do card, sem selo (pedido do
                      operador em 23/09/2026, mesmo padrão do Kanban e da lista). Só leitura: o banco gera. */}
                  {deal.dealCode && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground uppercase font-semibold pl-1">ID</Label>
                      <div data-testid="deal-detail-code" className="flex items-center gap-0.5 pl-1 text-sm text-foreground">
                        <span className="tabular-nums">{deal.dealCode}</span>
                        <CardCopyButton value={deal.dealCode} label="ID da negociação" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground uppercase font-semibold pl-1">Nome</Label>
                    <div className="flex items-center gap-1 group">
                      <InlineEditField 
                        value={deal.dealName || ""} 
                        onSave={(v: string) => handleUpdate('dealName', v)}
                        className="flex-1"
                      />
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(deal.dealName || "");
                          toast.success("Nome copiado!");
                        }}
                        className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground uppercase font-semibold pl-1">Tipo de Cliente</Label>
                    <select 
                      value={deal.personType || "Fisica"} 
                      onChange={e => {
                        const newVal = e.target.value as "Fisica" | "Juridica";
                        const oldVal = deal.personType || "Fisica";
                        if (newVal === oldVal) return;
                        setShowTypeChangeDialog(newVal);
                      }}
                      className="flex h-8 w-full text-sm rounded-md border border-transparent bg-transparent px-1 shadow-none focus-visible:outline-none focus-visible:border-input hover:border-input font-medium"
                    >
                      <option value="Fisica">Pessoa Física</option>
                      <option value="Juridica">Pessoa Jurídica</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground uppercase font-semibold pl-1">Criada em</Label>
                    <div className="flex items-center justify-between group">
                      <p className="text-sm font-medium text-foreground px-1">
                        {deal.createdAt ? format(new Date(deal.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                      </p>
                      <button 
                        onClick={() => {
                          const dateStr = deal.createdAt ? format(new Date(deal.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "";
                          navigator.clipboard.writeText(dateStr);
                          toast.success("Data copiada!");
                        }}
                        className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <EditableField 
                    label="Valor total" 
                    as="currency"
                    value={deal.value} 
                    onChange={(v: number) => handleUpdate('value', v)}
                  />
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground uppercase font-semibold pl-1">Previsão de fechamento</Label>
                    <ClosingDateInput
                      aria-label="Previsão de fechamento"
                      value={deal.closingDate || ""}
                      onCommit={(nextDate) => handleUpdate('closingDate', nextDate)}
                      className="h-8 text-sm shadow-none bg-transparent border-transparent hover:border-input focus-visible:border-input focus-visible:bg-background px-2"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

{/* CONTATOS SECTION */}
            <AccordionItem value="contatos" className="order-3 border-b border-border/50">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 text-sm font-bold">
                Contatos
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                {liveContacts.length > 0 ? (
                  <div className="space-y-6">
                    {liveContacts.map((contact, idx) => (
                      <div key={contact.id} className={cn("space-y-3", idx > 0 && "pt-6 border-t border-border/30")}>
                        <div className="flex items-center justify-between gap-2 bg-muted/40 p-2 rounded-md group/name">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-sm font-bold text-foreground">{contact.name}</span>
                            {contact.id === primaryContact?.id && (
                              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">Principal</span>
                            )}
                            <User className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/name:opacity-100 transition-opacity"
                            onClick={() => setContactToRemove(contact.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="space-y-3 px-1">
                          <div className="flex items-center gap-3 text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                            <InlineEditField
                              value={contact.phone || ""}
                              maskType="phone"
                              showCopy
                              placeholder="Telefone"
                              emptyLabel="Sem telefone"
                              onSave={(v) => {
                                if (v?.trim() && !isValidBrazilianPhone(v)) {
                                  toast.error("Informe um telefone válido com DDD. Exemplo: (11) 99999-9999.");
                                  return;
                                }
                                updateContact(contact.id, { phone: v || undefined });
                              }}
                              className="font-medium text-foreground flex-1"
                            />
                          </div>
                          
                          <div className="flex items-center gap-3 text-sm">
                            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                            <InlineEditField
                              value={contact.email || ""}
                              showCopy
                              placeholder="E-mail"
                              emptyLabel="Sem e-mail"
                              onSave={(v) => updateContact(contact.id, { email: v || undefined })}
                              className="font-medium text-[#00adc7] flex-1"
                            />
                          </div>
                        </div>

                        {/* Informações adicionais sub-accordion */}
                        <div className="border-t border-border/30 pt-2">
                          <button 
                            onClick={() => toggleInfo(contact.id)}
                            className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground hover:text-foreground py-1"
                          >
                            Informações adicionais
                            <ChevronDown className={cn("w-3 h-3 transition-transform", expandedInfo[contact.id] && "rotate-180")} />
                          </button>
                          {expandedInfo[contact.id] && (
                            <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                              {contact.personType !== "Fisica" && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold w-16">Cargo</span>
                                  <div className="flex-1">
                                    <InlineEditField
                                      value={contact.role || ""}
                                      placeholder="Selecione o cargo"
                                      options={roleOptions}
                                      onSave={(v) => updateContact(contact.id, { role: v || undefined })}
                                      className="text-xs"
                                    />
                                  </div>
                                </div>
                              )}
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold w-16 pt-1">Qualificação</span>
                                <div className="flex-1 text-xs">
                                  <p className="font-semibold text-foreground">
                                    {contact.qualificationClassification || "Sem qualificação"}
                                  </p>
                                  {typeof contact.qualificationScore === "number" && (
                                    <p className="text-muted-foreground">{contact.qualificationScore}/20 pontos</p>
                                  )}
                                  {contact.qualificationCompletedAt && (
                                    <p className="text-muted-foreground">
                                      {format(new Date(contact.qualificationCompletedAt), "dd/MM/yyyy", { locale: ptBR })}
                                      {contact.qualificationResponsible ? ` • ${contact.qualificationResponsible}` : ""}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {onOpenContact && (
                          <button
                            onClick={() => onOpenContact(contact.id)}
                            className="flex items-center gap-1.5 text-[#00adc7] text-sm font-medium hover:underline"
                          >
                            Abrir detalhes do contato
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-2 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Não há contatos na negociação, clique no botão abaixo para criar ou associar um contato
                    </p>
                  </div>
                )}
                
                <button
                  onClick={() => setShowAssociateContact(true)}
                  className="flex items-center gap-1.5 text-primary text-sm font-semibold hover:underline mt-4"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar contato
                </button>
              </AccordionContent>
            </AccordionItem>

            {/* EMPRESA SECTION */}
            {deal.personType === "Juridica" && (
              <AccordionItem value="empresa" className="order-2 border-b border-border/50">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 text-sm font-bold">
                  Empresa
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 space-y-4">
                  {liveCompany ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Nome</span>
                          <p className="text-sm font-bold text-foreground">{liveCompany.name}</p>
                        </div>
                        <Popover open={companyPickerOpen} onOpenChange={setCompanyPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[260px] p-0" align="end">
                            <Command>
                              <CommandInput placeholder="Buscar empresa..." value={companySearch} onValueChange={setCompanySearch} />
                              <CommandList>
                                <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">Nenhuma empresa encontrada.</CommandEmpty>
                                <CommandGroup>
                                  {wsCompanies.filter(c => c.id !== liveCompany.id).map(comp => (
                                    <CommandItem
                                      key={comp.id}
                                      value={comp.name}
                                      onSelect={() => {
                                        updateDeal(deal.id, { companyId: comp.id, companyName: comp.name, cnpj: comp.cnpj });
                                        setCompanyPickerOpen(false);
                                        setCompanySearch("");
                                        toast.success(`Empresa alterada para ${comp.name}`);
                                      }}
                                    >
                                      {comp.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {onOpenCompany && (
                        <button
                          onClick={() => onOpenCompany(liveCompany.id)}
                          className="flex items-center gap-1.5 text-[#00adc7] text-sm font-medium hover:underline"
                        >
                          Abrir página da Empresa
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <EditableField label="Razão Social" value={deal.companyName} onChange={(v: string) => handleUpdate('companyName', v)} />
                      {/*
                        CNPJ é somente-leitura: `crm_deals` não tem essa coluna, então o que se
                        digitava aqui sumia no próximo carregamento, sem erro (medido em 10/09).
                        O documento vive na empresa — para preenchê-lo, vincule uma.
                      */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">CNPJ</span>
                        <p className="text-sm text-muted-foreground">
                          Vincule uma empresa para registrar o CNPJ.
                        </p>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* RESPONSÁVEL SECTION */}
            <AccordionItem value="responsavel" className="order-4 border-b-0">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 text-sm font-bold">
                Responsável
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-2 space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Responsável</span>
                  <Popover open={openAssignedBox} onOpenChange={setOpenAssignedBox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openAssignedBox}
                        className="w-full justify-between h-9 px-3 text-sm font-normal border-input bg-background hover:bg-muted/50 transition-colors"
                      >
                        {deal.assignedTo ? (() => {
                          const assignedUser = users.find(u => u.id === deal.assignedTo);
                          return (
                            <div className="flex items-center gap-2">
                              <UserAvatar 
                                name={assignedUser?.name || "S"} 
                                avatar={assignedUser?.avatar} 
                              />
                              {assignedUser?.name || "Responsável"}
                            </div>
                          );
                        })() : (
                          "Selecione um responsável..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar usuário..." />
                        <CommandList>
                          <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="sem_responsavel"
                              onSelect={() => {
                                handleUpdate('assignedTo', "");
                                setOpenAssignedBox(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  !deal.assignedTo ? "opacity-100" : "opacity-0"
                                )}
                              />
                              Sem responsável
                            </CommandItem>
                            {users
                              .filter(u => u.workspaces.includes(activeWorkspaceId || "default"))
                              .map((user) => (
                                <CommandItem
                                  key={user.id}
                                  value={user.name}
                                  onSelect={(currentValue) => {
                                    handleUpdate('assignedTo', user.id);
                                    setOpenAssignedBox(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      deal.assignedTo === user.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex items-center gap-2">
                                    <UserAvatar name={user.name} avatar={user.avatar} />
                                    {user.name}
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Associate Contact to Deal Dialog */}
      <AssociateDealContactDialog
        open={showAssociateContact}
        onOpenChange={setShowAssociateContact}
        dealId={deal.id}
        currentContactIds={allContactIds}
        primaryContactId={deal.primaryContactId || primaryContact?.id}
        companyId={deal.companyId}
        personType={deal.personType}
      />

      {/* RIGHT MAIN AREA */}
      <div className="flex-1 flex min-h-0 flex-col min-w-0 bg-background relative overflow-hidden">
        <div className={cn("border-b border-border shrink-0 bg-card", isModal ? "px-5 py-5" : "px-8 py-6")}>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <button type="button" onClick={onBack} className="transition-colors hover:text-primary">
              Negociações
            </button>
            <span>/</span>
            <span className="truncate text-foreground">{deal.dealName || deal.contactName || "Negociação"}</span>
          </div>
          <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-3">
            <h1 className="flex min-w-0 flex-wrap items-center gap-3 text-2xl font-bold">
              <span className="truncate">{deal.dealName || deal.contactName || "Nova Negociação"}</span>
               <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary uppercase font-semibold">
                 {stageCatalog.find(s => s.id === deal.stage)?.label || deal.stage}
               </span>
               {qualificationLabel && (
                 <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", getQualificationBadgeTone(qualificationLabel))}>
                   <Sparkles className="h-3.5 w-3.5" />
                   <span>{qualificationLabel}</span>
                   {typeof qualificationScore === "number" && <span className="opacity-80">{qualificationScore}/20</span>}
                 </span>
               )}
               {deal.outcome === "won" && (
                 <span className={cn("text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500 uppercase font-semibold flex items-center gap-1", outcomeFeedback === "won" && "animate-badge-celebrate")}>
                   <Trophy className="w-3 h-3" /> Ganho
                 </span>
               )}
               {deal.outcome === "lost" && (
                 <span className={cn("text-xs px-2.5 py-1 rounded-full bg-red-500/15 text-red-500 uppercase font-semibold flex items-center gap-1", outcomeFeedback === "lost" && "animate-badge-celebrate")}>
                   <XCircle className="w-3 h-3" /> Perdido
                 </span>
               )}
            </h1>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {deal.outcome === null ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400 h-9"
                    onClick={() => void handleMarkWon()}
                  >
                    <Trophy className="w-4 h-4" />
                    Marcar Venda
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-400 h-9"
                    onClick={() => { setLossReason(""); setLossDescription(""); setShowLossDialog(true); }}
                  >
                    <XCircle className="w-4 h-4" />
                    Marcar Perda
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs text-muted-foreground hover:text-foreground h-9"
                  onClick={() => { setOutcome(deal.id, null, undefined, undefined, userName); toast.success("Negociação reaberta"); }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reabrir Negociação
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={openTransferPipelineDialog}
                    disabled={availableTransferPipelines.length === 0}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Mover para outro Pipeline
                  </DropdownMenuItem>
                  {allowDeleteRecords && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive cursor-pointer gap-2"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir Negociação
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
             Criado em {format(new Date(deal.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </p>
          <div className="overflow-x-auto overflow-y-hidden no-scrollbar">
            <div className="min-w-[760px]">
              <DealStageStepper 
                currentStage={deal.stage} 
                stages={pipelineStages}
                onStageChange={(s) => handleUpdate('stage', s)} 
              />
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col w-full bg-background pt-4 min-h-0 overflow-hidden">
          <div className="shrink-0 border-b border-border px-4 sm:px-8">
            <div className="overflow-x-auto overflow-y-hidden pb-1">
              <TabsList
                className={cn(
                  "flex h-auto min-w-max flex-nowrap items-center justify-start gap-x-1 rounded-none border-0 bg-transparent p-0 shadow-none",
                )}
              >
                {detailTabs.map(renderTabTrigger)}
              </TabsList>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-8 pt-6">
            
            <TabsContent value="history" className="m-0 h-full px-4 focus-visible:outline-none sm:px-6 xl:px-8">
              <div className="flex flex-col h-full max-w-4xl shrink-0">
                {(!deal.history || deal.history.length === 0) ? (
                   <div className="text-center text-muted-foreground py-12">
                     O histórico está vazio.
                   </div>
                ) : (
                  <div className="relative border-l-2 border-muted ml-4 flex-1 pb-12 space-y-8 mt-4">
                    {[...deal.history].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((event, i) => (
                      <div key={event.id || i} className="pl-8 relative">
                        <span className="absolute w-3.5 h-3.5 bg-primary rounded-full left-[-8.5px] top-1 ring-4 ring-background shadow-sm"></span>
                        <p className="text-sm text-foreground bg-card px-4 py-3 rounded-md border border-border shadow-sm inline-block whitespace-pre-line">
                           {event.userName ? (
                             <>
                               <span className="font-bold">{event.userName}</span> {event.action}
                             </>
                           ) : (
                             <span className="font-semibold">{event.action}</span>
                           )}
                        </p>
                        <time className="text-xs text-muted-foreground mt-2 block ml-1 font-medium">
                          {format(new Date(event.date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </time>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="comments" className="m-0 h-full focus-visible:outline-none">
              <DealCommentsTab
                deal={deal}
                userName={userName}
                authorUserId={currentUser?.id}
                authorEmail={userEmail}
                workspaceId={activeWorkspaceId || ""}
                mentionableUsers={mentionableUsers}
                onRegisterHistory={addHistoryEvent}
              />
            </TabsContent>

            <TabsContent value="tasks" className="m-0 h-full px-4 focus-visible:outline-none sm:px-6 xl:px-8">
              <div className="flex flex-col h-full max-w-4xl">
                <div className="space-y-6 pb-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                      Próximas atividades
                    </h3>
                    <Button 
                      onClick={() => {
                        setNewTaskAssignedTo(defaultActivityAssignee);
                        setShowCreateTaskDialog(true);
                      }} 
                      size="sm" 
                      className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Criar atividade
                    </Button>
                  </div>

                  {(!deal.tasks || deal.tasks.filter(t => getActivityStatus(t) === "pending").length === 0) ? (
                    <div className="text-center text-muted-foreground py-12 border rounded-lg bg-card shadow-sm">
                      <p>Nenhuma atividade pendente!</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg bg-card shadow-sm flex flex-col">
                      {[...deal.tasks]
                        .filter(t => getActivityStatus(t) === "pending")
                        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map(task => {
                          const taskDateTime = getDueDateTime(task.dueDate, task.dueTime);
                          const isOverdue = !!taskDateTime && taskDateTime.getTime() < Date.now();
                          const isExiting = exitingTaskIds.includes(task.id);
                          const activityMeta = getActivityTypeMeta(task.taskType);
                          const ActivityIcon = activityMeta.icon;
                          
                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "flex flex-col gap-4 border-b p-4 transition-colors last:border-0 hover:bg-muted/50 md:flex-row md:items-center md:justify-between motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-reduce:animate-none",
                                isExiting && "animate-item-exit pointer-events-none",
                              )}
                            >
                              <div className="flex items-center gap-4">
                                <div className="bg-primary/10 p-2 rounded-md shrink-0">
                                  <ActivityIcon className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-foreground">{activityMeta.label}</span>
                                    <span className="font-semibold text-sm text-foreground">{task.title}</span>
                                  </div>
                                  {task.description && (
                                    <span className="text-xs text-muted-foreground uppercase">{task.description}</span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    Responsável: {getResponsibleName(task.assignedTo)}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-6 justify-between md:justify-end">
                                <div className="flex flex-col items-start md:items-end gap-1">
                                  {isOverdue ? (
                                     <span className="bg-[#e91e63] text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Atrasada</span>
                                  ) : (
                                     <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase dark:bg-slate-800 dark:text-slate-300">Aberta em dia</span>
                                  )}
                                  <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                                    {task.dueDate ? format(parseLocalDateValue(task.dueDate) || new Date(task.dueDate), "dd/MM/yyyy") : ""} {task.dueTime || ""}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button variant="ghost" size="icon" className="w-8 h-8 text-primary hover:bg-primary/10 rounded-full" onClick={() => openEditTask(task)}>
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="w-8 h-8 text-primary hover:bg-primary/10 rounded-full">
                                        <Clock className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56">
                                      {TASK_DELAY_OPTIONS.map((option) => (
                                        <DropdownMenuItem key={option.mode} onClick={() => handleDelayTask(task, option.mode, option.label)}>
                                          {option.label}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  <Button variant="ghost" size="icon" className="w-8 h-8 text-rose-600 hover:bg-rose-50 rounded-full" onClick={() => cancelTask(deal.id, task.id, userName).then(() => toast.success("Atividade cancelada"))}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="w-8 h-8 bg-cyan-100 text-cyan-600 hover:bg-cyan-200 hover:text-cyan-700 rounded-xl" onClick={() => handleToggleTaskState(task)}>
                                    <Check className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                      })}
                    </div>
                  )}

                  {deal.tasks && deal.tasks.filter(t => getActivityStatus(t) !== "pending").length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100">Histórico de atividades</h3>
                      <div className="border rounded-lg bg-card shadow-sm flex flex-col">
                      {[...deal.tasks]
                        .filter(t => getActivityStatus(t) !== "pending")
                        .sort((a,b) => new Date(b.completedAt || b.canceledAt || b.createdAt).getTime() - new Date(a.completedAt || a.canceledAt || a.createdAt).getTime())
                        .map(task => {
                          const status = getActivityStatus(task);
                          const doneDate = task.completedAt || task.canceledAt;
                          const activityMeta = getActivityTypeMeta(task.taskType);
                          const ActivityIcon = activityMeta.icon;
                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "flex flex-col gap-4 border-b p-4 transition-colors last:border-0 hover:bg-muted/50 md:flex-row md:items-start md:justify-between motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-reduce:animate-none",
                                recentlyCompletedTaskIds.includes(task.id) && "bg-emerald-500/5",
                              )}
                            >
                              <div className="flex items-start gap-4">
                                <div className={cn("mt-0.5 shrink-0 rounded-md p-2", status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                                  {status === "completed" ? <ActivityIcon className="w-5 h-5" /> : <X className="w-5 h-5" />}
                                </div>
                                <div className="flex flex-col gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-sm text-foreground">{activityMeta.label}</span>
                                    <span className="font-semibold text-sm text-foreground">{task.title}</span>
                                    <Badge variant={status === "completed" ? "default" : "secondary"}>{status === "completed" ? "Concluída" : "Cancelada"}</Badge>
                                  </div>
                                  {doneDate && (
                                    <span className="text-xs text-muted-foreground">
                                      {status === "completed" ? "Concluída" : "Cancelada"} em {format(new Date(doneDate), "dd/MM/yyyy 'às' HH:mm")}
                                    </span>
                                  )}
                                  {task.activityResult && (
                                    <div className="space-y-1 text-sm">
                                      <p className="font-semibold text-foreground">Resultado:</p>
                                      <p className="text-muted-foreground">{task.activityResult}</p>
                                    </div>
                                  )}
                                  {task.resultNotes && (
                                    <div className="space-y-1 text-sm">
                                      <p className="font-semibold text-foreground">Observação:</p>
                                      <p className="text-muted-foreground">{task.resultNotes}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:bg-muted/80 rounded-full" onClick={() => handleToggleTaskState(task)}>
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files" className="m-0 h-full focus-visible:outline-none">
              <DealFilesTab deal={deal} userName={userName} onRegisterHistory={addHistoryEvent} />
            </TabsContent>

            <TabsContent value="qualification" className="m-0 h-full px-4 focus-visible:outline-none sm:px-6 xl:px-8">
              <DealQualificationTab
                deal={deal}
                contacts={liveContacts}
                userName={userName}
                onUpdateDeal={updateDeal}
                onUpdateContact={updateContact}
                onRegisterHistory={addHistoryEvent}
              />
            </TabsContent>

            <TabsContent value="commercial_history" className="m-0 h-full px-4 focus-visible:outline-none sm:px-6 xl:px-8">
              <div className="flex flex-col h-full max-w-6xl shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    Histórico Comercial
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4 bg-muted/20 p-2 rounded-lg border border-border">
                  <span className="text-xs font-bold text-muted-foreground px-2 uppercase tracking-wide">Filtros:</span>
                  {[
                    { id: "ongoing", label: "Em Aberto" },
                    { id: "all", label: "Sem filtro" },
                    { id: "won", label: "Ganhas" },
                    { id: "lost", label: "Perdidas" }
                  ].map(f => (
                    <Button
                      key={f.id}
                      variant={historyFilter === f.id ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs font-medium rounded-full"
                      onClick={() => setHistoryFilter(f.id as any)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>

                {filteredHistoryDeals.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 border rounded-lg bg-card shadow-sm">
                    <p>Nenhuma outra negociação encontrada para o filtro selecionado.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm w-full overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse min-w-[1140px]">
                      <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                        <tr>
                          <th className="px-6 py-3 font-medium">Negociação</th>
                          <th className="px-6 py-3 font-medium">Status</th>
                          <th className="px-6 py-3 font-medium">Etapa</th>
                          <th className="px-6 py-3 font-medium">Valor</th>
                          <th className="px-6 py-3 font-medium">Responsável</th>
                          <th className="px-6 py-3 font-medium">Última Interação</th>
                          <th className="px-6 py-3 font-medium text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredHistoryDeals.map((rDeal) => {
                          const assignedUser = users.find(u => u.id === rDeal.assignedTo);
                          const isExpanded = !!expandedDeals[rDeal.id];
                          const isCurrentDeal = rDeal.id === deal.id;
                          
                          // Status rendering
                          let statusBadge = (
                                <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                  Em aberto
                                </span>
                          );
                          if (rDeal.outcome === "won" || rDeal.stage === "won") {
                            statusBadge = (
                                <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                                  Ganho
                                </span>
                            );
                          } else if (rDeal.outcome === "lost" || rDeal.stage === "lost") {
                            statusBadge = (
                              <div className="flex flex-col items-start gap-0.5">
                                <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                  Perdido
                                </span>
                                {rDeal.lossReason && (
                                  <span className="text-[10px] text-red-500 font-semibold">Motivo: {rDeal.lossReason}</span>
                                )}
                              </div>
                            );
                          }

                          const stageLabel = ALL_STAGES.find(s => s.id === rDeal.stage)?.label || rDeal.stage;

                          return (
                            <React.Fragment key={rDeal.id}>
                              <tr 
                                className={cn(
                                  "hover:bg-muted/30 transition-colors border-b cursor-pointer align-middle",
                                  isCurrentDeal && "bg-cyan-50/60 hover:bg-cyan-50 border-l-4 border-l-[#00adc7]"
                                )}
                                onClick={() => setExpandedDeals(prev => ({ ...prev, [rDeal.id]: !isExpanded }))}
                              >
                                <td className="px-6 py-4 font-semibold text-foreground">
                                  <div className="flex items-center gap-2">
                                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", isExpanded && "rotate-180")} />
                                    <span className="whitespace-nowrap">{rDeal.dealName || "Sem Nome"}</span>
                                    {isCurrentDeal && (
                                      <span className="rounded-full bg-[#00adc7]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#008ba1]">
                                        Atual
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  {statusBadge}
                                </td>
                                <td className="px-6 py-4 text-muted-foreground font-medium whitespace-nowrap">
                                  {stageLabel}
                                </td>
                                <td className="px-6 py-4 font-semibold text-foreground whitespace-nowrap">
                                  {formatCurrency(rDeal.value || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {assignedUser ? (
                                    <div className="flex items-center gap-2 text-xs">
                                      <UserAvatar name={assignedUser.name} avatar={assignedUser.avatar} />
                                      <span className="truncate">{assignedUser.name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                                  {getLastInteraction(rDeal)}
                                </td>
                                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 px-2.5 text-[#00adc7] hover:text-[#008ba1] hover:bg-cyan-50 font-bold"
                                    onClick={() => triggerOpenDeal(rDeal.id)}
                                    title="Abrir negociação"
                                  >
                                    <ExternalLink className="w-4 h-4 mr-1" />
                                    Abrir
                                  </Button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-muted/10 border-b border-border/50 animate-in fade-in duration-200">
                                  <td colSpan={9} className="p-0">
                                    <div className="px-14 pb-5 pt-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                        
                                        {/* Timeline resumida */}
                                        <div className="space-y-3">
                                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <History className="w-3.5 h-3.5 text-primary" /> Linha do Tempo
                                          </h4>
                                          {(!rDeal.history || rDeal.history.length === 0) ? (
                                            <p className="text-xs text-muted-foreground italic">Nenhum evento registrado nesta negociação.</p>
                                          ) : (
                                            <div className="relative border-l border-border/80 pl-4 space-y-4 py-1 ml-2">
                                              {[...rDeal.history].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((event, idx) => (
                                                <div key={event.id || idx} className="relative">
                                                  <span className="absolute w-2.5 h-2.5 bg-primary rounded-full left-[-21.5px] top-1 ring-4 ring-background"></span>
                                                  <p className="text-xs font-semibold text-foreground whitespace-pre-line">
                                                    {event.userName ? <span className="text-muted-foreground font-normal">{event.userName} </span> : ""}{event.action}
                                                  </p>
                                                  <time className="text-[10px] text-muted-foreground font-medium block">
                                                    {format(new Date(event.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                                  </time>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        {/* Informações detalhadas do status */}
                                        <div className="space-y-4">
                                          {rDeal.outcome === "lost" && (
                                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4">
                                              <p className="text-sm font-bold text-red-800 dark:text-red-300 flex items-center gap-1.5">
                                                <XCircle className="w-4 h-4" /> Motivo da Perda: {rDeal.lossReason || "Não informado"}
                                              </p>
                                              {rDeal.lossDescription && (
                                                <p className="text-xs text-red-600 dark:text-red-400 mt-2 pl-5 bg-background/50 p-2.5 rounded border border-red-100 dark:border-red-900/30 whitespace-pre-wrap">{rDeal.lossDescription}</p>
                                              )}
                                            </div>
                                          )}

                                          <div className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-2.5">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detalhes da Negociação</h4>
                                            <div className="grid grid-cols-2 gap-y-2 text-xs">
                                              <div>
                                                <span className="text-muted-foreground font-medium">Criado em:</span>
                                                <p className="font-semibold text-foreground">{format(new Date(rDeal.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground font-medium">Última atualização:</span>
                                                <p className="font-semibold text-foreground">{rDeal.updatedAt ? format(new Date(rDeal.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</p>
                                              </div>
                                              {rDeal.closingDate && (
                                                <div>
                                                  <span className="text-muted-foreground font-medium">Previsão de Fechamento:</span>
                                                  <p className="font-semibold text-foreground">{formatClosingDate(rDeal.closingDate)}</p>
                                                </div>
                                              )}
                                              {rDeal.qualification && (
                                                <div>
                                                  <span className="text-muted-foreground font-medium">Qualificação:</span>
                                                  <p className="font-semibold text-foreground">{rDeal.qualification}</p>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ANÁLISE DO CLIENTE */}
            <TabsContent value="customer_analysis" className="m-0 h-full px-4 focus-visible:outline-none sm:px-6 xl:px-8">
              {deal.personType === "Juridica" ? (
                <div className="flex h-full max-w-6xl flex-col pb-12">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Análise Detalhada</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Alterne entre a visão consolidada da empresa e a visão do contato principal.</p>
                    </div>
                    <div className="inline-flex rounded-lg border border-border bg-card p-1">
                      <button onClick={() => setDetailedAnalysisScope("company")} className={cn("rounded-md px-3 py-1.5 text-sm font-semibold transition-colors", detailedAnalysisScope === "company" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Empresa</button>
                      <button onClick={() => setDetailedAnalysisScope("contact")} className={cn("rounded-md px-3 py-1.5 text-sm font-semibold transition-colors", detailedAnalysisScope === "contact" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Contato</button>
                    </div>
                  </div>

                  {detailedAnalysisScope === "company" ? (
                    <CustomerAnalysis deals={companyAnalysisDeals} title={`Análise da Empresa — ${liveCompany?.name || deal.companyName || "Empresa"}`} showQualification={false} />
                  ) : selectedAnalysisContact ? (
                    <>
                      {liveContacts.length > 1 ? (
                        <div className="mb-5 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                          <label className="text-xs font-semibold uppercase text-muted-foreground">Contato principal da negociação</label>
                          <select
                            value={selectedAnalysisContact.id}
                            onChange={(event) => {
                              const contactId = event.target.value;
                              setSelectedAnalysisContactId(contactId);
                            const selectedContact = liveContacts.find((contact) => contact.id === contactId);
                            void updateDeal(deal.id, { primaryContactId: contactId, contactId, contactName: selectedContact?.name || "", phone: selectedContact?.phone || "" });
                              toast.success("Contato principal atualizado.");
                            }}
                            className="mt-1.5 flex h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm font-medium"
                          >
                            {liveContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
                          </select>
                          <p className="mt-1.5 text-xs text-muted-foreground">A qualificação exibida na negociação é a deste contato principal.</p>
                        </div>
                      ) : (
                        <p className="mb-5 text-sm text-muted-foreground">Contato principal: <span className="font-semibold text-foreground">{selectedAnalysisContact.name}</span></p>
                      )}
                      <CustomerAnalysis
                        deals={contactAnalysisDeals}
                        title={`Análise do Contato — ${selectedAnalysisContact.name}`}
                        qualificationClassification={selectedAnalysisContact.qualificationClassification}
                        qualificationScore={selectedAnalysisContact.qualificationScore}
                        qualificationCompletedAt={selectedAnalysisContact.qualificationCompletedAt}
                        qualificationResponsible={selectedAnalysisContact.qualificationResponsible}
                      />
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">Associe um contato a esta negociação para visualizar a análise individual.</div>
                  )}
                </div>
              ) : (
              <div className="flex flex-col h-full max-w-6xl shrink-0 pb-12">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    Análise do Cliente
                  </h3>
                </div>

                <div className="rounded-lg border border-border bg-card p-4 shadow-sm mb-6">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Classificação do Lead</p>
                      <p className="mt-1 text-lg font-bold text-foreground">
                        {deal.qualificationClassification || liveContact?.qualificationClassification || "Sem qualificação"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Pontuação BANT</p>
                      <p className="mt-1 text-lg font-bold text-foreground">
                        {deal.qualificationScore ?? liveContact?.qualificationScore ?? 0}/20 pontos
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Última qualificação</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {(deal.qualificationCompletedAt || liveContact?.qualificationCompletedAt)
                          ? format(new Date(deal.qualificationCompletedAt || liveContact!.qualificationCompletedAt!), "dd/MM/yyyy", { locale: ptBR })
                          : "Não realizada"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Responsável</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {deal.qualificationResponsible || liveContact?.qualificationResponsible || "Não informado"}
                      </p>
                    </div>
                  </div>
                  {(deal.qualificationClassification || liveContact?.qualificationClassification) && (
                    <div className="mt-4 border-t border-border pt-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Próxima ação sugerida</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {getQualificationNextActions(deal.qualificationClassification || liveContact?.qualificationClassification).map((action) => (
                          <span key={action} className="rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs font-semibold text-foreground">
                            {action}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* DASHBOARD GRID INDICADORES */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {/* Relacionamento */}
                  <Card className="shadow-sm border-border/80 bg-gradient-to-br from-background to-blue-50/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Relacionamento</CardTitle>
                      <Calendar className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent className="space-y-2 pt-1">
                      <div className="text-2xl font-bold text-foreground">
                        {analysisMetrics.relationshipDays} {analysisMetrics.relationshipDays === 1 ? 'Dia' : 'Dias'}
                      </div>
                      <div className="text-xs space-y-1 text-muted-foreground pt-1 border-t border-border/50">
                        <div className="flex justify-between">
                          <span>Negociações:</span>
                          <span className="font-semibold text-foreground">{analysisMetrics.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Primeira:</span>
                          <span className="font-semibold text-foreground">
                            {analysisMetrics.oldestDate ? format(analysisMetrics.oldestDate, "dd/MM/yyyy", { locale: ptBR }) : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Última:</span>
                          <span className="font-semibold text-foreground">
                            {analysisMetrics.newestDate ? format(analysisMetrics.newestDate, "dd/MM/yyyy", { locale: ptBR }) : "—"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Conversão */}
                  <Card className="shadow-sm border-border/80 bg-gradient-to-br from-background to-emerald-50/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Conversão</CardTitle>
                      <Trophy className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="space-y-2 pt-1">
                      <div className="text-2xl font-bold text-foreground">
                        {analysisMetrics.conversionRate.toFixed(1)}%
                      </div>
                      <div className="text-xs space-y-1 text-muted-foreground pt-1 border-t border-border/50">
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span className="font-semibold text-foreground">{analysisMetrics.total} neg.</span>
                        </div>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>Ganhas:</span>
                          <span className="font-bold">{analysisMetrics.wonCount}</span>
                        </div>
                        <div className="flex justify-between text-red-500">
                          <span>Perdidas:</span>
                          <span className="font-bold">{analysisMetrics.lostCount}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Performance */}
                  <Card className="shadow-sm border-border/80 bg-gradient-to-br from-background to-cyan-50/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Performance Comercial</CardTitle>
                      <TrendingUp className="w-4 h-4 text-cyan-500" />
                    </CardHeader>
                    <CardContent className="space-y-2 pt-1">
                      <div className="text-2xl font-bold text-foreground truncate" title={formatCurrency(analysisMetrics.totalWonValue)}>
                        {formatCurrency(analysisMetrics.totalWonValue)}
                      </div>
                      <div className="text-xs space-y-1 text-muted-foreground pt-1 border-t border-border/50">
                        <div className="flex justify-between truncate">
                          <span>Total Negociado:</span>
                          <span className="font-semibold text-foreground">{formatCurrency(analysisMetrics.totalValue)}</span>
                        </div>
                        <div className="flex justify-between truncate">
                          <span>Ticket Médio:</span>
                          <span className="font-semibold text-foreground">{formatCurrency(analysisMetrics.ticketMedio)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recorrência */}
                  <Card className="shadow-sm border-border/80 bg-gradient-to-br from-background to-purple-50/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Recorrência</CardTitle>
                      <Activity className="w-4 h-4 text-purple-500" />
                    </CardHeader>
                    <CardContent className="space-y-2 pt-1">
                      <div className="text-2xl font-bold text-foreground">
                        {analysisMetrics.avgIntervalDays !== null ? `${analysisMetrics.avgIntervalDays} dias` : "—"}
                      </div>
                      <div className="text-xs space-y-1 text-muted-foreground pt-1 border-t border-border/50">
                        <div className="flex justify-between truncate">
                          <span>Média Retorno:</span>
                          <span className="font-semibold text-foreground">
                            {analysisMetrics.avgIntervalDays !== null ? `${analysisMetrics.avgIntervalDays} dias` : "Único negócio"}
                          </span>
                        </div>
                        <div className="flex justify-between truncate">
                          <span>Última Compra Ganha:</span>
                          <span className="font-semibold text-foreground">
                            {analysisMetrics.daysSinceLastWon !== null ? `há ${analysisMetrics.daysSinceLastWon} dias` : "Sem vendas ganhas"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* SEÇÃO DE GRÁFICOS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                  {/* Gráfico 1: Conversão (Donut) */}
                  <Card className="shadow-sm border-border/80">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        Qualidade do Relacionamento
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-64 flex flex-col justify-center items-center">
                      {analysisMetrics.pieData.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sem dados suficientes para gerar gráfico.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analysisMetrics.pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {analysisMetrics.pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value} Negociações`, 'Quantidade']} />
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Gráfico 2: Evolução (Line) */}
                  <Card className="shadow-sm border-border/80 lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-foreground">
                        Evolução das Negociações ao Longo do Tempo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                      {analysisMetrics.evolutionData.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-xs text-muted-foreground">Sem dados históricos de evolução.</p>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analysisMetrics.evolutionData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <XAxis dataKey="monthStr" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="Total" name="Total Criado" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="Ganhas" name="Ganhas" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="Perdidas" name="Perdidas" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Gráfico 3: Motivos de Perda (Bar) */}
                  <Card className="shadow-sm border-border/80">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-foreground">
                        Principais Motivos de Perda
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-64 flex items-center justify-center">
                      {analysisMetrics.lossReasonsData.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center p-4">Excelente! Nenhuma negociação foi marcada como perdida no histórico deste cliente.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analysisMetrics.lossReasonsData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <XAxis type="number" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                            <YAxis dataKey="name" type="category" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} width={80} />
                            <Tooltip />
                            <Bar dataKey="value" name="Perdas" fill="#ef4444" radius={[0, 4, 4, 0]} maxBarSize={30} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Insights Section */}
                  <Card className="shadow-sm border-border/80 lg:col-span-2 bg-gradient-to-br from-background to-amber-50/5">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        Insights do Cliente
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3">
                        {analysisMetrics.insights.map((insight, index) => (
                          <div key={index} className="flex gap-3 items-start p-3 bg-muted/40 rounded-xl border border-border/50 text-sm">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 font-bold text-xs mt-0.5">
                              {index + 1}
                            </span>
                            <span className="text-muted-foreground font-medium text-foreground">{insight}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              )}
            </TabsContent>

          </div>
        </Tabs>
      </div>
      {/* Loss Reason Dialog */}
      <Dialog open={showLossDialog} onOpenChange={setShowLossDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <XCircle className="w-5 h-5 text-red-500" />
              Motivo da Perda
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Reason Selection */}
            <div className="space-y-2">
              <Label className="text-xs uppercase font-semibold text-muted-foreground">Selecione o motivo</Label>
              <div className="grid grid-cols-2 gap-2">
                {allReasons.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setLossReason(reason)}
                    className={`px-3 py-2 rounded-lg border text-sm text-left transition-all ${
                      lossReason === reason
                        ? "border-red-500 bg-red-500/10 text-red-500 font-semibold"
                        : "border-border text-foreground hover:border-red-500/40 hover:bg-red-500/5"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              {/* Add Custom Reason */}
              {showAddReason ? (
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Digite o novo motivo..."
                    value={newCustomReason}
                    onChange={(e) => setNewCustomReason(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newCustomReason.trim()) {
                        setCustomReasons(prev => [...prev, newCustomReason.trim()]);
                        setLossReason(newCustomReason.trim());
                        setNewCustomReason("");
                        setShowAddReason(false);
                      }
                    }}
                    className="text-sm"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (newCustomReason.trim()) {
                        setCustomReasons(prev => [...prev, newCustomReason.trim()]);
                        setLossReason(newCustomReason.trim());
                        setNewCustomReason("");
                        setShowAddReason(false);
                      }
                    }}
                  >
                    Salvar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-1"
                  onClick={() => setShowAddReason(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Motivo
                </Button>
              )}
            </div>

            {/* Optional Description */}
            <div className="space-y-2">
              <Label className="text-xs uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Descrição <span className="text-muted-foreground/50 normal-case font-normal">(opcional)</span>
              </Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none min-h-[80px]"
                placeholder="Detalhes adicionais sobre a perda..."
                value={lossDescription}
                onChange={(e) => setLossDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowLossDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmLoss}
              className="gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              Confirmar Perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Activity Dialog */}
      <Dialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Nova atividade</DialogTitle>
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
                value={newTaskAssignedTo}
                onChange={(e) => setNewTaskAssignedTo(e.target.value)}
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
                  value={newTaskTime} 
                  onChange={(e) => setNewTaskTime(e.target.value)} 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Sem horário</option>
                  {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-3 mt-4 pt-4 border-t border-border/50">
            <Button type="button" variant="outline" className="font-semibold text-foreground" onClick={() => setShowCreateTaskDialog(false)}>
              Cancelar
            </Button>
            <Button type="button" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" onClick={handleCreateTask}>
              Criar atividade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CompleteTaskDialog
        deal={deal}
        task={activityToComplete}
        onClose={() => setActivityToComplete(null)}
        userName={userName}
        defaultAssignee={defaultActivityAssignee}
        onCompleteStart={(taskId) => setExitingTaskIds((current) => (current.includes(taskId) ? current : [...current, taskId]))}
        onCompleteEnd={(taskId) => {
          setRecentlyCompletedTaskIds((current) => (current.includes(taskId) ? current : [...current, taskId]));
          window.setTimeout(() => {
            setRecentlyCompletedTaskIds((current) => current.filter((id) => id !== taskId));
          }, 700);
          setExitingTaskIds((current) => current.filter((id) => id !== taskId));
        }}
      />

      <EditTaskDialog
        deal={deal}
        task={editingTask}
        onClose={() => setEditingTask(null)}
        userName={userName}
        defaultAssignee={defaultActivityAssignee}
      />
      <Dialog
        open={showTransferPipelineDialog}
        onOpenChange={(open) => {
          setShowTransferPipelineDialog(open);
          if (!open) {
            setTransferPipelineId("");
            setTransferStageId("");
            setTransferReason("");
            setTransferringPipeline(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Mover para outro Pipeline</DialogTitle>
            <DialogDescription>
              Transfira a negociação para outro pipeline mantendo o histórico e o contexto comercial.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Pipeline Atual</Label>
              <Input value={currentPipeline?.name || "Pipeline atual"} disabled />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Pipeline Destino</Label>
              <select
                value={transferPipelineId}
                onChange={(event) => setTransferPipelineId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={availableTransferPipelines.length === 0}
              >
                {availableTransferPipelines.length === 0 ? (
                  <option value="">Nenhum pipeline ativo disponível</option>
                ) : null}
                {availableTransferPipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Etapa Destino</Label>
              <select
                value={transferStageId}
                onChange={(event) => setTransferStageId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={!transferPipelineId || transferPipelineStages.length === 0}
              >
                {!transferPipelineId ? <option value="">Selecione um pipeline</option> : null}
                {transferPipelineId && transferPipelineStages.length === 0 ? <option value="">Nenhuma etapa ativa disponível</option> : null}
                {transferPipelineStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Motivo da Transferência</Label>
              <Textarea
                value={transferReason}
                onChange={(event) => setTransferReason(event.target.value)}
                placeholder="Negociação transferida para atendimento da equipe comercial."
                className="min-h-[104px] resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowTransferPipelineDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleTransferPipeline()}
              disabled={transferringPipeline || availableTransferPipelines.length === 0 || !transferPipelineId || !transferStageId}
            >
              {transferringPipeline ? "Transferindo..." : "Confirmar Transferência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Excluir Negociação</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir esta negociação? Esta ação não pode ser desfeita.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (!allowDeleteRecords) {
                  toast.error("Seu perfil não permite excluir registros.");
                  return;
                }
                removeDeal(deal.id);
                onBack();
                toast.success("Negociação excluída com sucesso");
              }}
            >
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Remove Contact Confirmation Dialog */}
      <Dialog open={!!contactToRemove} onOpenChange={(val) => !val && setContactToRemove(null)}>
        <DialogContent className="sm:max-w-[450px] p-8 rounded-2xl border-none">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-2xl font-bold text-[#003d4f]">
              Remover contato da Negociação?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Este contato não estará mais associado a esta negociação, mas você poderá acessá-lo novamente através da lista de contatos.
            </p>
          </div>
          <DialogFooter className="flex-row justify-center gap-4 pt-4 sm:justify-center">
            <Button 
              variant="ghost" 
              className="px-8 h-12 rounded-full bg-[#c4f5ff] text-[#00adc7] hover:bg-[#a6edff] hover:text-[#00adc7] font-bold"
              onClick={() => setContactToRemove(null)}
            >
              Cancelar
            </Button>
            <Button 
              className="px-8 h-12 rounded-full bg-[#e11d48] text-white hover:bg-[#be123c] font-bold"
              onClick={() => {
                if (contactToRemove) {
                  const newContactIds = allContactIds.filter(id => id !== contactToRemove);
                  const nextPrimaryContactId = deal.primaryContactId === contactToRemove ? newContactIds[0] : deal.primaryContactId;
                  const updates: Partial<Deal> = { contactIds: newContactIds, primaryContactId: nextPrimaryContactId };
                  if (deal.contactId === contactToRemove) {
                    updates.contactId = nextPrimaryContactId || newContactIds[0] || undefined;
                    updates.contactName = contacts.find((contact) => contact.id === updates.contactId)?.name || "";
                    updates.phone = contacts.find((contact) => contact.id === updates.contactId)?.phone || "";
                  }
                  updateDeal(deal.id, updates);
                  toast.success("Contato removido da negociação");
                  setContactToRemove(null);
                }
              }}
            >
              Remover contato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Type Change Association Dialog */}
      <Dialog 
        open={!!showTypeChangeDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowTypeChangeDialog(null);
            setTempCompanyId(null);
            setTempContactIds([]);
            setIsCreatingContactDialog(false);
            setSearchContactDialog("");
            setContactPhoneDialog("");
            setContactEmailDialog("");
            setContactRoleDialog("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Alterar para Pessoa {showTypeChangeDialog === "Juridica" ? "Jurídica" : "Física"}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {showTypeChangeDialog === "Juridica" ? (
              !tempCompanyId ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Selecione a empresa para esta negociação:
                  </p>
                  <Command className="rounded-lg border shadow-md">
                    <CommandInput placeholder="Buscar empresa..." value={companySearch} onValueChange={setCompanySearch} />
                    <CommandList>
                      <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                      <CommandGroup heading="Empresas Disponíveis">
                        {wsCompanies.map(comp => (
                          <CommandItem
                            key={comp.id}
                            value={comp.name}
                            onSelect={() => {
                              setTempCompanyId(comp.id);
                              // Auto-select first contact if available
                              const firstContact = contacts.find(c => c.companyId === comp.id);
                              if (firstContact) {
                                setTempContactIds([firstContact.id]);
                              }
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                            {comp.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Empresa Selecionada</p>
                      <p className="text-sm font-bold text-foreground">{wsCompanies.find(c => c.id === tempCompanyId)?.name}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setTempCompanyId(null); setTempContactIds([]); }} className="text-xs text-primary">Trocar</Button>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Adicionar Contatos da Empresa</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          Selecione ou busque contatos...
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Buscar contato..." 
                            value={internalContactSearch} 
                            onValueChange={setInternalContactSearch} 
                          />
                          <CommandList>
                            <CommandGroup>
                              <CommandItem
                                value="createnewcontactdialogshortcut"
                                onSelect={() => { 
                                  setIsCreatingContactDialog(true);
                                  setSearchContactDialog(internalContactSearch);
                                }}
                                className="text-primary font-medium cursor-pointer"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                {internalContactSearch ? `Criar "${internalContactSearch}"` : "Criar Novo Contato"}
                              </CommandItem>
                            </CommandGroup>
                            <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
                            <CommandGroup heading="Contatos da Empresa">
                              {contacts.filter(c => c.companyId === tempCompanyId).map(cont => (
                                <CommandItem
                                  key={cont.id}
                                  value={cont.name}
                                  onSelect={() => {
                                    if (!tempContactIds.includes(cont.id)) {
                                      setTempContactIds(prev => [...prev, cont.id]);
                                    }
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", tempContactIds.includes(cont.id) ? "opacity-100" : "opacity-0")} />
                                  {cont.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {/* Selected Contacts Rich Cards */}
                    {tempContactIds.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Contatos Selecionados</Label>
                        <div className="grid gap-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                          {tempContactIds.map(id => {
                            const contact = contacts.find(c => c.id === id);
                            if (!contact) return null;
                            return (
                              <div key={id} className="relative group p-3 bg-muted/20 rounded-lg border border-border/50 hover:border-[#00adc7]/30 transition-colors">
                                <button 
                                  onClick={() => setTempContactIds(prev => prev.filter(x => x !== id))}
                                  className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-red-500 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                                
                                <div className="flex flex-col gap-1.5">
                                  <span className="font-semibold text-sm pr-6">{contact.name}</span>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                    {contact.phone && (
                                      <div className="flex items-center gap-1.5">
                                        <Phone className="w-3 h-3 text-[#00adc7]" />
                                        {contact.phone}
                                      </div>
                                    )}
                                    {contact.email && (
                                      <div className="flex items-center gap-1.5">
                                        <Mail className="w-3 h-3 text-[#00adc7]" />
                                        {contact.email}
                                      </div>
                                    )}
                                    {contact.role && (
                                      <div className="flex items-center gap-1.5">
                                        <Briefcase className="w-3 h-3 text-[#00adc7]" />
                                        {contact.role}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {isCreatingContactDialog && (
                      <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border border-dashed border-border mt-4">
                        <div className="space-y-1.5 col-span-2 flex justify-between items-center">
                          <Label className="text-[#00adc7] font-semibold">Novo Contato</Label>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setIsCreatingContactDialog(false)}>
                            Remover
                          </Button>
                        </div>
                        <div className="space-y-1.5 col-span-2">
                          <Label>Nome do Contato *</Label>
                          <Input 
                            placeholder="Informe o nome completo do Contato" 
                            value={searchContactDialog} 
                            onChange={(e) => setSearchContactDialog(e.target.value)} 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Telefone *</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                              placeholder="(11) 99999-9999" 
                              value={contactPhoneDialog} 
                              onChange={(e) => setContactPhoneDialog(maskPhone(e.target.value))} 
                              className="pl-10 bg-background"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label>E-mail</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                              type="email" 
                              placeholder="email@exemplo.com" 
                              value={contactEmailDialog} 
                              onChange={(e) => setContactEmailDialog(e.target.value)} 
                              className="pl-10 bg-background"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Cargo</Label>
                          <Select value={contactRoleDialog} onValueChange={setContactRoleDialog}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Selecione o cargo" />
                            </SelectTrigger>
                            <SelectContent>
                              {dialogRoleOptions.map((r) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Selecione o contato principal para Pessoa Física:
                </p>
                <Command className="rounded-lg border shadow-md">
                  <CommandInput placeholder="Buscar contato..." />
                  <CommandList>
                    <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
                    <CommandGroup heading="Contatos Disponíveis">
                      {contacts.filter(c => c.workspaceId === activeWorkspaceId && !c.companyId).map(cont => (
                        <CommandItem
                          key={cont.id}
                          value={cont.name}
                          onSelect={() => {
                            updateDeal(deal.id, { 
                              personType: "Fisica", 
                              contactId: cont.id,
                              contactName: cont.name,
                              phone: cont.phone,
                              email: cont.email,
                              contactIds: [cont.id],
                              primaryContactId: cont.id,
                            });
                            addHistoryEvent(deal.id, `alterou o tipo para Pessoa Física e vinculou o contato ${cont.name}`, userName);
                            setShowTypeChangeDialog(null);
                            toast.success("Tipo alterado e contato vinculado!");
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", deal.contactId === cont.id ? "opacity-100" : "opacity-0")} />
                          {cont.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
            )}
          </div>
          {/* Action button outside the scrollable area if it's Juridica Step 2 */}
          {showTypeChangeDialog === "Juridica" && tempCompanyId && (
            <DialogFooter className="px-6 py-4 border-t bg-muted/10">
              <Button 
                className="w-full bg-[#00adc7] hover:bg-[#008ba1] text-white font-bold h-11"
                onClick={async () => {
                  const comp = wsCompanies.find(c => c.id === tempCompanyId);
                  if (comp) {
                    const finalContactIds = [...tempContactIds];
                    
                    if (isCreatingContactDialog && searchContactDialog.trim() && contactPhoneDialog.trim()) {
                      if (!isValidBrazilianPhone(contactPhoneDialog)) {
                        toast.error("Informe um telefone válido com DDD. Exemplo: (11) 99999-9999.");
                        return;
                      }
                      const newC = await addContact({
                        name: searchContactDialog.trim(),
                        phone: contactPhoneDialog.trim(),
                        email: contactEmailDialog.trim() || undefined,
                        role: contactRoleDialog.trim() || undefined,
                        companyId: comp.id,
                        workspaceId: activeWorkspaceId!
                      });
                      finalContactIds.push(newC.id);
                    }

                    if (finalContactIds.length === 0) {
                      toast.error("Selecione ou crie pelo menos um contato.");
                      return;
                    }

                    updateDeal(deal.id, { 
                      personType: "Juridica", 
                      companyId: comp.id, 
                      companyName: comp.name, 
                      cnpj: comp.cnpj,
                      contactIds: finalContactIds,
                      contactId: finalContactIds[0],
                      primaryContactId: finalContactIds[0],
                      contactName: contacts.find(c => c.id === finalContactIds[0])?.name || searchContactDialog
                    });
                    addHistoryEvent(deal.id, `alterou o tipo para Pessoa Jurídica, vinculou a empresa ${comp.name} e ${finalContactIds.length} contatos`, userName);
                    
                    setShowTypeChangeDialog(null);
                    setTempCompanyId(null);
                    setTempContactIds([]);
                    setIsCreatingContactDialog(false);
                    toast.success("Tipo alterado e empresa vinculada!");
                  }
                }}
              >
                Confirmar Alteração
              </Button>
            </DialogFooter>
          )}
          {(!tempCompanyId || showTypeChangeDialog === "Fisica") && (
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowTypeChangeDialog(null); setTempCompanyId(null); setTempContactIds([]); }}>Cancelar</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
