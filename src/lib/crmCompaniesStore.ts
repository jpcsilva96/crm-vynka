import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export type CompanyType = "MATRIZ" | "FILIAL";

export interface CRMCompany {
  id: string;
  name: string;
  cnpj?: string;
  assignedTo?: string;
  segment?: string;
  url?: string;
  address?: string;
  notes?: string;
  companyType: CompanyType;
  parentCompanyId?: string;
  workspaceId: string;
  createdAt: string;
  deletedAt?: string;
}

interface CompaniesState {
  companies: CRMCompany[];
  isLoading: boolean;
  fetchCompanies: (workspaceId: string) => Promise<void>;
  addCompany: (company: Omit<CRMCompany, "id" | "createdAt">) => Promise<CRMCompany>;
  updateCompany: (id: string, updates: Partial<CRMCompany>) => Promise<void>;
  removeCompany: (id: string) => Promise<void>;
}

const isUUID = (val?: string) => val && val.length === 36;

const toDB = (company: Partial<CRMCompany>) => ({
  id: company.id,
  name: company.name,
  cnpj: company.cnpj,
  assigned_to: isUUID(company.assignedTo) ? company.assignedTo : null,
  segment: company.segment,
  url: company.url,
  address: company.address,
  notes: company.notes,
  company_type: company.companyType,
  parent_company_id: isUUID(company.parentCompanyId) ? company.parentCompanyId : null,
  workspace_id: company.workspaceId,
  created_at: company.createdAt,
  deleted_at: company.deletedAt,
});

/**
 * Mesma regra do `toDBPatch` de contatos: só vão as colunas que o chamador
 * pediu, testadas por presença de chave.
 *
 * Aqui o estrago do `toDB` era duplo: apagava o responsável interno das 128
 * matrizes e, nas 11 filiais, mandava `parent_company_id` nulo — o que faz o
 * trigger `validate_crm_company_hierarchy` (migration 20260622013534) recusar
 * a gravação inteira, então nenhuma edição de filial salvava.
 */
const toDBPatch = (updates: Partial<CRMCompany>) => ({
  ...(updates.name !== undefined ? { name: updates.name } : {}),
  ...(updates.companyType !== undefined ? { company_type: updates.companyType } : {}),
  ...(updates.workspaceId !== undefined ? { workspace_id: updates.workspaceId } : {}),
  ...(updates.createdAt !== undefined ? { created_at: updates.createdAt } : {}),

  ...("cnpj" in updates ? { cnpj: updates.cnpj ?? null } : {}),
  ...("segment" in updates ? { segment: updates.segment ?? null } : {}),
  ...("url" in updates ? { url: updates.url ?? null } : {}),
  ...("address" in updates ? { address: updates.address ?? null } : {}),
  ...("notes" in updates ? { notes: updates.notes ?? null } : {}),
  ...("deletedAt" in updates ? { deleted_at: updates.deletedAt ?? null } : {}),

  ...("assignedTo" in updates ? { assigned_to: isUUID(updates.assignedTo) ? updates.assignedTo : null } : {}),
  ...("parentCompanyId" in updates ? { parent_company_id: isUUID(updates.parentCompanyId) ? updates.parentCompanyId : null } : {}),
});

const fromDB = (row: any): CRMCompany => ({
  id: row.id,
  name: row.name,
  cnpj: row.cnpj || undefined,
  assignedTo: row.assigned_to || undefined,
  segment: row.segment || undefined,
  url: row.url || undefined,
  address: row.address || undefined,
  notes: row.notes || undefined,
  companyType: row.company_type === "FILIAL" ? "FILIAL" : "MATRIZ",
  parentCompanyId: row.parent_company_id || undefined,
  workspaceId: row.workspace_id,
  createdAt: row.created_at,
  deletedAt: row.deleted_at || undefined,
});

export const useCRMCompaniesStore = create<CompaniesState>((set) => ({
  companies: [],
  isLoading: false,
  fetchCompanies: async (workspaceId: string) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from("crm_companies")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching companies:", error);
      set({ isLoading: false });
      return;
    }

    if (data) {
      set({ companies: data.map(fromDB), isLoading: false });
    }
  },
  addCompany: async (company) => {
    const newCompanyId = crypto.randomUUID();
    const newCompany: CRMCompany = {
      ...company,
      companyType: company.companyType || "MATRIZ",
      id: newCompanyId,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({ companies: [...state.companies, newCompany] }));

    const { error } = await supabase.from("crm_companies").insert(toDB(newCompany));

    if (error) {
      console.error("Error adding company:", error);
      set((state) => ({ companies: state.companies.filter((c) => c.id !== newCompanyId) }));
      throw error;
    }

    return newCompany;
  },
  updateCompany: async (id, updates) => {
    let previousCompanies: CRMCompany[] = [];

    set((state) => {
      previousCompanies = state.companies;
      return {
        companies: state.companies.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      };
    });

    const { error } = await supabase.from("crm_companies").update(toDBPatch(updates)).eq("id", id);

    if (error) {
      console.error("Error updating company:", error);
      set({ companies: previousCompanies });
      throw error;
    }
  },
  removeCompany: async (id) => {
    let previousCompanies: CRMCompany[] = [];

    set((state) => {
      previousCompanies = state.companies;
      return {
        companies: state.companies.filter((c) => c.id !== id),
      };
    });

    const deletedAt = new Date().toISOString();
    const { error } = await supabase.from("crm_companies").update({ deleted_at: deletedAt }).eq("id", id);

    if (error) {
      console.error("Error deleting company:", error);
      set({ companies: previousCompanies });
      throw error;
    }
  },
}));
