// Fase 4 (04/09/2026): um contato Pessoa Jurídica pode atuar em mais de uma
// empresa, e precisa aparecer na lista de contatos de TODAS elas — não só da que
// está em crm_contacts.company_id.
//
// O que estes testes protegem, em uma frase: até aqui, para abrir negociação de um
// contato numa segunda empresa, o vendedor tinha de TROCAR a empresa dele — o
// mesmo gesto que, até o PR #16, apagava o vínculo em silêncio (43 contatos
// atingidos, ver src/test/contact-company-link.test.ts).
import { beforeEach, describe, expect, it, vi } from "vitest";

type Corpo = Record<string, unknown>;

const { captured, falhar } = vi.hoisted(() => ({
  captured: [] as Array<{ op: string; payload: Corpo }>,
  falhar: { agora: false },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      upsert: async (payload: Corpo) => {
        captured.push({ op: "upsert", payload });
        return { error: falhar.agora ? { message: "boom" } : null };
      },
      delete: () => {
        const filtros: Corpo = {};
        type Chain = {
          eq: (coluna: string, valor: string) => Chain;
          then?: (resolve: (v: unknown) => void) => Promise<void>;
        };
        const chain: Chain = {
          eq: (coluna: string, valor: string) => {
            filtros[coluna] = valor;
            chain.then = (resolve: (v: unknown) => void) => {
              captured.push({ op: "delete", payload: { ...filtros } });
              return Promise.resolve({ error: falhar.agora ? { message: "boom" } : null }).then(resolve);
            };
            return chain;
          },
        };
        return chain;
      },
    }),
  },
}));

const {
  useCRMContactCompaniesStore,
  companyIdsOfContact,
  contactBelongsToCompany,
  filterContactsByCompany,
} = await import("@/lib/crmContactCompaniesStore");

const EMPRESA_A = "11111111-1111-1111-1111-111111111111";
const EMPRESA_B = "22222222-2222-2222-2222-222222222222";
const WORKSPACE = "33333333-3333-3333-3333-333333333333";

const link = (contactId: string, companyId: string) => ({
  contactId,
  companyId,
  workspaceId: WORKSPACE,
  createdAt: "2026-09-04T12:00:00.000Z",
});

// Contato que atua nas duas empresas, com a A como principal.
const multi = { id: "c1", companyId: EMPRESA_A };
// Contato que só atua na A.
const soA = { id: "c2", companyId: EMPRESA_A };

beforeEach(() => {
  captured.length = 0;
  falhar.agora = false;
  useCRMContactCompaniesStore.setState({ links: [], isLoading: false });
});

describe("regra de pertencimento", () => {
  it("o contato pertence à empresa NÃO principal quando há vínculo", () => {
    const links = [link("c1", EMPRESA_A), link("c1", EMPRESA_B)];
    expect(contactBelongsToCompany(links, "c1", EMPRESA_B, EMPRESA_A)).toBe(true);
  });

  it("o contato NÃO pertence a uma empresa onde não foi vinculado", () => {
    const links = [link("c1", EMPRESA_A)];
    expect(contactBelongsToCompany(links, "c1", EMPRESA_B, EMPRESA_A)).toBe(false);
  });

  it("a empresa principal conta mesmo se os vínculos ainda não carregaram", () => {
    // Degradação deliberada: sem os links, a tela volta ao comportamento anterior
    // à Fase 4 em vez de esconder o contato de toda empresa.
    expect(contactBelongsToCompany([], "c1", EMPRESA_A, EMPRESA_A)).toBe(true);
    expect(companyIdsOfContact([], "c1", EMPRESA_A)).toEqual([EMPRESA_A]);
  });

  it("companyIdsOfContact não duplica a principal quando ela também está nos vínculos", () => {
    const links = [link("c1", EMPRESA_A), link("c1", EMPRESA_B)];
    expect(companyIdsOfContact(links, "c1", EMPRESA_A)).toEqual([EMPRESA_A, EMPRESA_B]);
  });
});

describe("lista de contatos por empresa", () => {
  const links = [link("c1", EMPRESA_A), link("c1", EMPRESA_B), link("c2", EMPRESA_A)];

  it("o contato multi aparece na empresa que NÃO é a principal dele", () => {
    expect(filterContactsByCompany([multi, soA], links, EMPRESA_B).map((c) => c.id)).toEqual(["c1"]);
  });

  it("continua aparecendo na principal, junto de quem só atua lá", () => {
    expect(filterContactsByCompany([multi, soA], links, EMPRESA_A).map((c) => c.id)).toEqual(["c1", "c2"]);
  });
});

describe("vincular e desvincular", () => {
  it("vincular a uma segunda empresa NÃO derruba a primeira", async () => {
    useCRMContactCompaniesStore.setState({ links: [link("c1", EMPRESA_A)] });

    await useCRMContactCompaniesStore.getState().linkCompany("c1", EMPRESA_B, WORKSPACE);

    const depois = useCRMContactCompaniesStore.getState().links;
    expect(depois.map((l) => l.companyId).sort()).toEqual([EMPRESA_A, EMPRESA_B].sort());
    expect(captured).toHaveLength(1);
    expect(captured[0].payload).toMatchObject({
      contact_id: "c1",
      company_id: EMPRESA_B,
      workspace_id: WORKSPACE,
    });
  });

  it("desvincular remove só aquele par, não as outras empresas do contato", async () => {
    useCRMContactCompaniesStore.setState({ links: [link("c1", EMPRESA_A), link("c1", EMPRESA_B)] });

    await useCRMContactCompaniesStore.getState().unlinkCompany("c1", EMPRESA_B);

    expect(useCRMContactCompaniesStore.getState().links.map((l) => l.companyId)).toEqual([EMPRESA_A]);
    expect(captured[0]).toMatchObject({
      op: "delete",
      payload: { contact_id: "c1", company_id: EMPRESA_B },
    });
  });

  it("erro do banco desfaz o otimismo do store", async () => {
    useCRMContactCompaniesStore.setState({ links: [link("c1", EMPRESA_A)] });
    falhar.agora = true;

    await expect(
      useCRMContactCompaniesStore.getState().linkCompany("c1", EMPRESA_B, WORKSPACE),
    ).rejects.toBeTruthy();

    expect(useCRMContactCompaniesStore.getState().links.map((l) => l.companyId)).toEqual([EMPRESA_A]);
  });
});
