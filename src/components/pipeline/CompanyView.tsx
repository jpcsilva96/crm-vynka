import { useState, useMemo } from "react";
import { ArrowLeft, Plus, Building2, ChevronDown, ChevronUp, Phone, Mail, Sparkles, Check, ChevronsUpDown, User, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useOptionLabels } from "@/lib/optionListsStore";
import { useCRMCompaniesStore } from "@/lib/crmCompaniesStore";
import { useCRMContactsStore } from "@/lib/crmContactsStore";
import { companyIdsOfContact, filterContactsByCompany, useCRMContactCompaniesStore } from "@/lib/crmContactCompaniesStore";
import { useDealsStore } from "@/lib/dealsStore";
import { useUsersStore } from "@/lib/usersStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { InlineEditField } from "./InlineEditField";
import { AssociateContactDialog } from "./AssociateContactDialog";
import { CreateDealDialog } from "./CreateDealDialog";
import { UserAvatar } from "./UserAvatar";
import { CustomerAnalysis } from "./CustomerAnalysis";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, isValidBrazilianPhone } from "@/lib/utils";
import { DEAL_STATUS_BADGE_CLASS, DEAL_STATUS_LABEL, getDealStatus } from "@/lib/dealStatus";
import { toast } from "sonner";
import { canViewAssignedRecord, canViewDeal } from "@/lib/permissions";
import type { Role } from "@/lib/rolesStore";
import type { UserProfile } from "@/lib/usersStore";

interface Props {
  companyId: string;
  onBack: () => void;
  onOpenDeal: (dealId: string) => void;
  onOpenCompany: (companyId: string) => void;
  currentUser?: UserProfile;
  currentUserRole?: Role;
}

