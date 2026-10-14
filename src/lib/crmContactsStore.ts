import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { BantQualification } from "@/lib/leadQualification";
import type { Json } from "@/integrations/supabase/types";

const db = supabase as any;

// A lista de cargos saiu daqui em 15/09: agora vive no banco (crm_option_lists) e é lida pelo
// hook useOptionLabels("contact_role"). Segmento e Cargo passaram a ser editáveis em Configurações.

export interface CRMContact {
  id: string;
  name: string;
  role?: string; // Cargo
  phone?: string;
  email?: string;
  linkedIn?: string;
  companyId?: string; // Referência à empresa
  personType?: "Fisica" | "Juridica";
  cpf?: string;
  workspaceId: string;
  notes?: string;
  assignedTo?: string; // UUID from auth.users
  qualificationBant?: BantQualification;
  qualificationScore?: number;
  qualificationClassification?: string;
  qualificationCompletedAt?: string;
  qualificationResponsible?: string;
  createdAt: string;
  deletedAt?: string;
}

interface ContactsState {
  contacts: CRMContact[];
  isLoading: boolean;
  fetchContacts: (workspaceId: string) => Promise<void>;
  addContact: (contact: Omit<CRMContact, "id" | "createdAt">) => Promise<CRMContact>;
  updateContact: (id: string, updates: Partial<CRMContact>) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
}

const isUUID = (val?: string) => val && val.length === 36;

const normalizePhone = (phone?: string) => (phone || "").replace(/\D/g, "");

const toDB = (contact: Partial<CRMContact>) => ({
  id: contact.id,
  name: contact.name,
  role: contact.role,
  phone: contact.phone,
  email: contact.email,
  linked_in: contact.linkedIn,
  company_id: isUUID(contact.companyId) ? contact.companyId : null,
  person_type: contact.personType,
  cpf: contact.cpf,
  workspace_id: contact.workspaceId,
  notes: contact.notes,
  assigned_to: isUUID(contact.assignedTo) ? contact.assignedTo : null,
  qualification_bant: (contact.qualificationBant || {}) as Json,
  qualification_score: contact.qualificationScore,
  qualification_classification: contact.qualificationClassification,
  qualification_completed_at: contact.qualificationCompletedAt,
  qualification_responsible: contact.qualificationResponsible,
  created_at: contact.createdAt,
  deleted_at: contact.deletedAt,
});

/**
 * Monta o corpo de um UPDATE apenas com as colunas que o chamador pediu.
 *
 * O teste é de PRESENÇA DE CHAVE (`"role" in updates`), não de valor definido:
 * as telas limpam um campo passando `undefined` (`{ role: v || undefined }`) e
 * isso precisa continuar virando NULL. Já uma edição que não menciona a empresa
 * não pode mandar `company_id` — era o que `toDB` fazia, e por isso editar
 * cargo, telefone ou responsável desvinculava o contato da empresa em silêncio
 * (37 vínculos perdidos até 02/09/2026; reprodução em
 * `src/test/contact-company-link.test.ts`). Mesmo motivo para `assigned_to` e
 * `qualification_bant`.
 *
 * Colunas NOT NULL (name, workspace_id, created_at) nunca recebem NULL: se o
 * valor vier undefined, a coluna fica de fora.
 */
const toDBPatch = (updates: Partial<CRMContact>) => ({
  ...(updates.name !== undefined ? { name: updates.name } : {}),
  ...(updates.workspaceId !== undefined ? { workspace_id: updates.workspaceId } : {}),
  ...(updates.createdAt !== undefined ? { created_at: updates.createdAt } : {}),

  ...("role" in updates ? { role: updates.role ?? null } : {}),
  ...("phone" in updates ? { phone: updates.phone ?? null } : {}),
  ...("email" in updates ? { email: updates.email ?? null } : {}),
  ...("linkedIn" in updates ? { linked_in: updates.linkedIn ?? null } : {}),
  ...("personType" in updates ? { person_type: updates.personType ?? null } : {}),
  ...("cpf" in updates ? { cpf: updates.cpf ?? null } : {}),
  ...("notes" in updates ? { notes: updates.notes ?? null } : {}),
  ...("deletedAt" in updates ? { deleted_at: updates.deletedAt ?? null } : {}),

  ...("companyId" in updates ? { company_id: isUUID(updates.companyId) ? updates.companyId : null } : {}),
  ...("assignedTo" in updates ? { assigned_to: isUUID(updates.assignedTo) ? updates.assignedTo : null } : {}),

  ...("qualificationBant" in updates ? { qualification_bant: (updates.qualificationBant || {}) as Json } : {}),
  ...("qualificationScore" in updates ? { qualification_score: updates.qualificationScore ?? null } : {}),
  ...("qualificationClassification" in updates ? { qualification_classification: updates.qualificationClassification ?? null } : {}),
  ...("qualificationCompletedAt" in updates ? { qualification_completed_at: updates.qualificationCompletedAt ?? null } : {}),
  ...("qualificationResponsible" in updates ? { qualification_responsible: updates.qualificationResponsible ?? null } : {}),
});

