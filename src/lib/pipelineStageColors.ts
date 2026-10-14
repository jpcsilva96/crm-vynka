export const DEFAULT_STAGE_COLOR = "#94A3B8";

export const STAGE_COLOR_PALETTE = [
  { label: "Cinza", value: "#94A3B8" },
  { label: "Azul", value: "#3B82F6" },
  { label: "Roxo", value: "#8B5CF6" },
  { label: "Rosa", value: "#EC4899" },
  { label: "Vermelho", value: "#EF4444" },
  { label: "Laranja", value: "#F97316" },
  { label: "Amarelo", value: "#F59E0B" },
  { label: "Verde", value: "#10B981" },
  { label: "Ciano", value: "#06B6D4" },
] as const;

const STAGE_COLOR_DEFAULTS: Array<{ matches: string[]; color: string }> = [
  { matches: ["lead_ia", "leads", "lead", "novo lead"], color: "#3B82F6" },
  { matches: ["contact_started", "contato", "contact"], color: "#EC4899" },
  { matches: ["qualification", "qualificacao", "qualificação", "qual"], color: "#06B6D4" },
  { matches: ["proposal", "proposta", "prop"], color: "#8B5CF6" },
  { matches: ["negotiation", "negociacao", "negociação", "neg"], color: "#F97316" },
  { matches: ["closing", "fechamento", "closing"], color: "#10B981" },
  { matches: ["won", "ganho"], color: "#10B981" },
  { matches: ["lost", "perdido"], color: "#EF4444" },
];

const isHexColor = (value?: string | null) => typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());

const normalizeHex = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 4) {
    const [hash, r, g, b] = trimmed;
    return `${hash}${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  return trimmed.toUpperCase();
};

const hashText = (value: string) =>
  value.split("").reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);

export const getDefaultStageColor = (stageId?: string | null, label?: string | null, index = 0) => {
  const reference = `${stageId || ""} ${label || ""}`.toLowerCase();
  const matched = STAGE_COLOR_DEFAULTS.find((entry) => entry.matches.some((token) => reference.includes(token)));

  if (matched) return matched.color;

  const palette = STAGE_COLOR_PALETTE.map((item) => item.value);
  if (!reference.trim()) return palette[index % palette.length] || DEFAULT_STAGE_COLOR;

  const hashedIndex = Math.abs(hashText(reference)) % palette.length;
  return palette[hashedIndex] || DEFAULT_STAGE_COLOR;
};

export const normalizeStageColor = (color?: string | null, stageId?: string | null, label?: string | null, index = 0) =>
  isHexColor(color) ? normalizeHex(color) : getDefaultStageColor(stageId, label, index);

export const hexToRgba = (hex: string, alpha: number) => {
  const normalized = normalizeHex(normalizeStageColor(hex));
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};
