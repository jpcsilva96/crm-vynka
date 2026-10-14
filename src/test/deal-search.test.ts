import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/dealsStore";
import type { CRMContact } from "@/lib/crmContactsStore";
import type { CRMCompany } from "@/lib/crmCompaniesStore";
import { buildDealSearchIndex } from "@/lib/dealSearch";
import { matchesSearchTerm } from "@/lib/searchMatch";

/**
 * Busca da barra de negociações.
 *
 * O ponto que este arquivo protege: o documento vem da EMPRESA e dos CONTATOS, nunca de
 * `deal.cnpj` / `deal.cpf` — que existem no tipo, não têm coluna em `crm_deals` e chegam sempre
 * vazios. Era por isso que buscar negociação por CPF ou CNPJ nunca achava nada.
 */

const empresa: CRMCompany = {
  id: "emp-1",
  workspaceId: "ws-1",
  name: "Hotel Serra Azul Ltda",
  cnpj: "12.345.678/0001-90", // como a base guarda: com máscara
} as CRMCompany;

const contato: CRMContact = {
  id: "cont-1",
  workspaceId: "ws-1",
  name: "Ana Carolina",
  email: "ana@serraazul.com.br",
  cpf: "987.654.321-00",
  phone: "(11) 98461-6772",
} as CRMContact;

const segundoContato: CRMContact = {
  id: "cont-2",
  workspaceId: "ws-1",
  name: "Bruno Dias",
  cpf: "11122233344",
} as CRMContact;

const negociacao: Deal = {
  id: "deal-1",
  workspaceId: "ws-1",
  dealName: "Reposição de louças",
  dealCode: "VYN-75",
  companyId: "emp-1",
  primaryContactId: "cont-1",
  contactIds: ["cont-1", "cont-2"],
  phone: "(11) 3333-4444",
  // campos-fantasma: existem no tipo e NUNCA têm valor vindo do banco
  cnpj: undefined,
  cpf: undefined,
} as Deal;

/** Outra empresa do mesmo workspace, ANTES da certa na lista: pega quem ignora o `companyId`. */
const outraEmpresa: CRMCompany = {
  id: "emp-2",
  workspaceId: "ws-1",
  name: "Pousada do Vale",
  cnpj: "98.765.432/0001-55",
} as CRMCompany;

const indice = buildDealSearchIndex(
  negociacao,
  [contato, segundoContato],
  [outraEmpresa, empresa],
  "Reposição de louças",
);
const procurar = (termo: string) => matchesSearchTerm(termo, indice.text, indice.digits);

describe("índice de busca da negociação", () => {
  it("acha pelo CNPJ da empresa vinculada, digitado só com números", () => {
    expect(procurar("12345678000190")).toBe(true);
    expect(procurar("12345678")).toBe(true);
  });

  it("acha pelo CNPJ com máscara, do jeito que se copia de um e-mail", () => {
    expect(procurar("12.345.678/0001-90")).toBe(true);
  });

  it("acha pelo CPF de qualquer contato da negociação, não só o principal", () => {
    expect(procurar("98765432100")).toBe(true);
    expect(procurar("111.222.333-44")).toBe(true);
  });

  it("acha por telefone da negociação e do contato, com ou sem máscara", () => {
    expect(procurar("11984616772")).toBe(true);
    expect(procurar("(11) 3333-4444")).toBe(true);
    expect(procurar("33334444")).toBe(true);
  });

  it("continua achando pelo que já funcionava", () => {
    expect(procurar("VYN-75")).toBe(true);
    expect(procurar("serra azul")).toBe(true);
    expect(procurar("REPOSIÇÃO")).toBe(true);
    expect(procurar("ana carolina")).toBe(true);
    expect(procurar("ana@serraazul.com.br")).toBe(true);
  });

  it("não confunde com outra negociação", () => {
    expect(procurar("98765432000155")).toBe(false);
    expect(procurar("pousada")).toBe(false);
  });

  it("negociação sem empresa e sem contato não casa busca numérica", () => {
    const avulsa = buildDealSearchIndex(
      { id: "deal-2", workspaceId: "ws-1", dealCode: "VYN-90" } as Deal,
      [],
      [],
      "Orçamento avulso",
    );
    expect(matchesSearchTerm("12345678000190", avulsa.text, avulsa.digits)).toBe(false);
    expect(matchesSearchTerm("VYN-90", avulsa.text, avulsa.digits)).toBe(true);
  });

  it("ignora contato que não pertence à negociação", () => {
    const estranho = { id: "cont-9", workspaceId: "ws-1", name: "Fulano", cpf: "55566677788" } as CRMContact;
    const indiceComEstranho = buildDealSearchIndex(negociacao, [contato, segundoContato, estranho], [empresa]);
    expect(matchesSearchTerm("55566677788", indiceComEstranho.text, indiceComEstranho.digits)).toBe(false);
  });

  it("não lê o documento da própria negociação, mesmo que alguém preencha o campo-fantasma", () => {
    const comFantasma = buildDealSearchIndex(
      { ...negociacao, companyId: undefined, primaryContactId: undefined, contactIds: [], cnpj: "99.999.999/0001-99" } as Deal,
      [],
      [],
    );
    expect(matchesSearchTerm("99999999000199", comFantasma.text, comFantasma.digits)).toBe(false);
  });
});