export function CompanyView({ companyId, onBack, onOpenDeal, onOpenCompany, currentUser, currentUserRole }: Props) {
  const { companies, updateCompany, removeCompany } = useCRMCompaniesStore();
  const { contacts, updateContact } = useCRMContactsStore();
  const contactCompanyLinks = useCRMContactCompaniesStore((state) => state.links);
  const unlinkContactFromCompany = useCRMContactCompaniesStore((state) => state.unlinkCompany);
  const { deals } = useDealsStore();

  const [activeTab, setActiveTab] = useState<"Análise da Empresa" | "Outras Negociações">("Análise da Empresa");
  const [showAssociate, setShowAssociate] = useState(false);
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [expandedContacts, setExpandedContacts] = useState<Record<string, boolean>>({});
  const [contactToUnlink, setContactToUnlink] = useState<{ id: string; name: string } | null>(null);
  const [openAssignedBox, setOpenAssignedBox] = useState(false);
  const [showDeleteCompany, setShowDeleteCompany] = useState(false);
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);

  const { users } = useUsersStore();
  const { activeWorkspaceId } = useWorkspaceStore();

  const company = companies.find(c => c.id === companyId);
  // o segmento já gravado entra na lista mesmo se a opção tiver sido desativada
  const segmentOptions = useOptionLabels("segment", company?.segment);
  const canViewCompany = canViewAssignedRecord(currentUserRole, currentUser, company?.assignedTo, "companies");
  const parentCompany = company?.parentCompanyId ? companies.find((c) => c.id === company.parentCompanyId) : null;
  const branchCompanies = useMemo(() => companies.filter((c) => c.parentCompanyId === companyId), [companies, companyId]);

  // Fase 4: um contato pode atuar em várias empresas, e precisa aparecer na ficha
  // de todas elas — não só naquela que é a principal dele (crm_contacts.company_id).
  const companyContacts = useMemo(() => {
    return filterContactsByCompany(contacts, contactCompanyLinks, companyId)
      .filter((contact) => canViewAssignedRecord(currentUserRole, currentUser, contact.assignedTo, "contacts"));
  }, [contacts, contactCompanyLinks, companyId, currentUser, currentUserRole]);

  const companyDeals = useMemo(() => {
    if (!company) return [];
    return deals.filter(d =>
      canViewDeal(currentUserRole, currentUser, d) &&
      (
        // Match by ID (new deals) or by company name (legacy deals)
        d.companyId === company.id ||
        (d.companyName && d.companyName.toLowerCase() === company.name.toLowerCase())
      )
    );
  }, [deals, company, currentUser, currentUserRole]);

  // Fase 4 (D4): desvincular tira o contato DESTA empresa, não a empresa do
  // contato. Se a que sai era a principal, outra das empresas dele assume; só
  // fica sem empresa quem não tem mais nenhuma. As negociações guardam a própria
  // empresa e não são afetadas — por isso o aviso conta, mas não bloqueia.
  const dealsOfContactHere = (contactId: string) =>
    companyDeals.filter((d) => d.contactId === contactId || d.primaryContactId === contactId);

  const handleUnlinkContact = async () => {
    if (!contactToUnlink) return;
    const contact = contacts.find((c) => c.id === contactToUnlink.id);
    // Calculado ANTES do unlink: o store é otimista e já teria removido a linha.
    const remaining = contact
      ? companyIdsOfContact(contactCompanyLinks, contact.id, contact.companyId).filter(
          (id) => id !== companyId,
        )
      : [];

    try {
      await unlinkContactFromCompany(contactToUnlink.id, companyId);
      if (contact?.companyId === companyId) {
        await updateContact(contact.id, { companyId: remaining[0] });
      }
      toast.success(`${contactToUnlink.name} foi desvinculado de ${company?.name ?? "esta empresa"}.`);
    } catch {
      toast.error("Não foi possível desvincular o contato. Tente novamente.");
    }
    setContactToUnlink(null);
  };

  if (!company) {
    return <div className="p-8 text-center text-muted-foreground">Empresa não encontrada.</div>;
  }

  if (!canViewCompany) {
    return <div className="p-8 text-center text-muted-foreground">Empresa não liberada para o seu perfil.</div>;
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const valorAndamento = companyDeals.filter(d => getDealStatus(d) === "open").reduce((acc, d) => acc + (d.value || 0), 0);
  const valorVendido = companyDeals.filter(d => getDealStatus(d) === "won").reduce((acc, d) => acc + (d.value || 0), 0);
  const valorPerdido = companyDeals.filter(d => getDealStatus(d) === "lost").reduce((acc, d) => acc + (d.value || 0), 0);
  const totalNegociacoes = companyDeals.length;
  const wonDeals = companyDeals.filter(d => getDealStatus(d) === "won");
  const ticketMedio = wonDeals.length > 0 ? valorVendido / wonDeals.length : 0;

  const toggleContact = (id: string) => {
    setExpandedContacts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const handleDeleteCompany = async () => {
    setIsDeletingCompany(true);
    try {
      await removeCompany(company.id);
      toast.success("Empresa excluída");
      setShowDeleteCompany(false);
      onBack();
    } catch (error) {
      console.error("Erro ao excluir empresa:", error);
      toast.error("Erro ao excluir empresa");
    } finally {
      setIsDeletingCompany(false);
    }
  };



  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-16 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <button type="button" onClick={onBack} className="transition-colors hover:text-primary">
                Empresas
              </button>
              <span>/</span>
              <span className="truncate text-foreground">Empresa</span>
            </div>
            <h1 className="text-lg font-semibold text-foreground">{company.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowDeleteCompany(true)} className="text-destructive hover:text-destructive">
            <Trash2 className="w-5 h-5" />
          </Button>
          <Button onClick={() => setShowCreateDeal(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar negociação
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="flex h-full w-[380px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card custom-scrollbar lg:w-[420px]">
          <Accordion type="multiple" defaultValue={["cadastro", "contatos"]} className="w-full">
            {/* Cadastro Section */}
            <AccordionItem value="cadastro" className="border-b border-border/50">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 text-sm font-bold">
                Cadastro
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-2 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-2 py-1">
                    <span className="text-xs text-muted-foreground min-w-[140px] shrink-0 pt-2 uppercase font-semibold">Empresa <span className="text-red-500">*</span></span>
                    <div className="flex-1">
                      <InlineEditField
                        value={company.name}
                        onSave={(v) => updateCompany(company.id, { name: v })}
                        className="font-medium"
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2 py-1">
                    <span className="text-xs text-muted-foreground min-w-[140px] shrink-0 pt-2 uppercase font-semibold">Segmento</span>
                    <div className="flex-1">
                      <Select
                        value={company.segment || ""}
                        onValueChange={(v) => updateCompany(company.id, { segment: v })}
                      >
                        <SelectTrigger className="h-8 border-transparent bg-transparent hover:border-input focus:ring-0 px-1 shadow-none font-medium">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {segmentOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 py-1">
                    <span className="text-xs text-muted-foreground min-w-[140px] shrink-0 pt-2 uppercase font-semibold">Tipo</span>
                    <div className="flex-1">
                      <span className="flex h-8 items-center px-1 text-sm font-medium text-foreground">
                        {company.companyType === "FILIAL" ? "Filial" : "Matriz"}
                      </span>
                    </div>
                  </div>
                  {company.companyType === "FILIAL" ? (
                    <div className="flex items-start gap-2 py-1">
                      <span className="text-xs text-muted-foreground min-w-[140px] shrink-0 pt-2 uppercase font-semibold">Empresa Matriz</span>
                      <div className="flex-1">
                        {parentCompany ? (
                          <button
                            onClick={() => onOpenCompany(parentCompany.id)}
                            className="flex h-8 items-center px-1 text-sm font-medium text-primary hover:underline"
                          >
                            {parentCompany.name}
                          </button>
                        ) : (
                          <span className="flex h-8 items-center px-1 text-sm italic text-muted-foreground">Nenhuma matriz vinculada</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 py-1">
                      <span className="text-xs text-muted-foreground min-w-[140px] shrink-0 pt-2 uppercase font-semibold">Filiais</span>
                      <div className="flex-1">
                        <span className="flex h-8 items-center px-1 text-sm font-medium text-foreground">{branchCompanies.length}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2 py-1">
                    <span className="text-xs text-muted-foreground min-w-[140px] shrink-0 pt-2 uppercase font-semibold">CNPJ</span>
                    <div className="flex-1">
                      <InlineEditField
                        value={company.cnpj || ""}
                        placeholder="00.000.000/0000-00"
                        onSave={(v) => updateCompany(company.id, { cnpj: v })}
                        className="font-medium"
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2 py-1">
                    <span className="text-xs text-muted-foreground min-w-[140px] shrink-0 pt-2 uppercase font-semibold">URL</span>
                    <div className="flex-1">
                      <InlineEditField
                        value={company.url || ""}
                        placeholder="www.empresa.com"
                        onSave={(v) => updateCompany(company.id, { url: v })}
                        className="font-medium"
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2 py-1">
                    <span className="text-xs text-muted-foreground min-w-[140px] shrink-0 pt-2 uppercase font-semibold">Responsável Interno</span>
                    <div className="flex-1">
                      <Popover open={openAssignedBox} onOpenChange={setOpenAssignedBox}>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full justify-between h-8 border-transparent bg-transparent hover:border-input px-1 shadow-none font-medium"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              {(() => {
                                const u = users.find(x => x.id === company.assignedTo);
                                return (
                                  <>
                                    <UserAvatar 
                                      name={u?.name || "S"} 
                                      avatar={u?.avatar} 
                                      className="w-5 h-5"
                                    />
                                    <span className="truncate">{u?.name || "Selecionar"}</span>
                                  </>
                                );
                              })()}
                            </div>
                            <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-0" align="start">
                          <div className="p-2 border-b border-border bg-muted/20">
                            <p className="text-xs font-bold text-muted-foreground uppercase px-2">Mudar responsável</p>
                          </div>
                          <div className="max-h-60 overflow-y-auto p-1">
                            {users.map(u => (
                              <button
                                key={u.id}
                                onClick={() => {
                                  updateCompany(company.id, { assignedTo: u.id });
                                  setOpenAssignedBox(false);
                                }}
                                className="flex items-center gap-2 w-full p-2 hover:bg-muted rounded-md transition-colors"
                              >
                                <UserAvatar name={u.name} avatar={u.avatar} className="w-5 h-5" />
                                <div className="text-left">
                                  <p className="text-sm font-medium">{u.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{u.email}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {company.companyType === "MATRIZ" && (
              <AccordionItem value="branches" className="border-b border-border/50">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 text-sm font-bold">
                  Filiais Vinculadas
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  {branchCompanies.length === 0 ? (
                    <div className="py-2 text-sm italic text-muted-foreground">Nenhuma filial vinculada.</div>
                  ) : (
                    <div className="space-y-1">
                      {branchCompanies.map((branch) => (
                        <button
                          key={branch.id}
                          onClick={() => onOpenCompany(branch.id)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/30"
                        >
                          <span className="text-sm font-medium text-primary hover:underline">{branch.name}</span>
                          <span className="text-xs text-muted-foreground">{branch.cnpj || "-"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Contatos Section */}
            <AccordionItem value="contatos" className="border-b border-border/50">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 text-sm font-bold">
                Contatos Associados
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-2">
                {companyContacts.length === 0 && (
                  <div className="text-sm text-muted-foreground italic py-2">Nenhum contato associado.</div>
                )}
                <div className="space-y-1">
                  {companyContacts.map((contact, idx) => (
                    <div key={contact.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 hover:bg-muted/30 p-1.5 rounded-md group/name">
                        <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => toggleContact(contact.id)}>
                          <div className="w-6 h-6 rounded-full bg-[#00d0f1] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            {getInitials(contact.name)}
                          </div>
                          <span className="text-sm font-bold text-foreground">{contact.name}</span>
                          {expandedContacts[contact.id] ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/name:opacity-100 transition-opacity"
                          onClick={() => setContactToUnlink({ id: contact.id, name: contact.name })}
                          title="Desvincular contato desta empresa"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      {expandedContacts[contact.id] && (
                        <div className="space-y-3 px-1">
                          <div className="flex items-center gap-3 text-sm">
                            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                            <InlineEditField
                              value={contact.role || ""}
                              placeholder="Cargo"
                              emptyLabel="Cargo"
                              onSave={(v) => updateContact(contact.id, { role: v || undefined })}
                              className="font-medium text-foreground flex-1"
                            />
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                            <InlineEditField
                              value={contact.phone || ""}
                              maskType="phone"
                              showCopy
                              placeholder="Telefone"
                              emptyLabel="Sem telefone"
                              onSave={(v) => {
                                if (v && v.trim()) {
                                  if (!isValidBrazilianPhone(v)) {
                                    toast.error("Informe um telefone válido com DDD. Exemplo: (11) 99999-9999.");
                                    return;
                                  }
                                  const exists = contacts.find(c => 
                                    c.workspaceId === contact.workspaceId && 
                                    c.phone === v && 
                                    c.id !== contact.id
                                  );
                                  if (exists) {
                                    toast.error("Este telefone já está cadastrado em outro contato.");
                                    return;
                                  }
                                }
                                updateContact(contact.id, { phone: v || undefined });
                              }}
                              className="font-medium text-foreground flex-1"
                            />
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                            <InlineEditField
                              value={contact.email || ""}
                              placeholder="E-mail"
                              emptyLabel="Sem e-mail"
                              onSave={(v) => {
                                if (v && v.trim()) {
                                  const exists = contacts.find(c => 
                                    c.workspaceId === contact.workspaceId && 
                                    c.email === v && 
                                    c.id !== contact.id
                                  );
                                  if (exists) {
                                    toast.error("Este e-mail já está cadastrado em outro contato.");
                                    return;
                                  }
                                }
                                updateContact(contact.id, { email: v || undefined });
                              }}
                              className="font-medium text-foreground flex-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-2 text-[#00adc7] hover:text-[#008ba1] hover:bg-[#00adc7]/5 font-bold h-10 -ml-2"
                    onClick={() => setShowAssociate(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar contato
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Resumo Section */}
            <AccordionItem value="obs" className="border-b-0 border-border/50">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 text-sm font-bold">
                Resumo
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-8 pt-2">
                <InlineEditField
                  value={company.notes || ""}
                  placeholder="Descreva a empresa..."
                  emptyLabel="Nenhuma observação adicionada."
                  multiline
                  onSave={(v) => updateCompany(company.id, { notes: v || undefined })}
                  className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg min-h-[100px]"
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <div className="h-8 shrink-0" />
        </aside>

        {/* Main Content Area */}
        <main className="flex flex-1 flex-col overflow-hidden bg-background">
          <div className="flex items-center border-b border-border bg-card px-8">
            <button
              className={`border-b-2 px-4 py-4 text-sm font-semibold transition-colors ${activeTab === "Análise da Empresa" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("Análise da Empresa")}
            >
              Análise da Empresa
            </button>
            <button
              className={`border-b-2 px-4 py-4 text-sm font-semibold transition-colors ${activeTab === "Outras Negociações" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("Outras Negociações")}
            >
              Outras Negociações
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            {false && activeTab === "Outras Negociações" && (
              <div className="max-w-5xl space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#e0f7fa] p-5 rounded-lg flex flex-col">
                    <span className="text-sm font-medium text-muted-foreground">Valor total em andamento</span>
                    <span className="text-3xl font-bold mt-2 text-foreground">{formatCurrency(valorAndamento)}</span>
                  </div>
                  <div className="bg-[#e8f5e9] p-5 rounded-lg flex flex-col">
                    <span className="text-sm font-medium text-muted-foreground">Valor total vendido</span>
                    <span className="text-3xl font-bold mt-2 text-[#2e7d32]">{formatCurrency(valorVendido)}</span>
                  </div>
                  <div className="bg-[#ffebee] p-5 rounded-lg flex flex-col">
                    <span className="text-sm font-medium text-muted-foreground">Valor total perdido</span>
                    <span className="text-3xl font-bold mt-2 text-[#c62828]">{formatCurrency(valorPerdido)}</span>
                  </div>
                  <div className="bg-[#f5f5f5] p-5 rounded-lg flex flex-col">
                    <span className="text-sm font-medium text-muted-foreground">Total de negociações</span>
                    <span className="text-3xl font-bold mt-2 text-foreground">{totalNegociacoes}</span>
                  </div>
                  <div className="bg-[#f5f5f5] p-5 rounded-lg flex flex-col">
                    <span className="text-sm font-medium text-muted-foreground">Ticket médio</span>
                    <span className="text-3xl font-bold mt-2 text-foreground">{formatCurrency(ticketMedio)}</span>
                  </div>
                  <div className="bg-[#f5f5f5] p-5 rounded-lg flex flex-col">
                    <span className="text-sm font-medium text-muted-foreground">Tempo médio até a venda</span>
                    <span className="text-3xl font-bold mt-2 text-foreground flex items-baseline gap-1">0 <span className="text-sm font-normal text-muted-foreground">Dias</span></span>
                  </div>
                </div>

                <div className="w-full">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase border-b border-border/50">
                      <tr>
                        <th className="py-3 font-semibold">Negociação</th>
                        <th className="py-3 font-semibold">Responsável</th>
                        <th className="py-3 font-semibold">Status</th>
                        <th className="py-3 font-semibold">Valor Total</th>
                        <th className="py-3 font-semibold">Próxima Tarefa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {companyDeals.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            Nenhuma negociação encontrada.
                          </td>
                        </tr>
                      ) : (
                        companyDeals.map(deal => (
                          <tr key={deal.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-4">
                              <button
                                onClick={() => onOpenDeal(deal.id)}
                                className="font-semibold text-primary hover:underline text-base block text-left"
                              >
                                {deal.dealName || "Sem Título"}
                              </button>
                              <span className="text-xs text-muted-foreground">{deal.contactName || "Sem contato"}</span>
                            </td>
                            <td className="py-4">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground">
                                JP
                              </div>
                            </td>
                            <td className="py-4">
                              {getDealStatus(deal) === "won" ? (
                                <span className="px-3 py-1 bg-[#2e7d32] text-white text-[10px] font-bold rounded-sm uppercase">Ganha</span>
                              ) : getDealStatus(deal) === "lost" ? (
                                <span className="px-3 py-1 bg-[#c62828] text-white text-[10px] font-bold rounded-sm uppercase">Perdida</span>
                              ) : (
                                <span className="px-3 py-1 bg-[#00d0f1] text-white text-[10px] font-bold rounded-sm uppercase">Em Andamento</span>
                              )}
                            </td>
                            <td className="py-4 font-medium">
                              {formatCurrency(deal.value || 0)}
                            </td>
                            <td className="py-4 text-xs text-muted-foreground">—</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {companyDeals.length > 0 && (
                    <div className="flex items-center justify-between py-4 border-t border-border/50 text-xs text-muted-foreground">
                      <div>Exibindo {Math.min(10, companyDeals.length)} de {companyDeals.length} Negociações</div>
                      <div className="flex items-center gap-4">
                        <button className="hover:text-foreground disabled:opacity-50" disabled>Anterior</button>
                        <span className="font-bold text-foreground">1</span>
                        <button className="hover:text-foreground disabled:opacity-50" disabled>Próximo</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "Análise da Empresa" && (
              <div className="max-w-6xl">
                <CustomerAnalysis deals={companyDeals} title={`Análise da Empresa — ${company.name}`} showQualification={false} />
              </div>
            )}

            {activeTab === "Outras Negociações" && (
              <div className="mx-auto max-w-6xl rounded-xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-5 py-4">
                  <h2 className="text-lg font-semibold">Outras Negociações</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Todas as negociações vinculadas a esta empresa.</p>
                </div>
                {companyDeals.length === 0 ? (
                  <p className="p-10 text-center text-sm text-muted-foreground">Nenhuma negociação encontrada para esta empresa.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {companyDeals.map((deal) => (
                      <button key={deal.id} onClick={() => onOpenDeal(deal.id)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40">
                        <div>
                          <p className="font-semibold text-primary">{deal.dealName || "Sem título"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{deal.contactName || "Sem contato"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(deal.value || 0)}</p>
                          <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", DEAL_STATUS_BADGE_CLASS[getDealStatus(deal)])}>{DEAL_STATUS_LABEL[getDealStatus(deal)]}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <AssociateContactDialog
        open={showAssociate}
        onOpenChange={setShowAssociate}
        companyId={company.id}
        companyName={company.name}
      />

      <CreateDealDialog
        open={showCreateDeal}
        onOpenChange={setShowCreateDeal}
        defaultCompanyId={company.id}
        initialPersonType="Juridica"
        lockPersonType
      />

      <AlertDialog open={showDeleteCompany} onOpenChange={(open) => !isDeletingCompany && setShowDeleteCompany(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa <strong>{company.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCompany}>Cancelar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" disabled={isDeletingCompany} onClick={handleDeleteCompany}>
                {isDeletingCompany ? "Excluindo..." : "Excluir empresa"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!contactToUnlink} onOpenChange={(open) => !open && setContactToUnlink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular contato desta empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{contactToUnlink?.name}</strong> deixa de aparecer em <strong>{company.name}</strong>,
              mas continua no CRM e nas outras empresas em que estiver vinculado.
              {contactToUnlink && dealsOfContactHere(contactToUnlink.id).length > 0 && (
                <>
                  {" "}Atenção: ele tem{" "}
                  <strong>
                    {dealsOfContactHere(contactToUnlink.id).length}{" "}
                    {dealsOfContactHere(contactToUnlink.id).length === 1 ? "negociação" : "negociações"}
                  </strong>{" "}
                  nesta empresa. As negociações não são afetadas — só o vínculo de cadastro sai.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlinkContact}>Desvincular</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