const fromDB = (row: any): CRMContact => ({
  id: row.id,
  name: row.name,
  role: row.role || undefined,
  phone: row.phone || undefined,
  email: row.email || undefined,
  linkedIn: row.linked_in || undefined,
  companyId: row.company_id || undefined,
  personType: row.person_type || undefined,
  cpf: row.cpf || undefined,
  workspaceId: row.workspace_id,
  notes: row.notes || undefined,
  assignedTo: row.assigned_to || undefined,
  qualificationBant: row.qualification_bant || undefined,
  qualificationScore: row.qualification_score ?? undefined,
  qualificationClassification: row.qualification_classification || undefined,
  qualificationCompletedAt: row.qualification_completed_at || undefined,
  qualificationResponsible: row.qualification_responsible || undefined,
  createdAt: row.created_at,
  deletedAt: row.deleted_at || undefined,
});

export const useCRMContactsStore = create<ContactsState>((set) => ({
  contacts: [],
  isLoading: false,
  fetchContacts: async (workspaceId: string) => {
    set({ isLoading: true });
    const { data, error } = await db
      .from("crm_contacts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching contacts:", error);
      set({ isLoading: false });
      return;
    }

    if (data) {
      set({ contacts: data.map(fromDB), isLoading: false });
    }
  },
  addContact: async (contact) => {
    const normalizedPhone = normalizePhone(contact.phone);

    if (normalizedPhone) {
      const { data: deletedMatches, error: lookupError } = await db
        .from("crm_contacts")
        .select("*")
        .eq("workspace_id", contact.workspaceId)
        .not("deleted_at", "is", null);

      if (lookupError) {
        console.error("Error checking for deleted contact:", lookupError);
      }

      const deletedMatch = (deletedMatches || []).find(
        (row: any) => normalizePhone(row.phone) === normalizedPhone
      );

      if (deletedMatch) {
        const revived: CRMContact = {
          ...fromDB(deletedMatch),
          ...contact,
          id: deletedMatch.id,
          createdAt: deletedMatch.created_at,
          deletedAt: undefined,
        };

        const { error } = await db
          .from("crm_contacts")
          .update({ ...toDB(revived), deleted_at: null })
          .eq("id", deletedMatch.id);

        if (error) {
          console.error("Error reactivating contact:", error);
          throw error;
        }

        set((state) => ({ contacts: [...state.contacts, revived] }));
        return revived;
      }
    }

    const newContactId = crypto.randomUUID();
    const newContact: CRMContact = {
      ...contact,
      id: newContactId,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({ contacts: [...state.contacts, newContact] }));

    const { error } = await db.from("crm_contacts").insert(toDB(newContact));

    if (error) {
      console.error("Error adding contact:", error);
      set((state) => ({ contacts: state.contacts.filter((c) => c.id !== newContactId) }));
      throw error;
    }

    return newContact;
  },
  updateContact: async (id, updates) => {
    let previousContacts: CRMContact[] = [];
    set((state) => {
      previousContacts = state.contacts;
      return {
        contacts: state.contacts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      };
    });

    const { error } = await db.from("crm_contacts").update(toDBPatch(updates)).eq("id", id);

    if (error) {
      console.error("Error updating contact:", error);
      set({ contacts: previousContacts });
      throw error;
    }
  },
  removeContact: async (id) => {
    const deletedAt = new Date().toISOString();
    let previousContacts: CRMContact[] = [];
    set((state) => {
      previousContacts = state.contacts;
      return {
        contacts: state.contacts.filter((c) => c.id !== id),
      };
    });

    const { error } = await db.from("crm_contacts").update({ deleted_at: deletedAt }).eq("id", id);
    if (error) {
      console.error("Error deleting contact:", error);
      set({ contacts: previousContacts });
      throw error;
    }
  },
}));
