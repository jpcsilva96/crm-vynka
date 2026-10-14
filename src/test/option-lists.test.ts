import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  activeOptions,
  cleanOptionLabel,
  isDuplicateLabel,
  normalizeOptionLabel,
  labelsWithCurrent,
  optionsWithCurrentValue,
  reorderedPositions,
  type OptionItem,
} from "@/lib/optionLists";

const opcao = (over: Partial<OptionItem> = {}): OptionItem => ({
  id: "o1",
  kind: "contact_role",
  label: "Comprador",
  position: 1,
  isActive: true,
  ...over,
});

describe("chave de duplicidade segue a regra do SQL", () => {
  it("ignora maiúsculas e espaço nas pontas", () => {
    expect(normalizeOptionLabel("  Comprador ")).toBe("comprador");
  });

  it("NÃO remove tabulação nem quebra de linha — btrim do Postgres só tira espaço", () => {
    // o .trim() do JavaScript removeria os dois; o índice único do banco, não.
    expect(normalizeOptionLabel("\tComprador")).toBe("\tcomprador");
    expect(cleanOptionLabel("\tComprador")).toBe("\tComprador");
    expect(cleanOptionLabel("  Comprador  ")).toBe("Comprador");
  });

  it("acusa duplicata só dentro do que já existe, ignorando o próprio item", () => {
    const existentes = [opcao({ id: "a", label: "Comprador" }), opcao({ id: "b", label: "Gerente" })];
    expect(isDuplicateLabel("comprador", existentes)).toBe(true);
    expect(isDuplicateLabel(" COMPRADOR ", existentes)).toBe(true);
    expect(isDuplicateLabel("Comprador", existentes, "a")).toBe(false);
    expect(isDuplicateLabel("Sócio", existentes)).toBe(false);
  });
});

describe("opções oferecidas para nova escolha", () => {
  it("só as ativas, na ordem cadastrada", () => {
    const itens = [
      opcao({ id: "c", label: "Terceiro", position: 3 }),
      opcao({ id: "a", label: "Primeiro", position: 1 }),
      opcao({ id: "b", label: "Desativado", position: 2, isActive: false }),
    ];
    expect(activeOptions(itens).map((item) => item.label)).toEqual(["Primeiro", "Terceiro"]);
  });
});

// Esta é a parte que impede uma perda de dado silenciosa. Desativar uma opção não apaga o valor
// gravado (decisão 13) — mas se o campo não OFERECER esse valor, abrir o registro e salvar grava
// vazio sem avisar. Foi assim que o campo CNPJ da negociação perdia dado (lote 2).
describe("o campo sempre oferece o valor que o registro já tem", () => {
  const lista = [opcao({ id: "a", label: "Comprador" }), opcao({ id: "b", label: "Gerente", position: 2 })];

  it("valor fora da lista entra no fim, sem sumir", () => {
    expect(optionsWithCurrentValue(lista, "Dono")).toEqual(["Comprador", "Gerente", "Dono"]);
  });

  it("valor de opção desativada continua sendo oferecido naquele registro", () => {
    const comDesativada = [...lista, opcao({ id: "c", label: "Sócio", position: 3, isActive: false })];
    expect(optionsWithCurrentValue(comDesativada, "Sócio")).toContain("Sócio");
    // e continua fora da lista de quem ainda não tem valor
    expect(optionsWithCurrentValue(comDesativada, "")).not.toContain("Sócio");
  });

  it("não duplica quando o valor já está na lista, mesmo com caixa diferente", () => {
    expect(optionsWithCurrentValue(lista, "comprador")).toEqual(["Comprador", "Gerente"]);
    expect(optionsWithCurrentValue(lista, " Gerente ")).toEqual(["Comprador", "Gerente"]);
  });

  it("registro sem valor recebe só as ativas", () => {
    expect(optionsWithCurrentValue(lista, null)).toEqual(["Comprador", "Gerente"]);
    expect(optionsWithCurrentValue(lista, undefined)).toEqual(["Comprador", "Gerente"]);
  });
});

describe("reordenação", () => {
  it("numera de 1 em diante, na ordem recebida", () => {
    const itens = [opcao({ id: "a" }), opcao({ id: "b" }), opcao({ id: "c" })];
    expect(reorderedPositions(itens, ["c", "a", "b"])).toEqual([
      { id: "c", position: 1 },
      { id: "a", position: 2 },
      { id: "b", position: 3 },
    ]);
  });

  it("descarta id que não existe na lista", () => {
    expect(reorderedPositions([opcao({ id: "a" })], ["a", "fantasma"])).toEqual([{ id: "a", position: 1 }]);
  });
});

