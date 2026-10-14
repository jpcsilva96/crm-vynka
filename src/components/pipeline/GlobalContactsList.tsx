import { useMemo, useState } from "react";
import { useDealsStore } from "@/lib/dealsStore";
import { useCRMContactsStore } from "@/lib/crmContactsStore";
import { useCRMCompaniesStore } from "@/lib/crmCompaniesStore";
import { companyIdsOfContact, useCRMContactCompaniesStore } from "@/lib/crmContactCompaniesStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { maskCPF, maskPhone } from "@/lib/utils";
import { buildSearchText, matchesSearchTerm } from "@/lib/searchMatch";
import { exportRowsToExcel } from "@/lib/exportExcel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Download, Inbox, Plus, Search, Trash2, User, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type GlobalContact } from "./CreateContactDialog";
import { CreateContactDialog } from "./CreateContactDialog";
import { toast } from "sonner";
import { canViewAssignedRecord, canViewDeal } from "@/lib/permissions";
import type { Role } from "@/lib/rolesStore";
import type { UserProfile } from "@/lib/usersStore";
import { getQualificationBadgeTone } from "@/lib/qualificationBadge";

export type { GlobalContact } from "./CreateContactDialog";

interface Props {
  onOpenDeal: (dealId: string) => void;
  onOpenContact: (contactId: string) => void;
  currentUser?: UserProfile;
  currentUserRole?: Role;
}

type ContactListFilter = "all" | "physical" | "legal";

type ContactRow = GlobalContact & {
  /** texto já normalizado (nome, e-mail, cargo, empresas vinculadas) */
  searchText: string;
  /** campos comparados por dígitos: CPF, telefone e o CNPJ de cada empresa do contato */
  searchDigits: Array<string | undefined>;
};

