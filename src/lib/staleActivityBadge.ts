export const STALE_ACTIVITY_LABEL = "Sem atividade há 7+ dias";

/**
 * Cabe nome + selo por extenso + o que vem depois (selo de tarefas) numa linha só?
 * `fullWidth` é a largura natural de nome + selo por extenso, medida numa cópia invisível sem quebra.
 */
export function staleBadgeFits(input: { available: number; fullWidth: number; trailingWidth: number | null; gap: number }) {
  const { available, fullWidth, trailingWidth, gap } = input;
  // `null` = não há nada depois do selo; com o contêiner presente o flex conta o gap mesmo vazio.
  const needed = fullWidth + (trailingWidth === null ? 0 : gap + trailingWidth);
  return needed <= available;
}
