import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  legalName?: string;
  tradeName?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  managerName?: string;
  managerEmail?: string;
  contractEndDate?: string;
  maxUsers?: number;
  maxWorkspaces?: number;
  status?: string;
  isActive?: boolean;
  billingFrequency?: string;
  dueDay?: number;
  nextDueDate?: string;
  subscriptionStatus?: string;
  isBlocked?: boolean;
}

interface OrganizationState {
  organizations: Organization[];
  activeOrganizationId: string | null;
  isLoading: boolean;
  fetchOrganizations: () => Promise<void>;
  addOrganization: (orgData: Omit<Organization, "id" | "createdAt">) => Promise<Organization | null>;
  updateOrganization: (id: string, updates: Partial<Omit<Organization, "id" | "createdAt">>) => Promise<void>;
  deleteOrganization: (id: string) => Promise<void>;
  setActiveOrganization: (id: string | null) => void;
}

export const useOrganizationStore = create<OrganizationState>((set, get) => ({
  organizations: [],
  activeOrganizationId: localStorage.getItem("vynka_active_org") || null,
  isLoading: true,

  fetchOrganizations: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase.from("organizations").select("*").order("created_at");
    
    if (error) {
      console.error("Error fetching organizations", error);
      set({ isLoading: false });
      return;
    }
    
    const mapped: Organization[] = (data || []).map(o => ({
      id: o.id,
      name: o.name,
      createdAt: o.created_at,
      legalName: o.legal_name,
      tradeName: o.trade_name,
      cnpj: o.cnpj,
      email: o.email,
      phone: o.phone,
      whatsapp: o.whatsapp,
      website: o.website,
      managerName: o.manager_name,
      managerEmail: o.manager_email,
      contractEndDate: o.contract_end_date,
      maxUsers: o.max_users,
      maxWorkspaces: o.max_workspaces,
      status: o.status,
      isActive: o.is_active,
      billingFrequency: o.billing_frequency,
      dueDay: o.due_day,
      nextDueDate: o.next_due_date,
      subscriptionStatus: o.subscription_status,
      isBlocked: o.is_blocked,
    }));
    
    const currentActive = get().activeOrganizationId;
    const stillExists = mapped.some(o => o.id === currentActive);
    const newActive = stillExists ? currentActive : (mapped.length > 0 ? mapped[0].id : null);
    
    if (newActive !== currentActive) {
      if (newActive) localStorage.setItem("vynka_active_org", newActive);
      else localStorage.removeItem("vynka_active_org");
    }

    set({ organizations: mapped, activeOrganizationId: newActive, isLoading: false });
  },

  addOrganization: async (orgData) => {
    const id = crypto.randomUUID();
    const dbPayload = {
      id,
      name: orgData.name,
      legal_name: orgData.legalName,
      trade_name: orgData.tradeName,
      cnpj: orgData.cnpj,
      email: orgData.email,
      phone: orgData.phone,
      whatsapp: orgData.whatsapp,
      website: orgData.website,
      manager_name: orgData.managerName,
      manager_email: orgData.managerEmail,
      contract_end_date: orgData.contractEndDate,
      max_users: orgData.maxUsers,
      max_workspaces: orgData.maxWorkspaces,
      status: orgData.status || 'Ativo',
      is_active: orgData.isActive !== false,
      billing_frequency: orgData.billingFrequency || 'Mensal',
      due_day: orgData.dueDay || 10,
      next_due_date: orgData.nextDueDate || null,
      subscription_status: orgData.subscriptionStatus || 'Ativa',
      is_blocked: orgData.isBlocked || false
    };

    const { error } = await supabase.from("organizations").insert(dbPayload);
    if (error) {
      console.error("Error creating organization", error);
      return null;
    }
    const org: Organization = { ...orgData, id, createdAt: new Date().toISOString() };
    set(s => ({ organizations: [...s.organizations, org] }));
    return org;
  },

  updateOrganization: async (id, updates) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.legalName !== undefined) dbUpdates.legal_name = updates.legalName;
    if (updates.tradeName !== undefined) dbUpdates.trade_name = updates.tradeName;
    if (updates.cnpj !== undefined) dbUpdates.cnpj = updates.cnpj;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.whatsapp !== undefined) dbUpdates.whatsapp = updates.whatsapp;
    if (updates.website !== undefined) dbUpdates.website = updates.website;
    if (updates.managerName !== undefined) dbUpdates.manager_name = updates.managerName;
    if (updates.managerEmail !== undefined) dbUpdates.manager_email = updates.managerEmail;
    if (updates.contractEndDate !== undefined) dbUpdates.contract_end_date = updates.contractEndDate;
    if (updates.maxUsers !== undefined) dbUpdates.max_users = updates.maxUsers;
    if (updates.maxWorkspaces !== undefined) dbUpdates.max_workspaces = updates.maxWorkspaces;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.billingFrequency !== undefined) dbUpdates.billing_frequency = updates.billingFrequency;
    if (updates.dueDay !== undefined) dbUpdates.due_day = updates.dueDay;
    if (updates.nextDueDate !== undefined) dbUpdates.next_due_date = updates.nextDueDate;
    if (updates.subscriptionStatus !== undefined) dbUpdates.subscription_status = updates.subscriptionStatus;
    if (updates.isBlocked !== undefined) dbUpdates.is_blocked = updates.isBlocked;

    const { error } = await supabase.from("organizations").update(dbUpdates).eq("id", id);
    if (!error) {
      set(s => ({ organizations: s.organizations.map(o => o.id === id ? { ...o, ...updates } : o) }));
    }
  },

  deleteOrganization: async (id) => {
    const { data, error } = await supabase.from("organizations").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) {
      throw new Error("Você não tem permissão para excluir esta organização.");
    }

    set(s => {
      const filtered = s.organizations.filter(o => o.id !== id);
      const newActive = s.activeOrganizationId === id ? (filtered[0]?.id || null) : s.activeOrganizationId;
      if (newActive) localStorage.setItem("vynka_active_org", newActive);
      else localStorage.removeItem("vynka_active_org");
      return { organizations: filtered, activeOrganizationId: newActive };
    });
  },

  setActiveOrganization: (id) => {
    if (id) localStorage.setItem("vynka_active_org", id);
    else localStorage.removeItem("vynka_active_org");
    set({ activeOrganizationId: id });
  }
}));
