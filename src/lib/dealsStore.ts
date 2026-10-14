import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { BantQualification } from "@/lib/leadQualification";
import { runTaskAutomationsForStageChange } from "@/lib/taskAutomationRunner";
import { getDefaultStageColor } from "@/lib/pipelineStageColors";
import { normalizeClosingDate } from "@/lib/closingDateDraft";

export type DealStage = string;
export type DealOutcome = "won" | "lost" | null;
export type ActivityStatus = "pending" | "completed" | "cancelled";

export interface PipelineStage {
  id: DealStage;
  label: string;
  probability: number;
  position: number;
  color?: string;
}

export const STAGES: PipelineStage[] = [
  { id: "leads", label: "Novos Leads", probability: 10, position: 1, color: getDefaultStageColor("leads", "Novos Leads", 0) },
  { id: "qualification", label: "Qualificacao", probability: 25, position: 2, color: getDefaultStageColor("qualification", "Qualificacao", 1) },
  { id: "proposal", label: "Proposta", probability: 50, position: 3, color: getDefaultStageColor("proposal", "Proposta", 2) },
  { id: "negotiation", label: "Negociacao", probability: 75, position: 4, color: getDefaultStageColor("negotiation", "Negociacao", 3) },
  { id: "closing", label: "Fechamento", probability: 95, position: 5, color: getDefaultStageColor("closing", "Fechamento", 4) },
];

export const ALL_STAGES: PipelineStage[] = [
  ...STAGES,
  { id: "won", label: "Ganho", probability: 100, position: 98, color: getDefaultStageColor("won", "Ganho", 5) },
  { id: "lost", label: "Perdido", probability: 0, position: 99, color: getDefaultStageColor("lost", "Perdido", 6) },
];

// Etapas que exigem uma qualificação concluída (deal.qualificationCompletedAt) antes de a
// negociação poder entrar nelas — seja movendo uma negociação existente ou já criando-a
// diretamente nessa etapa. Fonte única usada por Pipeline.tsx, DealView.tsx e CreateDealDialog.tsx.
export const QUALIFICATION_REQUIRED_STAGES = new Set(["proposal", "negotiation", "closing", "vitrine_de_produtos"]);

export const getStageProbability = (stageId: string, stages: Pick<PipelineStage, "id" | "probability">[] = STAGES) =>
  stages.find((stage) => stage.id === stageId)?.probability ?? STAGES.find((stage) => stage.id === stageId)?.probability ?? 0;

const normalizeStage = (stage?: string): DealStage => (typeof stage === "string" && stage.trim() ? stage : "leads");

export const getStageLabel = (stageId: string, stages: Pick<PipelineStage, "id" | "label">[] = ALL_STAGES) =>
  stages.find((stage) => stage.id === stageId)?.label || stageId;

export type DealTag = "hot" | "cold" | "urgent";

const DEAL_TAGS = new Set<DealTag>(["hot", "cold", "urgent"]);

export const isDealTag = (value: unknown): value is DealTag =>
  typeof value === "string" && DEAL_TAGS.has(value as DealTag);

const normalizeDealTags = (value: unknown): DealTag[] =>
  Array.isArray(value) ? value.filter(isDealTag) : [];

let dealsChannel: RealtimeChannel | null = null;
let subscribedWorkspaceId: string | null = null;
let dealsRefetchTimeout: ReturnType<typeof setTimeout> | null = null;

export interface DealTask {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  dueTime?: string;
  assignedTo?: string | string[];
  taskType?: string;
  companyId?: string;
  status?: ActivityStatus;
  activityResult?: string;
  resultNotes?: string;
  completedAt?: string;
  completedBy?: string;
  canceledAt?: string;
  canceledBy?: string;
  updatedAt?: string;
  completed: boolean;
  createdAt: string;
}

export interface DealEvent {
  id: string;
  action: string;
  date: string;
  userName?: string;
}

export interface Deal {
  id: string;
  dealCode?: string;
  dealCodeNumber?: number;
  dealName?: string;
  personType?: "Fisica" | "Juridica";
  contactId?: string;
  contactIds?: string[];
  primaryContactId?: string;
  companyId?: string;
  pipelineId: string;
  email?: string;
  /**
   * ATENÇÃO: `cpf` e `cnpj` NÃO existem como coluna em `crm_deals` — nem `toRow` nem `mapRow` os
   * tocam. Quem grava aqui perde o valor no próximo carregamento, sem erro. O documento vive no
   * contato (`crm_contacts.cpf`) e na empresa (`crm_companies.cnpj`); é de lá que a busca e as
   * telas devem ler. Mantidos só porque telas antigas ainda os leem com fallback.
   */
  cpf?: string;
  cnpj?: string;
  companyName?: string;
  sector?: string;
  phone: string;
  contactName: string;
  contactRole?: string;
  stage: DealStage;
  outcome?: DealOutcome | null;
  lossReason?: string;
  lossDescription?: string;
  value: number;
  tags: DealTag[];
  assignedTo?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  notes: string[];
  tasks?: DealTask[];
  history?: DealEvent[];
  qualification?: string;
  qualificationBant?: BantQualification;
  qualificationScore?: number;
  qualificationClassification?: string;
  qualificationCompletedAt?: string;
  qualificationResponsible?: string;
  closingDate?: string;
  workspaceId?: string;
}

