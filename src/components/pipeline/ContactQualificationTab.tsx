import { useState } from "react";
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { CRMContact } from "@/lib/crmContactsStore";
import {
  BANT_CRITERIA,
  BANT_NOTE_MAX_LENGTH,
  calculateBantScore,
  classifyLead,
  getQualificationNextActions,
  normalizeBantQualification,
  type BantCriterionKey,
} from "@/lib/leadQualification";
import { toast } from "sonner";

interface Props {
  contact: CRMContact;
  userName: string;
  onUpdateContact: (id: string, updates: Partial<CRMContact>) => Promise<void>;
}

export function ContactQualificationTab({ contact, userName, onUpdateContact }: Props) {
  const [form, setForm] = useState(() => normalizeBantQualification(contact.qualificationBant));
  const [saving, setSaving] = useState(false);
  const score = calculateBantScore(form);
  const classification = classifyLead(score);
  const requalification = Boolean(contact.qualificationCompletedAt);

  const handleNoteChange = (key: BantCriterionKey, value: string) => {
    setForm((current) => ({
      ...current,
      notes: { ...(current.notes || {}), [key]: value.slice(0, BANT_NOTE_MAX_LENGTH) },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await onUpdateContact(contact.id, {
        qualificationBant: form,
        qualificationScore: score,
        qualificationClassification: classification,
        qualificationCompletedAt: new Date().toISOString(),
        qualificationResponsible: userName,
      });
      toast.success(requalification ? "Lead requalificado." : "Lead qualificado.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar qualificação.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 px-4 pb-8 pt-6 sm:px-6 xl:px-8">
      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {BANT_CRITERIA.map((criterion) => (
            <div key={criterion.key} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-base font-semibold">{criterion.title}</h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {criterion.questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </div>
                <div className="w-full md:w-64">
                  <Label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">Pontuação</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form[criterion.key]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [criterion.key as BantCriterionKey]: Number(event.target.value) || 0,
                      }))
                    }
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
                  htmlFor={`contact-bant-note-${criterion.key}`}
                  className="mb-2 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground"
                >
                  <span>Observação</span>
                  <span className="font-normal normal-case">
                    {(form.notes?.[criterion.key] || "").length}/{BANT_NOTE_MAX_LENGTH}
                  </span>
                </Label>
                <Input
                  id={`contact-bant-note-${criterion.key}`}
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
                <p className="text-xs font-semibold uppercase text-muted-foreground">Pontuação total</p>
                <p className="text-3xl font-bold">{score}/20</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Classificação</p>
                <p className="text-lg font-bold">{classification}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Próxima ação sugerida</p>
                <div className="mt-2 space-y-1">
                  {getQualificationNextActions(classification).map((action) => (
                    <p key={action} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      {action}
                    </p>
                  ))}
                </div>
              </div>
              {contact.qualificationCompletedAt && (
                <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Última qualificação em {new Date(contact.qualificationCompletedAt).toLocaleString("pt-BR")} por{" "}
                  {contact.qualificationResponsible || "Responsável não informado"}.
                </div>
              )}
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="w-full gap-2">
            {requalification ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Salvando..." : requalification ? "Requalificar Lead" : "Concluir Qualificação"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
