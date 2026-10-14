export type BantCriterionKey = "need" | "budget" | "authority" | "timeline";

export type LeadClassification =
  | "Lead Prioritário"
  | "Lead Qualificado"
  | "Lead Nutrição"
  | "Lead Descartado";

/** Observação livre por critério — opcional, e nunca entra na pontuação. */
export type BantNotes = Partial<Record<BantCriterionKey, string>>;

export interface BantQualification {
  need: number;
  budget: number;
  authority: number;
  timeline: number;
  notes?: BantNotes;
}

export const EMPTY_BANT_QUALIFICATION: BantQualification = {
  need: 0,
  budget: 0,
  authority: 0,
  timeline: 0,
  notes: {},
};

/** Uma linha curta: o mesmo JSONB é espelhado em todos os contatos da negociação. */
export const BANT_NOTE_MAX_LENGTH = 100;

export const BANT_CRITERION_KEYS: BantCriterionKey[] = ["need", "budget", "authority", "timeline"];

export const BANT_CRITERIA: Array<{
  key: BantCriterionKey;
  title: string;
  questions: string[];
  options: Array<{ value: number; label: string }>;
}> = [
  {
    key: "need",
    title: "Necessidade",
    questions: [
      "Qual problema você está tentando resolver?",
      "Há quanto tempo isso é uma necessidade?",
      "Como esse cenário afeta sua operação?",
    ],
    options: [
      { value: 5, label: "5 - Crítica" },
      { value: 3, label: "3 - Importante" },
      { value: 1, label: "1 - Oportunidade" },
      { value: 0, label: "0 - Não informado" },
    ],
  },
  {
    key: "budget",
    title: "Base Orçamentária",
    questions: [
      "Existe orçamento previsto?",
      "Existe planejamento de investimento?",
      "Como a empresa realiza essas compras?",
    ],
    options: [
      { value: 5, label: "5 - Alto" },
      { value: 3, label: "3 - Médio" },
      { value: 1, label: "1 - Baixo" },
      { value: 0, label: "0 - Não informado" },
    ],
  },
  {
    key: "authority",
    title: "Autoridade",
    questions: [
      "Quem aprova esse tipo de compra?",
      "Além de você existe outro decisor?",
    ],
    options: [
      { value: 5, label: "5 - Decisor" },
      { value: 3, label: "3 - Influenciador" },
      { value: 1, label: "1 - Usuário" },
      { value: 0, label: "0 - Não informado" },
    ],
  },
  {
    key: "timeline",
    title: "Tempo",
    questions: [
      "Quando pretende resolver?",
      "Existe data limite?",
    ],
    options: [
      { value: 5, label: "5 - Urgente (0-30 dias)" },
      { value: 3, label: "3 - Médio (30-90 dias)" },
      { value: 1, label: "1 - Longo prazo (+90 dias)" },
      { value: 0, label: "0 - Não informado" },
    ],
  },
];

/**
 * Só as quatro chaves conhecidas, só string, sem espaço sobrando e sem vazio.
 *
 * O valor vem de `qualification_bant`, um JSONB livre: pode chegar com chave que não existe mais,
 * com número onde devia haver texto, ou nulo. Normalizar aqui evita que a tela quebre por causa de
 * um registro antigo.
 */
export const normalizeBantNotes = (value?: unknown): BantNotes => {
  if (!value || typeof value !== "object") return {};
  const bruto = value as Record<string, unknown>;

  return BANT_CRITERION_KEYS.reduce<BantNotes>((acc, key) => {
    const nota = bruto[key];
    if (typeof nota !== "string") return acc;
    const limpo = nota.trim().slice(0, BANT_NOTE_MAX_LENGTH);
    if (limpo) acc[key] = limpo;
    return acc;
  }, {});
};

export const normalizeBantQualification = (value?: Partial<BantQualification> | null): BantQualification => ({
  need: Number(value?.need) || 0,
  budget: Number(value?.budget) || 0,
  authority: Number(value?.authority) || 0,
  timeline: Number(value?.timeline) || 0,
  notes: normalizeBantNotes(value?.notes),
});

export const calculateBantScore = (value?: Partial<BantQualification> | null) => {
  const qualification = normalizeBantQualification(value);
  return qualification.need + qualification.budget + qualification.authority + qualification.timeline;
};

export const classifyLead = (score: number): LeadClassification => {
  if (score >= 16) return "Lead Prioritário";
  if (score >= 12) return "Lead Qualificado";
  if (score >= 4) return "Lead Nutrição";
  return "Lead Descartado";
};

export const getQualificationNextActions = (classification?: string) => {
  switch (classification) {
    case "Lead Prioritário":
      return ["Agendar visita em até 7 dias", "Enviar proposta em até 48h"];
    case "Lead Qualificado":
      return ["Apresentação comercial", "Visita em até 15 dias"];
    case "Lead Nutrição":
      return ["Follow-up mensal", "Revisão futura da qualificação"];
    case "Lead Descartado":
      return ["Encerrar oportunidade"];
    default:
      return [];
  }
};

export const isQualificationComplete = (completedAt?: string | null) => Boolean(completedAt);
