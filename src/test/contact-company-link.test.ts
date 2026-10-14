// Regressão do caso Jose Carlos (02/09/2026): uma edição parcial de contato
// apagava o vínculo com a empresa, o responsável interno e as respostas do
// BANT, porque o corpo do UPDATE era montado com o cadastro inteiro. O mesmo
// padrão existia em empresas, onde derrubava o responsável das matrizes e
// impedia qualquer edição de filial (o trigger de hierarquia recusa filial sem
// matriz).
//
// Os testes cobrem os dois lados: não mandar coluna que ninguém pediu, e
// continuar mandando NULL quando a tela pede para limpar o campo.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BantQualification } from "@/lib/leadQualification";

type Corpo = Record<string, unknown>;

const { captured } = vi.hoisted(() => ({ captured: [] as Array<{ table: string; payload: Corpo }> }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      update: (payload: Corpo) => {
        captured.push({ table, payload });
        return { eq: async () => ({ error: null }) };
      },
    }),
  },
}));

const { useCRMContactsStore } = await import("@/lib/crmContactsStore");
const { useCRMCompaniesStore } = await import("@/lib/crmCompaniesStore");

const EMPRESA_A = "11111111-1111-1111-1111-111111111111";
const RESPONSAVEL = "22222222-2222-2222-2222-222222222222";
const WORKSPACE = "33333333-3333-3333-3333-333333333333";
const MATRIZ = "55555555-5555-5555-5555-555555555555";

const jose = {
  id: "c1",
  name: "Jose Carlos",
  role: "Comprador",
  phone: "(11) 94767-9100",
  email: "jose@exemplo.com.br",
  companyId: EMPRESA_A,
  personType: "Juridica" as const,
  assignedTo: RESPONSAVEL,
  qualificationBant: { need: 4, budget: 3, authority: 5, timeline: 2 } as BantQualification,
  qualificationClassification: "Lead Qualificado",
  workspaceId: WORKSPACE,
  createdAt: "2026-08-24T13:04:10.595Z",
};

const filial = {
  id: "co1",
  name: "Filial X",
  companyType: "FILIAL" as const,
  parentCompanyId: MATRIZ,
  assignedTo: RESPONSAVEL,
  segment: "Restaurante",
  workspaceId: WORKSPACE,
  createdAt: "2026-08-01T00:00:00Z",
};

const ultimoCorpo = () => captured[captured.length - 1].payload;

beforeEach(() => {
  captured.length = 0;
  useCRMContactsStore.setState({ contacts: [{ ...jose }] });
  useCRMCompaniesStore.setState({ companies: [{ ...filial }] });
});

describe("updateContact preserva o que não foi editado", () => {
  it("editar só o cargo não toca na empresa, no responsável nem no BANT", async () => {
    await useCRMContactsStore.getState().updateContact("c1", { role: "Gerente" });

    const corpo = ultimoCorpo();
    expect(corpo).toEqual({ role: "Gerente" });
    expect(corpo).not.toHaveProperty("company_id");
    expect(corpo).not.toHaveProperty("assigned_to");
    expect(corpo).not.toHaveProperty("qualification_bant");
  });

  it("editar só o telefone não toca no responsável", async () => {
    await useCRMContactsStore.getState().updateContact("c1", { phone: "(11) 90000-0000" });
    expect(ultimoCorpo()).toEqual({ phone: "(11) 90000-0000" });
  });

  it("definir o responsável não desvincula a empresa", async () => {
    await useCRMContactsStore.getState().updateContact("c1", { assignedTo: "44444444-4444-4444-4444-444444444444" });

    const corpo = ultimoCorpo();
    expect(corpo.assigned_to).toBe("44444444-4444-4444-4444-444444444444");
    expect(corpo).not.toHaveProperty("company_id");
  });

  it("banco e memória ficam coerentes depois da edição", async () => {
    await useCRMContactsStore.getState().updateContact("c1", { role: "Gerente" });

    // A memória mantinha a empresa enquanto o banco recebia NULL: foi essa
    // divergência que deixou criar a VYN-116 um minuto depois do vínculo já
    // ter sido apagado.
    expect(useCRMContactsStore.getState().contacts[0].companyId).toBe(EMPRESA_A);
    expect(ultimoCorpo()).not.toHaveProperty("company_id");
  });
});

describe("updateContact continua limpando o que a tela pede para limpar", () => {
  it("desvincular a empresa manda NULL", async () => {
    // Botão de desvincular no cartão da empresa: passa companyId undefined.
    await useCRMContactsStore.getState().updateContact("c1", { companyId: undefined });
    expect(ultimoCorpo()).toEqual({ company_id: null });
  });

  it("apagar o cargo manda NULL", async () => {
    // Edição inline: `{ role: v || undefined }` com o campo esvaziado.
    await useCRMContactsStore.getState().updateContact("c1", { role: undefined });
    expect(ultimoCorpo()).toEqual({ role: null });
  });

  it("companyId inválido continua virando NULL", async () => {
    await useCRMContactsStore.getState().updateContact("c1", { companyId: "nao-e-uuid" });
    expect(ultimoCorpo()).toEqual({ company_id: null });
  });
});

describe("updateCompany preserva o que não foi editado", () => {
  it("editar só o segmento não toca na matriz nem no responsável", async () => {
    await useCRMCompaniesStore.getState().updateCompany("co1", { segment: "Hotelaria" });

    const corpo = ultimoCorpo();
    expect(corpo).toEqual({ segment: "Hotelaria" });
    expect(corpo).not.toHaveProperty("parent_company_id");
    expect(corpo).not.toHaveProperty("assigned_to");
  });

  it("editar o CNPJ de uma filial não manda matriz nula (o trigger recusaria)", async () => {
    await useCRMCompaniesStore.getState().updateCompany("co1", { cnpj: "03.221.095/0006-76" });
    expect(ultimoCorpo()).not.toHaveProperty("parent_company_id");
  });

  it("trocar a matriz explicitamente continua funcionando", async () => {
    const outraMatriz = "66666666-6666-6666-6666-666666666666";
    await useCRMCompaniesStore.getState().updateCompany("co1", { parentCompanyId: outraMatriz });
    expect(ultimoCorpo()).toEqual({ parent_company_id: outraMatriz });
  });
});
