import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { CRMContact } from "@/lib/crmContactsStore";
import type { Deal } from "@/lib/dealsStore";
import {
  BANT_CRITERIA,
  BANT_NOTE_MAX_LENGTH,
  calculateBantScore,
  classifyLead,
  getQualificationNextActions,
  normalizeBantQualification,
  type BantQualification,
  type BantCriterionKey,
} from "@/lib/leadQualification";

interface Props {
  deal: Deal;
  contacts: CRMContact[];
  userName: string;
  onUpdateDeal: (id: string, updates: Partial<Deal>) => Promise<void>;
  onUpdateContact: (id: string, updates: Partial<CRMContact>) => Promise<void>;
  onRegisterHistory: (dealId: string, action: string, userName?: string) => Promise<void>;
}

export function DealQualificationTab({
  deal,
  contacts,
  userName,
  onUpdateDeal,
  onUpdateContact,
  onRegisterHistory,
}: Props) {
  const inheritedQualification = useMemo(
    () => contacts.find((contact) => contact.qualificationCompletedAt),
    [contacts],
  );

  const initialQualification = normalizeBantQualification(
    deal.qualificationBant || inheritedQualification?.qualificationBant,
  );
  const [form, setForm] = useState<BantQualification>(initialQualification);
  const [isSaving, setIsSaving] = useState(false);

  const score = calculateBantScore(form);
  const classification = classifyLead(score);
  const nextActions = getQualificationNextActions(classification);
  const previousClassification = deal.qualificationClassification || inheritedQualification?.qualificationClassification;
  const isRequalification = Boolean(deal.qualificationCompletedAt);

  const handleChange = (key: BantCriterionKey, value: string) => {
    setForm((current) => ({ ...current, [key]: Number(value) || 0 }));
  };

  const handleNoteChange = (key: BantCriterionKey, value: string) => {
    setForm((current) => ({
      ...current,
      notes: { ...(current.notes || {}), [key]: value.slice(0, BANT_NOTE_MAX_LENGTH) },
    }));
  };

  const handleSave = async () => {
    const completedAt = new Date().toISOString();
    const updates = {
      qualification: classification,
      qualificationBant: form,
      qualificationScore: score,
      qualificationClassification: classification,
      qualificationCompletedAt: completedAt,
      qualificationResponsible: userName,
    };

    setIsSaving(true);
    try {
      await onUpdateDeal(deal.id, updates);
      await Promise.all(
        contacts.map((contact) =>
          onUpdateContact(contact.id, {
            qualificationBant: form,
            qualificationScore: score,
            qualificationClassification: classification,
            qualificationCompletedAt: completedAt,
            qualificationResponsible: userName,
          }),
        ),
      );

      if (isRequalification && previousClassification && previousClassification !== classification) {
        await onRegisterHistory(
          deal.id,
          `Classificação alterada.\n\nAnterior:\n${previousClassification}\n\nAtual:\n${classification}`,
          userName,
        );
      }

      await onRegisterHistory(
        deal.id,
        `Lead qualificado.\n\nPontuação:\n${score}/20\n\nClassificação:\n${classification}\n\nResponsável:\n${userName}\n\nData:\n${format(new Date(completedAt), "dd/MM/yyyy", { locale: ptBR })}`,
        userName,
      );

      toast.success(isRequalification ? "Lead requalificado." : "Lead qualificado.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar qualificação.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 px-4 pb-8 sm:px-6 xl:px-8">
      {inheritedQualification && !deal.qualificationCompletedAt && (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
          Última qualificação encontrada no contato: {inheritedQualification.qualificationClassification}{" "}
          ({inheritedQualification.qualificationScore}/20).
        </div>
      )}

      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {BANT_CRITERIA.map((criterion) => (
            <div key={criterion.key} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{criterion.title}</h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {criterion.questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </div>
                <div className="w-full md:w-64">
                  <Label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">Pontuação</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form[criterion.key]}
                    onChange={(event) => handleChange(criterion.key, event.target.value)}
                  >
                    {criterion.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <Label
                  htmlFor={`bant-note-${criterion.key}`}
                  className="mb-2 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground"
                >
                  <span>Observação</span>
                  <span className="font-normal normal-case">
                    {(form.notes?.[criterion.key] || "").length}/{BANT_NOTE_MAX_LENGTH}
                  </span>
                </Label>
                <Input
                  id={`bant-note-${criterion.key}`}
                  value={form.notes?.[criterion.key] || ""}
                  onChange={(event) => handleNoteChange(criterion.key, event.target.value)}
                  maxLength={BANT_NOTE_MAX_LENGTH}
                  placeholder={`O que o cliente disse sobre ${criterion.title.toLowerCase()}`}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Resumo da Qualificação
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Pontuação Total</p>
                <p className="text-3xl font-bold text-foreground">{score}/20</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Classificação</p>
                <p className="text-lg font-bold text-foreground">{classification}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Próxima ação sugerida</p>
                <div className="mt-2 space-y-1">
                  {nextActions.map((action) => (
                    <p key={action} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      {action}
                    </p>
                  ))}
                </div>
              </div>
              {deal.qualificationCompletedAt && (
                <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Última qualificação em{" "}
                  {format(new Date(deal.qualificationCompletedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })} por{" "}
                  {deal.qualificationResponsible || "Responsável não informado"}.
                </div>
              )}
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
            {isRequalification ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {isSaving ? "Salvando..." : isRequalification ? "Requalificar Lead" : "Concluir Qualificação"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
