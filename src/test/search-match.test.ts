import { describe, expect, it } from "vitest";
import { buildSearchText, matchesSearchTerm, MIN_DIGIT_SEARCH_LENGTH, onlyDigits } from "@/lib/searchMatch";

/**
 * O caso que originou este módulo: em produção 155 dos 156 CNPJs estão gravados com máscara.
 * Buscar por dígitos tem de achar o mascarado, e buscar com máscara tem de achar o cru.
 */
const empresaMascarada = {
  texto: buildSearchText(["Restaurante Água Doce", "contato@aguadoce.com.br"]),
  documentos: ["12.345.678/0001-90", "(11) 98461-6772"],
};

const empresaCrua = {
  texto: buildSearchText(["Hotel Serra Azul"]),
  documentos: ["98765432000155"],
};

describe("matchesSearchTerm", () => {
  it("acha documento mascarado quando o usuário digita só os dígitos", () => {
    expect(matchesSearchTerm("12345678000190", empresaMascarada.texto, empresaMascarada.documentos)).toBe(true);
    expect(matchesSearchTerm("12345678", empresaMascarada.texto, empresaMascarada.documentos)).toBe(true);
  });

  it("acha documento cru quando o usuário digita com máscara", () => {
    expect(matchesSearchTerm("98.765.432/0001-55", empresaCrua.texto, empresaCrua.documentos)).toBe(true);
  });

  it("acha telefone independente da máscara dos dois lados", () => {
    expect(matchesSearchTerm("11984616772", empresaMascarada.texto, empresaMascarada.documentos)).toBe(true);
    expect(matchesSearchTerm("(11) 98461-6772", empresaMascarada.texto, empresaMascarada.documentos)).toBe(true);
    expect(matchesSearchTerm("984616772", empresaMascarada.texto, empresaMascarada.documentos)).toBe(true);
  });

  it("ignora acento e caixa no texto", () => {
    expect(matchesSearchTerm("AGUA DOCE", empresaMascarada.texto, empresaMascarada.documentos)).toBe(true);
    expect(matchesSearchTerm("água", empresaMascarada.texto, empresaMascarada.documentos)).toBe(true);
  });

  it("não usa a busca numérica com menos dígitos que o piso", () => {
    expect(MIN_DIGIT_SEARCH_LENGTH).toBe(3);
    // "12" está dentro do CNPJ, mas dois dígitos casariam com quase toda a base
    expect(matchesSearchTerm("12", empresaMascarada.texto, empresaMascarada.documentos)).toBe(false);
    expect(matchesSearchTerm("123", empresaMascarada.texto, empresaMascarada.documentos)).toBe(true);
  });

  it("não confunde registros diferentes", () => {
    expect(matchesSearchTerm("98765432000155", empresaMascarada.texto, empresaMascarada.documentos)).toBe(false);
    expect(matchesSearchTerm("serra azul", empresaMascarada.texto, empresaMascarada.documentos)).toBe(false);
  });

  it("termo vazio ou só espaço não filtra nada", () => {
    expect(matchesSearchTerm("", empresaMascarada.texto, empresaMascarada.documentos)).toBe(true);
    expect(matchesSearchTerm("   ", empresaMascarada.texto, empresaMascarada.documentos)).toBe(true);
  });

  it("registro sem documento não casa busca numérica", () => {
    const semDocumento = { texto: buildSearchText(["Padaria Central"]), documentos: [undefined, "", null] };
    expect(matchesSearchTerm("123", semDocumento.texto, semDocumento.documentos)).toBe(false);
    expect(matchesSearchTerm("padaria", semDocumento.texto, semDocumento.documentos)).toBe(true);
  });

  it("funciona sem lista de campos numéricos", () => {
    expect(matchesSearchTerm("padaria", buildSearchText(["Padaria Central"]))).toBe(true);
    expect(matchesSearchTerm("123", buildSearchText(["Padaria Central"]))).toBe(false);
  });
});

describe("buildSearchText", () => {
  it("descarta vazios e normaliza para comparação", () => {
    expect(buildSearchText(["José", null, undefined, "", "Diretor"])).toBe("jose diretor");
  });

  it("não deixa nulo virar a palavra null", () => {
    expect(buildSearchText([null, undefined])).toBe("");
  });
});

describe("onlyDigits", () => {
  it("extrai dígitos de qualquer formato", () => {
    expect(onlyDigits("12.345.678/0001-90")).toBe("12345678000190");
    expect(onlyDigits(null)).toBe("");
  });
});
