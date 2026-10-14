// Lógica pura das listas de Segmento e Cargo. O acesso ao banco fica em `optionListsStore.ts`;
// aqui mora só o que dá para testar sem rede — e é aqui que estão as duas armadilhas do desenho.

export type OptionKind = "segment" | "contact_role";

export const OPTION_KINDS: OptionKind[] = ["segment", "contact_role"];

export interface OptionItem {
  id: string;
  kind: OptionKind;
  label: string;
  position: number;
  isActive: boolean;
}

/**
 * Normalização da chave de duplicidade.
 *
 * Espelha `lower(btrim(label))` do índice único. `btrim` do SQL remove APENAS espaço (U+0020);
 * o `.trim()` do JavaScript remove todo whitespace Unicode. Usar o `.trim()` aqui faria a tela
 * aceitar um rótulo que o banco depois recusa — ou pior, considerar iguais dois rótulos que o
 * banco tem como distintos. A regra é a do SQL (RULES.md, armadilhas do ambiente).
 */
export const normalizeOptionLabel = (label: string): string =>
  label.replace(/^ +| +$/g, "").toLowerCase();

/** Rótulo como ele é gravado: sem espaço nas pontas, preservando o resto. */
export const cleanOptionLabel = (label: string): string => label.replace(/^ +| +$/g, "");

export const isDuplicateLabel = (label: string, existing: OptionItem[], ignoreId?: string): boolean => {
  const chave = normalizeOptionLabel(label);
  return existing.some((item) => item.id !== ignoreId && normalizeOptionLabel(item.label) === chave);
};

/** Opções oferecidas para NOVA escolha: só as ativas, na ordem cadastrada. */
export const activeOptions = (items: OptionItem[]): OptionItem[] =>
  items.filter((item) => item.isActive).sort((a, b) => a.position - b.position || a.label.localeCompare(b.label, "pt-BR"));

/**
 * Opções de um campo que já tem valor gravado.
 *
 * Desativar uma opção NÃO apaga o valor já gravado (decisão 13) — mas se o campo não oferecer
 * esse valor, abrir o registro para editar mostra o campo vazio e salvar apaga o cargo em
 * silêncio. Foi exatamente assim que o campo CNPJ da negociação perdia dado (lote 2). Por isso o
 * valor atual entra na lista, no fim, mesmo que esteja desativado ou nunca tenha existido.
 */
export const labelsWithCurrent = (labels: string[], current?: string | null): string[] => {
  const atual = cleanOptionLabel(current || "");
  if (!atual) return labels;
  const jaTem = labels.some((label) => normalizeOptionLabel(label) === normalizeOptionLabel(atual));
  return jaTem ? labels : [...labels, atual];
};

export const optionsWithCurrentValue = (items: OptionItem[], current?: string | null): string[] =>
  labelsWithCurrent(activeOptions(items).map((item) => item.label), current);

/** Posições recalculadas em sequência, para gravar depois de arrastar. */
export const reorderedPositions = (items: OptionItem[], orderedIds: string[]): { id: string; position: number }[] =>
  orderedIds
    .map((id, index) => ({ id, position: index + 1 }))
    .filter(({ id }) => items.some((item) => item.id === id));
