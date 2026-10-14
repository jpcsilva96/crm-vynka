import { Phone, MessageSquare, Mail, Users, User, Clock, ClipboardCheck, UtensilsCrossed } from "lucide-react";

export const ACTIVITY_TYPES = ["Ligação", "WhatsApp", "E-mail", "Reunião", "Visita", "Follow-up", "Tarefa interna"];

export const ACTIVITY_TYPE_META = {
  "Ligação": { label: "Ligação", icon: Phone },
  "WhatsApp": { label: "WhatsApp", icon: MessageSquare },
  "E-mail": { label: "E-mail", icon: Mail },
  "Reunião": { label: "Reunião", icon: Users },
  "Visita": { label: "Visita", icon: User },
  "Follow-up": { label: "Follow-up", icon: Clock },
  "Tarefa interna": { label: "Tarefa interna", icon: ClipboardCheck },
  "Tarefa": { label: "Tarefa", icon: ClipboardCheck },
  "Almoço": { label: "Almoço", icon: UtensilsCrossed },
} as const;

export function getActivityTypeMeta(taskType?: string) {
  if (!taskType) return ACTIVITY_TYPE_META["Tarefa interna"];
  return ACTIVITY_TYPE_META[taskType as keyof typeof ACTIVITY_TYPE_META] ?? ACTIVITY_TYPE_META["Tarefa interna"];
}

export const ACTIVITY_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2).toString().padStart(2, "0");
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour}:${minute}`;
});

export function createActivityDateISO(dateStr: string, timeStr?: string) {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  if (timeStr) {
    const [h, m] = timeStr.split(":");
    d.setHours(Number(h), Number(m), 0, 0);
  } else {
    d.setHours(12, 0, 0, 0);
  }
  return d.toISOString();
}

// Resultado ao concluir e nome do responsável: usados pelos diálogos de tarefa (detalhes e atalho do card).
export const ACTIVITY_RESULTS = [
  "Cliente não atendeu",
  "Cliente pediu retorno",
  "Cliente interessado",
  "Cliente sem interesse",
  "Aguardando análise do cliente",
  "Proposta enviada",
  "Negociação avançou",
  "Outro",
];

export const getTaskResponsibleName = (users: { id: string; name: string }[], assignedTo?: string | string[]) => {
  const value = Array.isArray(assignedTo) ? assignedTo[0] : assignedTo;
  if (!value) return "Sem responsável";
  return users.find((user) => user.id === value)?.name || value;
};