interface DealsState {
  deals: Deal[];
  isLoading: boolean;
  fetchDeals: (workspaceId: string) => Promise<void>;
  addDeal: (deal: Omit<Deal, "id" | "createdAt">) => Promise<Deal>;
  updateDeal: (id: string, updates: Partial<Deal>) => Promise<void>;
  transferDealPipeline: (input: {
    dealId: string;
    destinationPipelineId: string;
    destinationStage: DealStage;
    fromPipelineName: string;
    toPipelineName: string;
    fromStageLabel: string;
    toStageLabel: string;
    reason?: string;
    userName?: string;
  }) => Promise<void>;
  moveDeal: (id: string, stage: DealStage, userName?: string, stageLabel?: string) => Promise<void>;
  setOutcome: (id: string, outcome: DealOutcome, lossReason?: string, lossDescription?: string, userName?: string) => Promise<void>;
  removeDeal: (id: string) => Promise<void>;
  getDealByPhone: (phone: string) => Deal | undefined;
  addNote: (id: string, note: string, userName?: string) => Promise<void>;
  addTask: (dealId: string, task: Omit<DealTask, "id" | "createdAt" | "completed">, userName?: string) => Promise<void>;
  editTask: (dealId: string, taskId: string, updates: Partial<DealTask>, userName?: string) => Promise<void>;
  toggleTask: (dealId: string, taskId: string, userName?: string) => Promise<void>;
  completeTask: (
    dealId: string,
    taskId: string,
    input: { activityResult: string; resultNotes?: string },
    userName?: string,
  ) => Promise<void>;
  cancelTask: (dealId: string, taskId: string, userName?: string) => Promise<void>;
  addHistoryEvent: (dealId: string, action: string, userName?: string) => Promise<void>;
}

const isUUID = (val?: string) => val && val.length === 36;

const toDealDB = (d: Partial<Deal>) => {
  const obj: any = {};
  if (d.id !== undefined) obj.id = d.id;
  if (d.dealCode !== undefined) obj.deal_code = d.dealCode;
  if (d.dealCodeNumber !== undefined) obj.deal_code_number = d.dealCodeNumber;
  if (d.dealName !== undefined) obj.deal_name = d.dealName;
  if (d.personType !== undefined) obj.person_type = d.personType;
  if (d.companyId !== undefined) obj.company_id = isUUID(d.companyId) ? d.companyId : null;
  if (d.contactId !== undefined) obj.contact_id = isUUID(d.contactId) ? d.contactId : null;
  if (d.primaryContactId !== undefined) obj.primary_contact_id = isUUID(d.primaryContactId) ? d.primaryContactId : null;
  if (d.pipelineId !== undefined) obj.pipeline_id = isUUID(d.pipelineId) ? d.pipelineId : null;
  if (d.phone !== undefined) obj.phone = d.phone;
  if (d.contactName !== undefined) obj.contact_name = d.contactName;
  if (d.contactRole !== undefined) obj.contact_role = d.contactRole;
  if (d.stage !== undefined) obj.stage = d.stage;
  if (d.outcome !== undefined) obj.outcome = d.outcome;
  if (d.lossReason !== undefined) obj.loss_reason = d.lossReason;
  if (d.lossDescription !== undefined) obj.loss_description = d.lossDescription;
  if (d.value !== undefined) obj.value = d.value;
  if (d.tags !== undefined) obj.tags = d.tags;
  if (d.assignedTo !== undefined) obj.assigned_to = isUUID(d.assignedTo) ? d.assignedTo : null;
  if (d.notes !== undefined) obj.notes = d.notes;
  if (d.qualification !== undefined) obj.qualification = d.qualification;
  if (d.qualificationBant !== undefined) obj.qualification_bant = d.qualificationBant;
  if (d.qualificationScore !== undefined) obj.qualification_score = d.qualificationScore;
  if (d.qualificationClassification !== undefined) obj.qualification_classification = d.qualificationClassification;
  if (d.qualificationCompletedAt !== undefined) obj.qualification_completed_at = d.qualificationCompletedAt;
  if (d.qualificationResponsible !== undefined) obj.qualification_responsible = d.qualificationResponsible;
  if (d.closingDate !== undefined) obj.closing_date = d.closingDate ? new Date(d.closingDate).toISOString() : null;
  if (d.workspaceId !== undefined) obj.workspace_id = d.workspaceId;
  if (d.createdAt !== undefined) obj.created_at = d.createdAt;
  if (d.updatedAt !== undefined) obj.updated_at = d.updatedAt;
  if (d.deletedAt !== undefined) obj.deleted_at = d.deletedAt;
  return obj;
};