export function GlobalContactsList({ onOpenDeal, onOpenContact, currentUser, currentUserRole }: Props) {
  const { deals } = useDealsStore();
  const { contacts } = useCRMContactsStore();
  const { companies } = useCRMCompaniesStore();
  const contactCompanyLinks = useCRMContactCompaniesStore((state) => state.links);
  const { activeWorkspaceId } = useWorkspaceStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingContact, setEditingContact] = useState<GlobalContact | undefined>(undefined);
  const [contactFilter, setContactFilter] = useState<ContactListFilter>("all");
  const [contactPendingDeletion, setContactPendingDeletion] = useState<GlobalContact | null>(null);
  const [isDeletingContact, setIsDeletingContact] = useState(false);
  const { removeContact } = useCRMContactsStore();

  const handleDeleteContact = async () => {
    if (!contactPendingDeletion) return;

    setIsDeletingContact(true);
    try {
      await removeContact(contactPendingDeletion.id);
      toast.success("Contato excluído");
      setContactPendingDeletion(null);
    } catch (error) {
      console.error("Erro ao excluir contato:", error);
      toast.error("Erro ao excluir contato");
    } finally {
      setIsDeletingContact(false);
    }
  };

  const mappedContacts = useMemo(() => {
    if (!activeWorkspaceId) return [];
    
    const wsDeals = deals
      .filter(d => d.workspaceId === activeWorkspaceId)
      .filter((deal) => canViewDeal(currentUserRole, currentUser, deal));
    const wsContacts = contacts
      .filter(c => c.workspaceId === activeWorkspaceId)
      .filter((contact) => canViewAssignedRecord(currentUserRole, currentUser, contact.assignedTo, "contacts"));
    
    return wsContacts.map(contact => {
      // Find deals associated with this contact: by ID (new) or by phone/email (legacy)
      const contactDeals = wsDeals.filter(d =>
        d.contactId === contact.id ||
        (contact.phone && d.phone === contact.phone) ||
        (contact.email && d.email === contact.email) ||
        (contact.name === d.contactName && !contact.phone && !d.phone)
      );

      const company = contact.companyId ? companies.find(c => c.id === contact.companyId)?.name : "";

      // Busca alcança TODAS as empresas do contato (Fase 4), não só a principal que a coluna mostra.
      const linkedCompanies = companyIdsOfContact(contactCompanyLinks, contact.id, contact.companyId)
        .map((companyId) => companies.find((item) => item.id === companyId))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      const mapped: ContactRow = {
        id: contact.id,
        name: contact.name,
        company: company || "",
        emails: contact.email ? [contact.email] : [],
        phones: contact.phone ? [contact.phone] : [],
        role: contact.role || "Não preenchido",
        deals: contactDeals,
        personType: contact.personType,
        cpf: contact.cpf,
        assignedTo: contact.assignedTo,
        qualificationClassification: contact.qualificationClassification,
        searchText: buildSearchText([
          contact.name,
          contact.email,
          contact.role,
          contact.personType,
          ...linkedCompanies.map((item) => item.name),
        ]),
        searchDigits: [contact.cpf, contact.phone, ...linkedCompanies.map((item) => item.cnpj)],
      };

      return mapped;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [deals, contacts, companies, contactCompanyLinks, activeWorkspaceId, currentUser, currentUserRole]);

  const filteredContacts = useMemo(() => {
    const byType = contactFilter === "physical"
      ? mappedContacts.filter((contact) => contact.personType === "Fisica")
      : contactFilter === "legal"
        ? mappedContacts.filter((contact) => contact.personType === "Juridica")
        : mappedContacts;

    return byType.filter((contact) => matchesSearchTerm(searchTerm, contact.searchText, contact.searchDigits));
  }, [contactFilter, mappedContacts, searchTerm]);

  const physicalContactsCount = useMemo(
    () => mappedContacts.filter((contact) => contact.personType === "Fisica").length,
    [mappedContacts],
  );
  const legalContactsCount = useMemo(
    () => mappedContacts.filter((contact) => contact.personType === "Juridica").length,
    [mappedContacts],
  );

  const showPhysicalColumns = contactFilter === "physical";
  const showLegalColumns = contactFilter !== "physical";
  const tableColumnCount = showPhysicalColumns ? 7 : contactFilter === "all" ? 8 : 7;

  const handleExportContacts = () => {
    exportRowsToExcel({
      filename: `contatos-${new Date().toISOString().slice(0, 10)}`,
      sheetName: "Contatos",
      rows: filteredContacts,
      columns: [
        { header: "Nome", value: "name" },
        { header: "Tipo de Pessoa", value: (contact) => contact.personType || "—" },
        {
          header: "CPF/CNPJ",
          value: (contact) => {
            const company = companies.find((item) => item.workspaceId === activeWorkspaceId && item.name === contact.company);
            return contact.cpf || company?.cnpj || "—";
          },
        },
        { header: "Empresa", value: (contact) => contact.company || "—" },
        { header: "E-mails", value: (contact) => contact.emails.join(", ") || "—" },
        { header: "Telefones", value: (contact) => contact.phones.map((phone) => maskPhone(phone)).join(", ") || "—" },
        { header: "Cargo", value: (contact) => contact.role || "—" },
        { header: "Negociações", value: (contact) => contact.deals.length },
      ],
    });

    toast.success(`Excel de contatos exportado com ${filteredContacts.length} registro${filteredContacts.length === 1 ? "" : "s"}.`);
  };

  return (
    <div className="bg-card rounded-md border shadow-sm flex-1 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-lg bg-muted p-1" role="tablist" aria-label="Filtrar contatos por tipo de pessoa">
          <Button type="button" size="sm" variant={contactFilter === "all" ? "default" : "ghost"} className="gap-2 rounded-md" onClick={() => setContactFilter("all")} role="tab" aria-selected={contactFilter === "all"}>
            <Users className="h-4 w-4" /> Todos ({mappedContacts.length})
          </Button>
          <Button type="button" size="sm" variant={contactFilter === "physical" ? "default" : "ghost"} className="gap-2 rounded-md" onClick={() => setContactFilter("physical")} role="tab" aria-selected={contactFilter === "physical"}>
            <User className="h-4 w-4" /> Pessoa Física ({physicalContactsCount})
          </Button>
          <Button type="button" size="sm" variant={contactFilter === "legal" ? "default" : "ghost"} className="gap-2 rounded-md" onClick={() => setContactFilter("legal")} role="tab" aria-selected={contactFilter === "legal"}>
            <Building2 className="h-4 w-4" /> Pessoa Jurídica ({legalContactsCount})
          </Button>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative w-full max-w-[320px] min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nome, telefone, CPF/CNPJ..."
              aria-label="Buscar contatos"
              className="pl-9 pr-9"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <Button variant="outline" onClick={handleExportContacts} className="gap-2" disabled={filteredContacts.length === 0}>
            <Download className="w-4 h-4" />
            Exportar Excel
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Contato
          </Button>
        </div>
      </div>
      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b hover:bg-muted/50">
              <TableHead className="font-semibold text-muted-foreground h-10 align-middle">Nome do Contato</TableHead>
              {contactFilter === "all" && <TableHead className="font-semibold text-muted-foreground h-10 align-middle">Tipo</TableHead>}
              {showPhysicalColumns && <TableHead className="font-semibold text-muted-foreground h-10 align-middle">CPF</TableHead>}
              {showPhysicalColumns && <TableHead className="font-semibold text-muted-foreground h-10 align-middle">Qualificação</TableHead>}
              {showLegalColumns && <TableHead className="font-semibold text-muted-foreground h-10 align-middle">Empresa</TableHead>}
              <TableHead className="font-semibold text-muted-foreground h-10 align-middle">E-mails</TableHead>
              <TableHead className="font-semibold text-muted-foreground h-10 align-middle">Telefones</TableHead>
              {showLegalColumns && <TableHead className="font-semibold text-muted-foreground h-10 align-middle">Cargo</TableHead>}
              <TableHead className="font-semibold text-muted-foreground h-10 align-middle text-center">Negociações</TableHead>
              <TableHead className="font-semibold text-muted-foreground h-10 align-middle text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={tableColumnCount} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground opacity-60">
                    <Inbox className="w-16 h-16 stroke-[1] mb-4 text-muted-foreground/30" />
                    <span className="text-sm font-medium">
                      {searchTerm.trim() ? `Nenhum contato encontrado para "${searchTerm.trim()}"` : "Não há contatos cadastrados"}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => (
                <TableRow 
                  key={contact.id} 
                  className="hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="py-3">
                    <button 
                      onClick={() => onOpenContact(contact.id)}
                      className="font-semibold text-primary hover:underline flex items-center text-left"
                    >
                      {contact.name}
                    </button>
                  </TableCell>
                  {contactFilter === "all" && <TableCell className="py-3 text-sm text-muted-foreground">{contact.personType || "—"}</TableCell>}
                  {showPhysicalColumns && <TableCell className="py-3 text-sm text-muted-foreground">{contact.cpf ? maskCPF(contact.cpf) : "—"}</TableCell>}
                  {showPhysicalColumns && <TableCell className="py-3"><QualificationBadge classification={contact.qualificationClassification} /></TableCell>}
                  <TableCell className="py-3 font-medium text-foreground" style={{ display: showLegalColumns ? undefined : "none" }}>
                    {contact.company || "—"}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-muted-foreground">
                    {contact.emails.length > 0 ? contact.emails.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-muted-foreground">
                    {contact.phones.length > 0 ? contact.phones.map(p => maskPhone(p)).join(", ") : "—"}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-muted-foreground" style={{ display: showLegalColumns ? undefined : "none" }}>
                    {contact.role}
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <button 
                      onClick={() => onOpenContact(contact.id)}
                      className="inline-flex items-center justify-center min-w-[32px] h-7 px-2 rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
                    >
                      {contact.deals.length}
                    </button>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setContactPendingDeletion(contact)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      

      <CreateContactDialog 
        open={showCreate} 
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) setEditingContact(undefined);
        }} 
        initialData={editingContact}
      />

      <AlertDialog
        open={contactPendingDeletion !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingContact) setContactPendingDeletion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o contato <strong>{contactPendingDeletion?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingContact}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDeleteContact} disabled={isDeletingContact}>
              {isDeletingContact ? "Excluindo..." : "Excluir contato"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function QualificationBadge({ classification }: { classification?: string }) {
  if (!classification) return <span className="text-sm text-muted-foreground">—</span>;
  // Cor: a mesma do card do Kanban (src/lib/qualificationBadge.ts).
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getQualificationBadgeTone(classification)}`}>{classification}</span>;
}
