import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

// Mesmo `as any` dos stores irmãos (crmContactsStore.ts:6): os tipos em
// src/integrations/supabase/types.ts são gerados do banco e ainda não conhecem
// crm_contact_companies. Depois que a migration 20260904120000 estiver aplicada,
// regenerar os tipos permite tipar isto de verdade.
const db = supabase as any;

/**
 * Vínculo contato × empresa (Fase 4, migration 20260904120000).
 *
 * Um contato Pessoa Jurídica pode atuar em várias empresas. Esta tabela responde
 * "em quais empresas este contato atua?" e a pergunta inversa. A coluna
 * `crm_contacts.company_id` continua existindo como EMPRESA PRINCIPAL — é o que a
 * coluna Empresa da lista mostra — mas deixou de ser regra de filtro.
 */
export interface ContactCompanyLink {
  contactId: string;
  companyId: string;
  workspaceId: string;
  createdAt: string;
}

type ContactCompanyRow = {
  contact_id: string;
  company_id: string;
  workspace_id: string;
  created_at: string;
};

const fromDB = (row: ContactCompanyRow): ContactCompanyLink => ({
  contactId: row.contact_id,
  companyId: row.company_id,
  workspaceId: row.workspace_id,
  createdAt: row.created_at,
});

/**
 * As empresas de um contato, incluindo a principal.
 *
 * `primaryCompanyId` entra na união de propósito: o trigger do banco garante que a
 * principal também está na tabela de vínculos, mas há uma janela entre o insert de
 * um contato novo e o próximo fetch em que o store local ainda não a tem. Somando
 * a principal, a falha é para o lado de MOSTRAR — se os vínculos não carregarem, a
 * tela degrada para o comportamento anterior à Fase 4 (só a principal) em vez de
 * esconder o contato de toda empresa.
 */
export const companyIdsOfContact = (
  links: ContactCompanyLink[],
  contactId: string,
  primaryCompanyId?: string,
): string[] => {
  const ids = links.filter((l) => l.contactId === contactId).map((l) => l.companyId);
  if (primaryCompanyId && !ids.includes(primaryCompanyId)) ids.push(primaryCompanyId);
  return ids;
};

/** O contato atua nesta empresa? Mesma regra de união da função acima. */
export const contactBelongsToCompany = (
  links: ContactCompanyLink[],
  contactId: string,
  companyId: string,
  primaryCompanyId?: string,
): boolean => {
  if (primaryCompanyId && primaryCompanyId === companyId) return true;
  return links.some((l) => l.contactId === contactId && l.companyId === companyId);
};

/**
 * Os contatos que atuam nesta empresa.
 *
 * É a regra que a Fase 4 existe para mudar. Antes era
 * `wsContacts.filter(c => c.companyId === companyId)` — só quem tinha a empresa
 * como PRINCIPAL, espalhado por CreateDealDialog (3 lugares) e CompanyView. Para
 * abrir negociação de um contato numa segunda empresa, o vendedor precisava
 * trocar a principal dele, que é o gesto que até o PR #16 apagava o vínculo.
 *
 * Fica aqui, e não dentro dos componentes, para que o teste morda a regra uma vez
 * só em vez de renderizar quatro telas.
 */
export const filterContactsByCompany = <T extends { id: string; companyId?: string }>(
  contacts: T[],
  links: ContactCompanyLink[],
  companyId: string,
): T[] => contacts.filter((c) => contactBelongsToCompany(links, c.id, companyId, c.companyId));

interface ContactCompaniesState {
  links: ContactCompanyLink[];
  isLoading: boolean;
  fetchLinks: (workspaceId: string) => Promise<void>;
  linkCompany: (contactId: string, companyId: string, workspaceId: string) => Promise<void>;
  unlinkCompany: (contactId: string, companyId: string) => Promise<void>;
}

export const useCRMContactCompaniesStore = create<ContactCompaniesState>((set) => ({
  links: [],
  isLoading: false,
  fetchLinks: async (workspaceId: string) => {
    set({ isLoading: true });
    const { data, error } = await db
      .from("crm_contact_companies")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (error) {
      console.error("Error fetching contact companies:", error);
      set({ isLoading: false });
      return;
    }

    set({ links: ((data || []) as ContactCompanyRow[]).map(fromDB), isLoading: false });
  },
  linkCompany: async (contactId, companyId, workspaceId) => {
    let previous: ContactCompanyLink[] = [];
    const optimistic: ContactCompanyLink = {
      contactId,
      companyId,
      workspaceId,
      createdAt: new Date().toISOString(),
    };

    set((state) => {
      previous = state.links;
      const alreadyThere = state.links.some(
        (l) => l.contactId === contactId && l.companyId === companyId,
      );
      return { links: alreadyThere ? state.links : [...state.links, optimistic] };
    });

    // upsert e não insert: o trigger do banco pode ter criado esta mesma linha ao
    // gravar a empresa principal, e um insert puro devolveria violação de PK.
    const { error } = await db
      .from("crm_contact_companies")
      .upsert(
        { contact_id: contactId, company_id: companyId, workspace_id: workspaceId },
        { onConflict: "contact_id,company_id", ignoreDuplicates: true },
      );

    if (error) {
      console.error("Error linking contact to company:", error);
      set({ links: previous });
      throw error;
    }
  },
  unlinkCompany: async (contactId, companyId) => {
    let previous: ContactCompanyLink[] = [];
    set((state) => {
      previous = state.links;
      return {
        links: state.links.filter(
          (l) => !(l.contactId === contactId && l.companyId === companyId),
        ),
      };
    });

    const { error } = await db
      .from("crm_contact_companies")
      .delete()
      .eq("contact_id", contactId)
      .eq("company_id", companyId);

    if (error) {
      console.error("Error unlinking contact from company:", error);
      set({ links: previous });
      throw error;
    }
  },
}));