const fromDealDB = (r: any): Deal => ({
  id: r.id,
  dealCode: r.deal_code || undefined,
  dealCodeNumber: r.deal_code_number ?? undefined,
  dealName: r.deal_name || undefined,
  personType: r.person_type || undefined,
  companyId: r.company_id || undefined,
  contactId: r.contact_id || undefined,
  primaryContactId: r.primary_contact_id || undefined,
  contactIds: Array.from(
    new Set(
      [
        r.contact_id,
        ...((r.crm_deal_contacts || []).map((item: any) => item.contact_id)),
      ].filter(Boolean),
    ),
  ),
  pipelineId: r.pipeline_id,
  phone: r.phone || "",
  contactName: r.contact_name || "",
  contactRole: r.contact_role || undefined,
  stage: normalizeStage(r.stage),
  outcome: r.outcome || null,
  lossReason: r.loss_reason || undefined,
  lossDescription: r.loss_description || undefined,
  value: Number(r.value) || 0,
  tags: normalizeDealTags(r.tags),
  assignedTo: r.assigned_to || undefined,
  notes: r.notes || [],
  qualification: r.qualification || undefined,
  qualificationBant: r.qualification_bant || undefined,
  qualificationScore: r.qualification_score ?? undefined,
  qualificationClassification: r.qualification_classification || undefined,
  qualificationCompletedAt: r.qualification_completed_at || undefined,
  qualificationResponsible: r.qualification_responsible || undefined,
  closingDate: normalizeClosingDate(r.closing_date),
  workspaceId: r.workspace_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at || undefined,
  deletedAt: r.deleted_at || undefined,
  tasks: (r.crm_tasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    dueDate: t.due_date,
    dueTime: t.due_time,
    assignedTo: t.assigned_to,
    taskType: t.task_type,
    companyId: t.company_id || undefined,
    status: t.status || (t.completed ? "completed" : "pending"),
    activityResult: t.activity_result || undefined,
    resultNotes: t.result_notes || undefined,
    completedAt: t.completed_at || undefined,
    completedBy: t.completed_by || undefined,
    canceledAt: t.canceled_at || undefined,
    canceledBy: t.canceled_by || undefined,
    updatedAt: t.updated_at || undefined,
    completed: t.completed || t.status === "completed",
    createdAt: t.created_at,
  })),
  history: (r.crm_deal_history || []).map((h: any) => ({
    id: h.id,
    action: h.action,
    userName: h.user_name,
    date: h.date,
  })),
});

const scheduleDealsRefetch = (workspaceId: string, fetchDeals: (workspaceId: string) => Promise<void>) => {
  if (dealsRefetchTimeout) clearTimeout(dealsRefetchTimeout);
  dealsRefetchTimeout = setTimeout(() => {
    dealsRefetchTimeout = null;
    void fetchDeals(workspaceId);
  }, 150);
};

