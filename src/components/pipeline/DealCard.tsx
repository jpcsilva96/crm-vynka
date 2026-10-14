import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MouseEvent } from "react";
import type { Deal } from "@/lib/dealsStore";
import { getQualificationBadgeTone } from "@/lib/qualificationBadge";
import { ALL_STAGES } from "@/lib/dealsStore";
import { AlertTriangle, Briefcase, Copy, FileText, Phone, Plus, Sparkles, Trophy, User, XCircle } from "lucide-react";
import { useUsersStore } from "@/lib/usersStore";
import { useCRMCompaniesStore } from "@/lib/crmCompaniesStore";
import { useCRMContactsStore } from "@/lib/crmContactsStore";
import { classifyLead } from "@/lib/leadQualification";
import { cn } from "@/lib/utils";
import { hexToRgba, normalizeStageColor } from "@/lib/pipelineStageColors";
import { toast } from "sonner";
import { TaskAttentionBadge } from "./TaskAttentionBadge";

export interface CardVisibleFields {
  contactName: boolean;
  phone: boolean;
  document: boolean;
  dealName: boolean;
  dealCode: boolean;
  value: boolean;
  stage: boolean;
  outcome: boolean;
  assignedTo: boolean;
  companyName: boolean;
  email: boolean;
}

export const DEFAULT_CARD_FIELDS: CardVisibleFields = {
  contactName: true,
  phone: true,
  document: false,
  dealName: false,
  // Ligado por padrão: o código já aparecia no card antes de virar opção.
  dealCode: true,
  value: true,
  stage: false,
  outcome: true,
  assignedTo: false,
  companyName: false,
  email: false,
};

export const CARD_FIELD_LABELS: Record<keyof CardVisibleFields, string> = {
  contactName: "Nome do Contato",
  phone: "Telefone",
  document: "CPF/CNPJ",
  dealName: "Nome da Negociação",
  dealCode: "Código da Negociação (VYN-00)",
  value: "Valor",
  stage: "Etapa do Funil",
  outcome: "Resultado (Ganho/Perdido)",
  assignedTo: "Responsável",
  companyName: "Empresa",
  email: "Email",
};

export function CardCopyButton({ value, label }: { value?: string; label: string }) {
  if (!value) return null;

  const handleCopy = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} copiado.`),
      () => toast.error(`Não foi possível copiar ${label.toLowerCase()}.`),
    );
  };

  return (
    <button
      type="button"
      aria-label={`Copiar ${label}`}
      title={`Copiar ${label}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={handleCopy}
      className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

interface Props {
  deal: Deal;
  onClick: (deal: Deal) => void;
  onCreateActivity?: (deal: Deal) => void;
  visibleFields?: CardVisibleFields;
  stageColor?: string;
  hasOverdueClosingDate?: boolean;
  hasStaleActivity?: boolean;
  /** Tarefas pendentes atrasadas e de hoje (selo; ver `dealTaskAttention.ts`). */
  overdueTaskCount?: number;
  todayTaskCount?: number;
  /** Atalho do selo de tarefas; sem ele o selo só informa. */
  onOpenTasks?: (deal: Deal) => void;
}

