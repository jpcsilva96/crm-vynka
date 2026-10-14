/**
 * Casamento de texto para as barras de busca do CRM (contatos, empresas, negociações).
 *
 * Existe porque documento e telefone são gravados COM máscara: 155 dos 156 CNPJs em produção
 * estão como "00.000.000/0000-00". Quem digita só os dígitos não achava nada, e quem digita com
 * máscara só acha se acertar a pontuação. Aqui os campos numéricos são comparados por dígitos,
 * dos dois lados, e o resto continua sendo comparação de texto sem acento.
 */

export const normalizeSearchText = (value?: string | number | null) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const onlyDigits = (value?: string | number | null) => String(value ?? "").replace(/\D/g, "");

/**
 * Piso de dígitos para busca numérica. Com um ou dois dígitos praticamente todo CNPJ da base
 * casa, e a lista filtrada fica tão inútil quanto a lista inteira.
 */
export const MIN_DIGIT_SEARCH_LENGTH = 3;

export const buildSearchText = (parts: Array<string | number | null | undefined>) =>
  normalizeSearchText(parts.filter((part) => part !== null && part !== undefined && part !== "").join(" "));

/**
 * @param term          o que o usuário digitou
 * @param searchText    texto já normalizado por `buildSearchText` (nome, e-mail, cargo, etc.)
 * @param digitFields   campos numéricos crus (CPF, CNPJ, telefone), com ou sem máscara
 */
export const matchesSearchTerm = (
  term: string,
  searchText: string,
  digitFields: Array<string | null | undefined> = [],
) => {
  const trimmed = term.trim();
  if (!trimmed) return true;

  if (searchText.includes(normalizeSearchText(trimmed))) return true;

  const digits = onlyDigits(trimmed);
  if (digits.length < MIN_DIGIT_SEARCH_LENGTH) return false;

  return digitFields.some((field) => {
    const fieldDigits = onlyDigits(field);
    return fieldDigits.length > 0 && fieldDigits.includes(digits);
  });
};