const ensureDealsRealtimeSubscription = (
  workspaceId: string,
  fetchDeals: (workspaceId: string) => Promise<void>,
) => {
  if (subscribedWorkspaceId === workspaceId && dealsChannel) return;

  if (dealsChannel) {
    void supabase.removeChannel(dealsChannel);
    dealsChannel = null;
  }

  subscribedWorkspaceId = workspaceId;
  dealsChannel = supabase
    .channel(`crm-deals:${workspaceId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "crm_deals",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      () => {
        scheduleDealsRefetch(workspaceId, fetchDeals);
      },
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Error subscribing to crm_deals realtime updates for workspace", workspaceId);
      }
    });
};

const throwSupabaseError = (message: string, error: unknown) => {
  if (!error) return;
  console.error(message, error);
  throw error;
};

export const useDealsStore = create<DealsState>((set, get) => ({
  deals: [],
  isLoading: false,

  fetchDeals: async (workspaceId) => {
    set({ isLoading: true });
    ensureDealsRealtimeSubscription(workspaceId, get().fetchDeals);
    const { data, error } = await supabase
      .from("crm_deals")
      .select("*, crm_tasks(*), crm_deal_history(*), crm_deal_contacts(contact_id)")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching deals:", error);
      set({ isLoading: false });
      return;
    }

    set({ deals: (data || []).map(fromDealDB), isLoading: false });
  },

  addDeal: async (deal) => {
    const newId = crypto.randomUUID();
    const newDeal: Deal = {
      ...deal,
      primaryContactId: deal.primaryContactId || deal.contactIds?.[0] || deal.contactId,
      id: newId,
      outcome: deal.outcome ?? null,
      createdAt: new Date().toISOString(),
      history: [{ id: crypto.randomUUID(), action: "Negociacao criada", date: new Date().toISOString() }],
      tasks: [],
    };

    set((state) => ({ deals: [...state.deals, newDeal] }));

    const { data: insertedDeal, error } = await supabase
      .from("crm_deals")
      .insert(toDealDB(newDeal))
      .select("deal_code, deal_code_number")
      .single();

    if (error) {
      console.error("Error adding deal:", error);
      set((state) => ({ deals: state.deals.filter((item) => item.id !== newId) }));
      throw error;
    }

    const savedDeal: Deal = {
      ...newDeal,
      dealCode: insertedDeal?.deal_code || newDeal.dealCode,
      dealCodeNumber: insertedDeal?.deal_code_number ?? newDeal.dealCodeNumber,
    };

    set((state) => ({ deals: state.deals.map((item) => (item.id === newId ? savedDeal : item)) }));

    if (savedDeal.history?.length) {
      const { error: historyError } = await supabase.from("crm_deal_history").insert({
        deal_id: newId,
        action: savedDeal.history[0].action,
        user_name: savedDeal.history[0].userName,
        date: savedDeal.history[0].date,
      });
      throwSupabaseError("Error registering deal creation history:", historyError);
    }

    if (deal.contactIds?.length) {
      const dealContacts = deal.contactIds.map((contactId) => ({ deal_id: newId, contact_id: contactId }));
      const { error: contactsError } = await supabase.from("crm_deal_contacts").insert(dealContacts);
      throwSupabaseError("Error linking deal contacts:", contactsError);
    }

    return savedDeal;
  },

  updateDeal: async (id, updates) => {
    let previousDeals: Deal[] = [];
    set((state) => {
      previousDeals = state.deals;
      return {
        deals: state.deals.map((deal) => (deal.id === id ? { ...deal, ...updates, updatedAt: new Date().toISOString() } : deal)),
      };
    });

    const { error } = await supabase.from("crm_deals").update(toDealDB({ ...updates, id })).eq("id", id);
    if (error) {
      console.error("Error updating deal:", error);
      set({ deals: previousDeals });
      throw error;
    }

    if (updates.contactIds) {
      const dedupedContactIds = Array.from(new Set(updates.contactIds.filter(Boolean)));
      const { error: deleteError } = await supabase.from("crm_deal_contacts").delete().eq("deal_id", id);
      if (deleteError) {
        console.error("Error clearing deal contacts:", deleteError);
        set({ deals: previousDeals });
        throw deleteError;
      } else if (dedupedContactIds.length > 0) {
        const { error: insertError } = await supabase
          .from("crm_deal_contacts")
          .insert(dedupedContactIds.map((contactId) => ({ deal_id: id, contact_id: contactId })));
        if (insertError) {
          console.error("Error syncing deal contacts:", insertError);
          set({ deals: previousDeals });
          throw insertError;
        }
      }
    }
  },

  transferDealPipeline: async ({
    dealId,
    destinationPipelineId,
    destinationStage,
    fromPipelineName,
    toPipelineName,
    fromStageLabel,
    toStageLabel,
    reason,
    userName,
  }) => {
    const movementDate = new Date().toISOString();
    const trimmedReason = reason?.trim();
    const actionLines = [
      `transferiu a negociação do ${fromPipelineName} para o ${toPipelineName}.`,
      "",
      "Etapa anterior:",
      fromStageLabel,
      "",
      "Nova etapa:",
      toStageLabel,
    ];

    if (trimmedReason) {
      actionLines.push("", "Motivo:", trimmedReason);
    }

    const action = actionLines.join("\n");

    let previousDeals: Deal[] = [];
    set((state) => {
      previousDeals = state.deals;
      return {
        deals: state.deals.map((deal) =>
          deal.id === dealId
            ? {
                ...deal,
                pipelineId: destinationPipelineId,
                stage: destinationStage,
                updatedAt: movementDate,
                history: [...(deal.history || []), { id: crypto.randomUUID(), action, date: movementDate, userName }],
              }
            : deal,
        ),
      };
    });

    const { error: dealError } = await supabase
      .from("crm_deals")
      .update({
        pipeline_id: destinationPipelineId,
        stage: destinationStage,
        updated_at: movementDate,
      })
      .eq("id", dealId);

    if (dealError) {
      console.error("Error transferring deal pipeline:", dealError);
      set({ deals: previousDeals });
      throw dealError;
    }

    const { error: historyError } = await supabase.from("crm_deal_history").insert({
      deal_id: dealId,
      action,
      user_name: userName,
      date: movementDate,
    });

    if (historyError) {
      throwSupabaseError("Error registering pipeline transfer history:", historyError);
    }
  },

  moveDeal: async (id, stage, userName, stageLabel) => {
    const currentDeal = get().deals.find((deal) => deal.id === id);
    const movementDate = new Date();

    let previousDeals: Deal[] = [];
    set((state) => {
      previousDeals = state.deals;
      return {
        deals: state.deals.map((deal) => {
          if (deal.id !== id) return deal;
          const resolvedLabel = stageLabel || getStageLabel(stage);
          const action = userName ? `alterou a etapa para ${resolvedLabel}` : `Movido para etapa: ${resolvedLabel}`;
          return {
            ...deal,
            stage,
            updatedAt: new Date().toISOString(),
            history: [...(deal.history || []), { id: crypto.randomUUID(), action, date: new Date().toISOString(), userName }],
          };
        }),
      };
    });

    const resolvedLabel = stageLabel || getStageLabel(stage);
    const action = userName ? `alterou a etapa para ${resolvedLabel}` : `Movido para etapa: ${resolvedLabel}`;

    const { error: dealError } = await supabase.from("crm_deals").update({ stage, updated_at: movementDate.toISOString() }).eq("id", id);
    if (dealError) {
      console.error("Error moving deal:", dealError);
      set({ deals: previousDeals });
      throw dealError;
    }

    const { error: historyError } = await supabase.from("crm_deal_history").insert({ deal_id: id, action, user_name: userName, date: movementDate.toISOString() });
    throwSupabaseError("Error registering deal movement history:", historyError);

    if (!currentDeal) return;

    const automationResult = await runTaskAutomationsForStageChange(
      {
        ...currentDeal,
        stage,
      },
      stage,
      movementDate,
      resolvedLabel,
    );

    if (!automationResult.tasks.length) return;

    const automationAction = `Tarefas automáticas criadas ao entrar na etapa ${resolvedLabel}:\n\n- ${automationResult.taskTitles.join("\n- ")}`;

    set((state) => ({
      deals: state.deals.map((deal) =>
        deal.id === id
          ? {
              ...deal,
              tasks: [...(deal.tasks || []), ...automationResult.tasks],
              history: [
                ...(deal.history || []),
                {
                  id: crypto.randomUUID(),
                  action: automationAction,
                  date: movementDate.toISOString(),
                  userName,
                },
              ],
            }
          : deal,
      ),
    }));

    const { error: automationHistoryError } = await supabase.from("crm_deal_history").insert({
      deal_id: id,
      action: automationAction,
      user_name: userName,
      date: movementDate.toISOString(),
    });
    throwSupabaseError("Error registering automation history:", automationHistoryError);
  },

  setOutcome: async (id, outcome, lossReason?, lossDescription?, userName?) => {
    let previousDeals: Deal[] = [];
    set((state) => {
      previousDeals = state.deals;
      return {
        deals: state.deals.map((deal) => {
          if (deal.id !== id) return deal;
          const label = outcome === "won" ? "Ganha" : outcome === "lost" ? "Perdida" : "Reaberta";
          const reasonSuffix = outcome === "lost" && lossReason ? ` (Motivo: ${lossReason})` : "";
          const action = userName
            ? outcome === null
              ? "retomou a negociacao"
              : `marcou a negociacao como ${label}${reasonSuffix}`
            : `Negociacao marcada como: ${label}${reasonSuffix}`;
          return {
            ...deal,
            outcome,
            lossReason: lossReason || deal.lossReason,
            lossDescription: lossDescription ?? deal.lossDescription,
            updatedAt: new Date().toISOString(),
            history: [...(deal.history || []), { id: crypto.randomUUID(), action, date: new Date().toISOString(), userName }],
          };
        }),
      };
    });

    const label = outcome === "won" ? "Ganha" : outcome === "lost" ? "Perdida" : "Reaberta";
    const reasonSuffix = outcome === "lost" && lossReason ? ` (Motivo: ${lossReason})` : "";
    const action = userName
      ? outcome === null
        ? "retomou a negociacao"
        : `marcou a negociacao como ${label}${reasonSuffix}`
      : `Negociacao marcada como: ${label}${reasonSuffix}`;

    const updateObj: any = { outcome, updated_at: new Date().toISOString() };
    if (lossReason) updateObj.loss_reason = lossReason;
    if (lossDescription !== undefined) updateObj.loss_description = lossDescription;

    const { error: dealError } = await supabase.from("crm_deals").update(updateObj).eq("id", id);
    if (dealError) {
      console.error("Error updating deal outcome:", dealError);
      set({ deals: previousDeals });
      throw dealError;
    }

    const { error: historyError } = await supabase.from("crm_deal_history").insert({ deal_id: id, action, user_name: userName, date: new Date().toISOString() });
    throwSupabaseError("Error registering outcome history:", historyError);
  },

  removeDeal: async (id) => {
    const deletedAt = new Date().toISOString();
    let previousDeals: Deal[] = [];
    set((state) => {
      previousDeals = state.deals;
      return { deals: state.deals.filter((deal) => deal.id !== id) };
    });

    const { error } = await supabase.from("crm_deals").update({ deleted_at: deletedAt, updated_at: deletedAt }).eq("id", id);
    if (error) {
      console.error("Error deleting deal:", error);
      set({ deals: previousDeals });
      throw error;
    }
  },

  getDealByPhone: (phone) => get().deals.find((deal) => deal.phone === phone),

  addNote: async (id, note, userName?) => {
    const deal = get().deals.find((item) => item.id === id);
    if (!deal) return;

    const date = new Date().toISOString();
    const notes = [...(deal.notes || []), note];
    const action = userName ? "adicionou um comentário" : "Novo comentário adicionado";

    let previousDeals: Deal[] = [];
    set((state) => {
      previousDeals = state.deals;
      return {
      deals: state.deals.map((item) =>
        item.id === id
          ? {
              ...item,
              notes,
              history: [...(item.history || []), { id: crypto.randomUUID(), action, date, userName }],
            }
          : item,
      ),
      };
    });

    const { error: noteError } = await supabase.from("crm_deals").update({ notes }).eq("id", id);
    if (noteError) {
      console.error("Error adding deal note:", noteError);
      set({ deals: previousDeals });
      throw noteError;
    }

    const { error: historyError } = await supabase.from("crm_deal_history").insert({ deal_id: id, action, user_name: userName, date });
    throwSupabaseError("Error registering deal note history:", historyError);
  },

  addTask: async (dealId, task, userName?) => {
    const newId = crypto.randomUUID();
    const newTask: DealTask = {
      ...task,
      id: newId,
      status: task.status || "pending",
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const action = userName ? `criou a atividade: ${task.taskType || "Tarefa interna"} - ${task.title}` : `Atividade criada: ${task.taskType || "Tarefa interna"} - ${task.title}`;

    let previousDeals: Deal[] = [];
    set((state) => {
      previousDeals = state.deals;
      return {
      deals: state.deals.map((deal) =>
        deal.id === dealId
          ? { ...deal, tasks: [...(deal.tasks || []), newTask], history: [...(deal.history || []), { id: crypto.randomUUID(), action, date: newTask.createdAt, userName }] }
          : deal,
      ),
      };
    });

    const assigned = typeof task.assignedTo === "string" && task.assignedTo.length === 36 ? task.assignedTo : null;

    const { error: taskError } = await supabase.from("crm_tasks").insert({
      id: newId,
      deal_id: dealId,
      company_id: isUUID(task.companyId) ? task.companyId : null,
      title: task.title,
      description: task.description,
      due_date: task.dueDate,
      due_time: task.dueTime,
      assigned_to: assigned,
      task_type: task.taskType,
      status: newTask.status,
      completed: false,
      created_at: newTask.createdAt,
      updated_at: newTask.updatedAt,
    });

    if (taskError) {
      console.error("Error adding deal task:", taskError);
      set({ deals: previousDeals });
      throw taskError;
    }

    const { error: historyError } = await supabase.from("crm_deal_history").insert({ deal_id: dealId, action, user_name: userName, date: newTask.createdAt });
    throwSupabaseError("Error registering task creation history:", historyError);
  },

  editTask: async (dealId, taskId, updates, userName?) => {
    const currentDeal = get().deals.find((item) => item.id === dealId);
    const currentTask = currentDeal?.tasks?.find((task) => task.id === taskId);
    if (!currentDeal || !currentTask) return;

    const date = new Date().toISOString();
    const taskTitle = updates.title || currentTask.title;
    const action = userName ? `editou a tarefa: "${taskTitle}"` : `Tarefa editada: "${taskTitle}"`;

    let previousDeals: Deal[] = [];
    set((state) => {
      previousDeals = state.deals;
      return {
      deals: state.deals.map((deal) => {
        if (deal.id !== dealId) return deal;
        const updatedTasks = (deal.tasks || []).map((task) => (task.id === taskId ? { ...task, ...updates } : task));
        return {
          ...deal,
          tasks: updatedTasks,
          history: [...(deal.history || []), { id: crypto.randomUUID(), action, date, userName }],
        };
      }),
      };
    });

    const assigned = typeof updates.assignedTo === "string" && updates.assignedTo.length === 36 ? updates.assignedTo : undefined;
    const updateObj: any = {};
    if (updates.title !== undefined) updateObj.title = updates.title;
    if (updates.description !== undefined) updateObj.description = updates.description;
    if (updates.dueDate !== undefined) updateObj.due_date = updates.dueDate || null;
    if (updates.dueTime !== undefined) updateObj.due_time = updates.dueTime || null;
    if (updates.taskType !== undefined) updateObj.task_type = updates.taskType;
    if (updates.companyId !== undefined) updateObj.company_id = isUUID(updates.companyId) ? updates.companyId : null;
    if (updates.status !== undefined) updateObj.status = updates.status;
    if (updates.activityResult !== undefined) updateObj.activity_result = updates.activityResult || null;
    if (updates.resultNotes !== undefined) updateObj.result_notes = updates.resultNotes || null;
    if (updates.completedAt !== undefined) updateObj.completed_at = updates.completedAt || null;
    if (updates.completedBy !== undefined) updateObj.completed_by = updates.completedBy || null;
    if (updates.canceledAt !== undefined) updateObj.canceled_at = updates.canceledAt || null;
    if (updates.canceledBy !== undefined) updateObj.canceled_by = updates.canceledBy || null;
    if (assigned !== undefined) updateObj.assigned_to = assigned;
    updateObj.updated_at = new Date().toISOString();

    const { error: taskError } = await supabase.from("crm_tasks").update(updateObj).eq("id", taskId);
    if (taskError) {
      console.error("Error editing deal task:", taskError);
      set({ deals: previousDeals });
      throw taskError;
    }

    const { error: historyError } = await supabase.from("crm_deal_history").insert({ deal_id: dealId, action, user_name: userName, date });
    throwSupabaseError("Error registering task edit history:", historyError);
  },

  toggleTask: async (dealId, taskId, userName?) => {
    const currentDeal = get().deals.find((item) => item.id === dealId);
    const currentTask = currentDeal?.tasks?.find((task) => task.id === taskId);
    if (!currentDeal || !currentTask) return;

    const date = new Date().toISOString();
    const isCompleted = !currentTask.completed;
    const taskTitle = currentTask.title;
    const action = userName
      ? `${isCompleted ? "marcou" : "reabriu"} a tarefa "${taskTitle}" ${isCompleted ? "como concluída" : ""}`
      : `Tarefa ${isCompleted ? "concluída" : "reaberta"}: ${taskTitle}`;

    let previousDeals: Deal[] = [];
    set((state) => {
      previousDeals = state.deals;
      return {
      deals: state.deals.map((deal) => {
        if (deal.id !== dealId) return deal;
        const updatedTasks = (deal.tasks || []).map((task) => {
          if (task.id !== taskId) return task;
          return { ...task, completed: isCompleted, status: (isCompleted ? "completed" : "pending") as ActivityStatus };
        });
        return {
          ...deal,
          tasks: updatedTasks,
          history: [...(deal.history || []), { id: crypto.randomUUID(), action, date, userName }],
        };
      }),
      };
    });

    const { error: taskError } = await supabase.from("crm_tasks").update({ completed: isCompleted, status: isCompleted ? "completed" : "pending", updated_at: date }).eq("id", taskId);
    if (taskError) {
      console.error("Error toggling deal task:", taskError);
      set({ deals: previousDeals });
      throw taskError;
    }

    const { error: historyError } = await supabase.from("crm_deal_history").insert({ deal_id: dealId, action, user_name: userName, date });
    throwSupabaseError("Error registering task toggle history:", historyError);
  },

  completeTask: async (dealId, taskId, input, userName?) => {
    const currentDeal = get().deals.find((item) => item.id === dealId);
    const currentTask = currentDeal?.tasks?.find((task) => task.id === taskId);
    if (!currentDeal || !currentTask) return;

    const completedAt = new Date().toISOString();
    let completedTask: DealTask | undefined;

    let previousDeals: Deal[] = [];
    set((state) => {
      previousDeals = state.deals;
      return {
      deals: state.deals.map((deal) => {
        if (deal.id !== dealId) return deal;

        const updatedTasks = (deal.tasks || []).map((task) => {
          if (task.id !== taskId) return task;

          completedTask = {
            ...task,
            status: "completed",
            completed: true,
            activityResult: input.activityResult,
            resultNotes: input.resultNotes || undefined,
            completedAt,
            completedBy: userName,
            updatedAt: completedAt,
          };
          return completedTask;
        });

        const activity = completedTask;
        const action = activity
          ? `Atividade concluída: ${activity.taskType || "Tarefa interna"} - ${activity.title}\n\nResultado:\n${input.activityResult}\n\nObservação:\n${input.resultNotes?.trim() || "Sem observações."}\n\nResponsável:\n${userName || "Não informado"}`
          : "Atividade concluída";

        return {
          ...deal,
          tasks: updatedTasks,
          history: [...(deal.history || []), { id: crypto.randomUUID(), action, date: completedAt, userName }],
        };
      }),
      };
    });

    const action = completedTask
      ? `Atividade concluída: ${completedTask.taskType || "Tarefa interna"} - ${completedTask.title}\n\nResultado:\n${input.activityResult}\n\nObservação:\n${input.resultNotes?.trim() || "Sem observações."}\n\nResponsável:\n${userName || "Não informado"}`
      : "Atividade concluída";

    const { error: taskError } = await supabase
      .from("crm_tasks")
      .update({
        status: "completed",
        completed: true,
        activity_result: input.activityResult,
        result_notes: input.resultNotes?.trim() || null,
        completed_at: completedAt,
        completed_by: userName || null,
        updated_at: completedAt,
      })
      .eq("id", taskId);

    if (taskError) {
      console.error("Error completing deal task:", taskError);
      set({ deals: previousDeals });
      throw taskError;
    }

    const { error: historyError } = await supabase.from("crm_deal_history").insert({ deal_id: dealId, action, user_name: userName, date: completedAt });
    throwSupabaseError("Error registering task completion history:", historyError);
  },

  cancelTask: async (dealId, taskId, userName?) => {
    const currentDeal = get().deals.find((item) => item.id === dealId);
    const currentTask = currentDeal?.tasks?.find((task) => task.id === taskId);
    if (!currentDeal || !currentTask) return;

    const canceledAt = new Date().toISOString();
    const taskTitle = `${currentTask.taskType || "Tarefa interna"} - ${currentTask.title}`;
    const action = `Atividade cancelada: ${taskTitle}`;

    let previousDeals: Deal[] = [];
    set((state) => {
      previousDeals = state.deals;
      return {
      deals: state.deals.map((deal) => {
        if (deal.id !== dealId) return deal;
        const updatedTasks = (deal.tasks || []).map((task) => {
          if (task.id !== taskId) return task;
          return { ...task, status: "cancelled" as ActivityStatus, completed: false, canceledAt, canceledBy: userName, updatedAt: canceledAt };
        });
        return {
          ...deal,
          tasks: updatedTasks,
          history: [...(deal.history || []), { id: crypto.randomUUID(), action, date: canceledAt, userName }],
        };
      }),
      };
    });

    const { error: taskError } = await supabase
      .from("crm_tasks")
      .update({
        status: "cancelled",
        completed: false,
        canceled_at: canceledAt,
        canceled_by: userName || null,
        updated_at: canceledAt,
      })
      .eq("id", taskId);

    if (taskError) {
      console.error("Error cancelling deal task:", taskError);
      set({ deals: previousDeals });
      throw taskError;
    }

    const { error: historyError } = await supabase.from("crm_deal_history").insert({ deal_id: dealId, action, user_name: userName, date: canceledAt });
    throwSupabaseError("Error registering task cancellation history:", historyError);
  },

  addHistoryEvent: async (dealId, action, userName?) => {
    const currentDeal = get().deals.find((item) => item.id === dealId);
    if (!currentDeal) return;

    const newId = crypto.randomUUID();
    const date = new Date().toISOString();

    let previousDeals: Deal[] = [];
    set((state) => {
      previousDeals = state.deals;
      return {
      deals: state.deals.map((deal) =>
        deal.id === dealId ? { ...deal, history: [...(deal.history || []), { id: newId, action, date, userName }] } : deal,
      ),
      };
    });

    const { error: historyError } = await supabase.from("crm_deal_history").insert({ id: newId, deal_id: dealId, action, user_name: userName, date });
    if (historyError) {
      console.error("Error adding deal history event:", historyError);
      set({ deals: previousDeals });
      throw historyError;
    }
  },
}));