// As listas saíram do código: se alguém reintroduzir uma, as telas voltam a divergir em silêncio,
// que foi exatamente o estado encontrado (duas listas de cargo diferentes, uma delas gravando
// "Outros" onde o CRM guarda "Outro").
describe("contrato: nenhuma tela guarda a lista em código", () => {
  const ler = (caminho: string) => readFileSync(resolve(__dirname, "..", caminho), "utf8");
  const telas = [
    "components/pipeline/CreateCompanyDialog.tsx",
    "components/pipeline/CompanyView.tsx",
    "components/pipeline/CreateContactDialog.tsx",
    "components/pipeline/CreateDealDialog.tsx",
    // achados depois do lote 7, em 17/09: seguiam como texto livre
    "components/pipeline/ContactView.tsx",
    "components/pipeline/DealView.tsx",
  ];

  it.each(telas)("%s lê a lista do banco, não de um literal", (tela) => {
    const fonte = ler(tela);
    expect(fonte).toContain("useOptionLabels");
    expect(fonte).not.toContain("Turismo e Hotelaria");
    expect(fonte).not.toContain("Executivo de Contas");
  });

  it("o store de contatos não exporta mais a lista de cargos", () => {
    expect(ler("lib/crmContactsStore.ts")).not.toContain("CONTACT_ROLES");
  });

  it("cada campo passa o valor atual, para não apagar o que já está gravado", () => {
    expect(ler("components/pipeline/CreateCompanyDialog.tsx")).toContain('useOptionLabels("segment", segment)');
    expect(ler("components/pipeline/CompanyView.tsx")).toContain('useOptionLabels("segment", company?.segment)');
    expect(ler("components/pipeline/CreateContactDialog.tsx")).toContain('useOptionLabels("contact_role", role)');
    expect(ler("components/pipeline/CreateDealDialog.tsx")).toContain('useOptionLabels("contact_role", contactRole)');
  });
});

// O lote 7 trocou as listas de ESCOLHA, mas três campos de Cargo continuaram como TEXTO LIVRE:
// os Detalhes do Contato, o cartão do contato dentro da negociação, e o diálogo que cria contato
// pela negociação — este último com placeholder "Ex: Compras", que é justamente um dos valores
// órfãos achados na base. Texto livre é a origem do órfão, não um acidente.
describe("contrato: nenhum campo de Cargo aceita texto livre", () => {
  const ler = (caminho: string) => readFileSync(resolve(__dirname, "..", caminho), "utf8");

  it("Detalhes do Contato usa lista de escolha", () => {
    const fonte = ler("components/pipeline/ContactView.tsx");
    expect(fonte).toContain('useOptionLabels("contact_role", contact?.role)');
    expect(fonte).toContain("options={roleOptions}");
    expect(fonte).not.toContain('placeholder="Ex: Diretor Comercial"');
  });

  it("o cartão do contato na negociação usa lista de escolha", () => {
    const fonte = ler("components/pipeline/DealView.tsx");
    expect(fonte).toContain("options={roleOptions}");
  });

  it("o diálogo que cria contato pela negociação não tem mais campo de digitar cargo", () => {
    const fonte = ler("components/pipeline/DealView.tsx");
    expect(fonte).toContain("{dialogRoleOptions.map((r) => (");
    // o placeholder que ensinava a inventar valor fora da lista
    expect(fonte).not.toContain('placeholder="Ex: Compras"');
  });

  it("o campo em linha só vira lista quando recebe opções, e inclui o valor atual", () => {
    const fonte = ler("components/pipeline/InlineEditField.tsx");
    expect(fonte).toContain("labelsWithCurrent(options, value)");
  });
});

describe("valor atual entra na lista de rótulos", () => {
  it("acrescenta o que não está lá", () => {
    expect(labelsWithCurrent(["Gerente"], "Dono")).toEqual(["Gerente", "Dono"]);
  });

  it("não duplica o que já está, mesmo com caixa e espaço diferentes", () => {
    expect(labelsWithCurrent(["Gerente"], " gerente ")).toEqual(["Gerente"]);
  });

  it("sem valor atual, devolve a lista intacta", () => {
    expect(labelsWithCurrent(["Gerente"], "")).toEqual(["Gerente"]);
    expect(labelsWithCurrent(["Gerente"], null)).toEqual(["Gerente"]);
  });
});