export function DealCard({
  deal,
  onClick,
  onCreateActivity,
  visibleFields = DEFAULT_CARD_FIELDS,
  stageColor,
  hasOverdueClosingDate = false,
  hasStaleActivity = false,
  overdueTaskCount = 0,
  todayTaskCount = 0,
  onOpenTasks,
}: Props) {
  const users = useUsersStore((state) => state.users);
  const companies = useCRMCompaniesStore((state) => state.companies);
  const contacts = useCRMContactsStore((state) => state.contacts);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { type: "deal", deal, stageId: deal.stage },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatValue = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const vf = visibleFields;
  const resolvedStageColor = normalizeStageColor(stageColor, deal.stage, deal.dealName || deal.contactName);
  const linkedCompany = companies.find((company) => company.id === deal.companyId);
  const companyName = deal.companyName || linkedCompany?.name;
  const isCompanyDeal = deal.personType === "Juridica" || !!deal.companyId;
  const displayName = isCompanyDeal ? companyName || deal.contactName || deal.phone : deal.contactName || deal.phone;
  const primaryContact = (deal.primaryContactId ? contacts.find((contact) => contact.id === deal.primaryContactId) : null)
    || (deal.contactId ? contacts.find((contact) => contact.id === deal.contactId) : null)
    || (deal.contactIds || []).map((id) => contacts.find((contact) => contact.id === id)).find(Boolean)
    || null;
  const displayPhone = primaryContact?.phone || deal.phone;
  const cpf = deal.personType === "Fisica" ? deal.cpf || primaryContact?.cpf : undefined;
  const cnpj = deal.personType === "Juridica" || deal.companyId ? deal.cnpj || linkedCompany?.cnpj : undefined;
  const qualificationScore = isCompanyDeal
    ? primaryContact?.qualificationScore
    : typeof deal.qualificationScore === "number"
      ? deal.qualificationScore
      : primaryContact?.qualificationScore;
  const qualificationLabel = isCompanyDeal
    ? primaryContact?.qualificationClassification || (typeof qualificationScore === "number" ? classifyLead(qualificationScore) : undefined)
    : deal.qualificationClassification || primaryContact?.qualificationClassification || (typeof qualificationScore === "number" ? classifyLead(qualificationScore) : undefined);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(deal)}
      className={`relative space-y-3.5 rounded-xl border bg-card p-4 shadow-sm transition-[transform,box-shadow,border-color] duration-200 select-none cursor-grab active:cursor-grabbing motion-reduce:transform-none hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_18px_34px_-24px_hsl(var(--primary)/0.45)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 motion-reduce:animate-none ${
        !isDragging ? "animate-card-settle" : ""
      } border-border ${hasOverdueClosingDate ? "border-red-300 shadow-[0_18px_34px_-24px_rgba(239,68,68,0.45)]" : ""}`}
    >
      {hasStaleActivity && (
        <div className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700" title="Sem atividade ha mais de 7 dias">
          <AlertTriangle className="h-4 w-4" />
        </div>
      )}

      <span
        className="absolute bottom-3 left-0 top-3 w-1 rounded-r-full"
        style={{ backgroundColor: hexToRgba(resolvedStageColor, 0.88) }}
      />

      {/* Código da negociação: texto discreto no canto superior esquerdo, sem selo (pedido do
          operador em 23/09/2026 para reduzir a poluição visual do card). */}
      {vf.dealCode && deal.dealCode ? (
        <div data-testid="deal-card-code" className={cn("!mt-0 -mb-2 flex items-center gap-0.5 text-[11px] font-medium leading-none text-muted-foreground", hasStaleActivity && "pr-10")}>
          <span className="truncate tabular-nums">{deal.dealCode}</span>
          <CardCopyButton value={deal.dealCode} label="ID da negociação" />
        </div>
      ) : null}

      {(vf.contactName || vf.phone) && (
        <div className={cn("space-y-1.5", hasStaleActivity && "pr-10")}>
          {vf.contactName && (
            <p className="line-clamp-2 break-words text-[15px] font-semibold leading-5 text-foreground">{displayName}</p>
          )}
          {qualificationLabel && (
            <div className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getQualificationBadgeTone(qualificationLabel)}`}>
              <Sparkles className="h-3 w-3 shrink-0" />
              <span className="truncate">{qualificationLabel}</span>
              {qualificationScore !== undefined && <span className="shrink-0 opacity-80">{qualificationScore}/20</span>}
            </div>
          )}
          {(overdueTaskCount > 0 || todayTaskCount > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            <TaskAttentionBadge
              overdueCount={overdueTaskCount}
              todayCount={todayTaskCount}
              onOpen={onOpenTasks ? () => onOpenTasks(deal) : undefined}
            />
          </div>
          )}
          {vf.phone && displayPhone && (
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground/80">
              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="break-all">{displayPhone}</p>
              <CardCopyButton value={displayPhone} label="Telefone" />
            </div>
          )}
          {vf.document && cpf && (
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="shrink-0">CPF</span>
              <p className="break-all text-foreground/80">{cpf}</p>
              <CardCopyButton value={cpf} label="CPF" />
            </div>
          )}
          {vf.document && cnpj && (
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              <span className="shrink-0">CNPJ</span>
              <p className="break-all text-foreground/80">{cnpj}</p>
              <CardCopyButton value={cnpj} label="CNPJ" />
            </div>
          )}
        </div>
      )}

      {vf.dealName && deal.dealName && (
        <p className="line-clamp-2 break-words text-xs leading-5 text-muted-foreground">Negociação: {deal.dealName}</p>
      )}

      {vf.companyName && companyName && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Briefcase className="h-3 w-3 shrink-0" />
          <span className="line-clamp-2 break-words">{companyName}</span>
        </div>
      )}

      {vf.email && deal.email && <p className="break-all text-[11px] text-muted-foreground">{deal.email}</p>}

      {vf.assignedTo && deal.assignedTo && (() => {
        const user = users.find((item) => item.id === deal.assignedTo);
        return (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="line-clamp-2 break-words">{user?.name || "Responsável"}</span>
          </div>
        );
      })()}

      {vf.value && <p className="text-base font-bold tracking-tight text-primary">{formatValue(deal.value)}</p>}

      {vf.stage && (
        <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {ALL_STAGES.find((stage) => stage.id === deal.stage)?.label || deal.stage}
        </span>
      )}

      {vf.outcome && deal.outcome && (
        <div
          className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            deal.outcome === "won" ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"
          }`}
        >
          {deal.outcome === "won" ? <Trophy className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {deal.outcome === "won" ? "Ganho" : "Perdido"}
        </div>
      )}

      {onCreateActivity && (
        <button
          type="button"
          aria-label="Incluir atividade"
          title="Incluir atividade"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onCreateActivity(deal);
          }}
          className="absolute bottom-3 right-3 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary transition-colors hover:bg-primary/15"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}

    </div>
  );
}
