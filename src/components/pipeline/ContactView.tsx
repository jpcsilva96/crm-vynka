import { useState, useMemo } from "react";
import { ArrowLeft, Plus, Building2, ChevronDown, ChevronUp, Phone, Mail, Sparkles, Check, ChevronsUpDown, User, X, Briefcase, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useCRMCompaniesStore } from "@/lib/crmCompaniesStore";
import { useCRMContactsStore } from "@/lib/crmContactsStore";
import { useOptionLabels } from "@/lib/optionListsStore";
import { companyIdsOfContact, useCRMContactCompaniesStore } from "@/lib/crmContactCompaniesStore";
import { useDealsStore } from "@/lib/dealsStore";
import { useUsersStore } from "@/lib/usersStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { InlineEditField } from "./InlineEditField";
import { CreateDealDialog } from "./CreateDealDialog";
import { UserAvatar } from "./UserAvatar";
import { CustomerAnalysis } from "./CustomerAnalysis";
import { ContactQualificationTab } from "./ContactQualificationTab";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, isValidBrazilianPhone } from "@/lib/utils";
import { DEAL_STATUS_BADGE_CLASS, DEAL_STATUS_LABEL, getDealStatus } from "@/lib/dealStatus";
import { toast } from "sonner";
import { canViewAssignedRecord, canViewDeal } from "@/lib/permissions";
import type { Role } from "@/lib/rolesStore";
import type { UserProfile } from "@/lib/usersStore";

interface Props {
  contactId: string;
  onBack: () => void;
  /** rótulo do primeiro nível do caminho: "Contatos" quando veio da lista, "Negociação" quando veio de uma. */
  backLabel?: string;
  onOpenDeal: (dealId: string) => void;
  onOpenCompany: (companyId: string) => void;
  currentUser?: UserProfile;
  currentUserRole?: Role;
}

export function ContactView({ contactId, onBack, backLabel = "Contatos", onOpenDeal, onOpenCompany, currentUser, currentUserRole }: Props) {
  const { companies } = useCRMCompaniesStore();
  const { contacts, updateContact, removeContact } = useCRMContactsStore();
  const contactCompanyLinks = useCRMContactCompaniesStore((state) => state.links);
  const linkCompany = useCRMContactCompaniesStore((state) => state.linkCompany);
  const unlinkCompany = useCRMContactCompaniesStore((state) => state.unlinkCompany);
  const { deals } = useDealsStore();
  const { users } = useUsersStore();

  const [activeTab, setActiveTab] = useState<"Análise do Cliente" | "Outras Negociações" | "Qualificação">("Análise do Cliente");
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [openAssignedBox, setOpenAssignedBox] = useState(false);
  const [showDeleteContact, setShowDeleteContact] = useState(false);
  const [isDeletingContact, setIsDeletingContact] = useState(false);
  const [showLinkCompany, setShowLinkCompany] = useState(false);
  const [companyToUnlink, setCompanyToUnlink] = useState<{ id: string; name: string } | null>(null);
  const [searchLinkCompany, setSearchLinkCompany] = useState("");

  const contact = contacts.find(c => c.id === contactId);
  const roleOptions = useOptionLabels("contact_role", contact?.role);
  const canViewContact = canViewAssignedRecord(currentUserRole, currentUser, contact?.assignedTo, "contacts");
  const company = contact?.companyId ? companies.find(c => c.id === contact.companyId) : null;

  const contactDeals = useMemo(() => {
    if (!contact) return [];
    return deals.filter(d =>
      canViewDeal(currentUserRole, currentUser, d) &&
      (
        d.contactId === contact.id ||
        (contact.phone && d.phone === contact.phone) ||
        (contact.email && d.email === contact.email) ||
        (contact.name === d.contactName && !contact.phone && !d.phone)
      )
    );
  }, [deals, contact, currentUser, currentUserRole]);

  // Fase 4: as empresas em que este contato atua, a principal primeiro.
  const contactCompanies = useMemo(() => {
    if (!contact) return [];
    const ids = companyIdsOfContact(contactCompanyLinks, contact.id, contact.companyId);
    return ids
      .map((id) => companies.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => {
        if (a.id === contact.companyId) return -1;
        if (b.id === contact.companyId) return 1;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [contact, contactCompanyLinks, companies]);

  // Performance por empresa: os mesmos indicadores do contato, quebrados por CNPJ.
  // Nenhum dado novo — cada negociação já carrega a empresa dela.
  const performancePorEmpresa = useMemo(() => {
    return contactCompanies.map((empresa) => {
      const dealsDaEmpresa = contactDeals.filter((d) => d.companyId === empresa.id);
      const vendido = dealsDaEmpresa.filter((d) => getDealStatus(d) === "won").reduce((acc, d) => acc + (d.value || 0), 0);
      const andamento = dealsDaEmpresa
        .filter((d) => getDealStatus(d) === "open")
        .reduce((acc, d) => acc + (d.value || 0), 0);
      const perdido = dealsDaEmpresa.filter((d) => getDealStatus(d) === "lost").reduce((acc, d) => acc + (d.value || 0), 0);
      return { empresa, total: dealsDaEmpresa.length, vendido, andamento, perdido };
    });
  }, [contactCompanies, contactDeals]);

  if (!contact) {
    return <div className="p-8 text-center text-muted-foreground">Contato não encontrado.</div>;
  }

  if (!canViewContact) {
    return <div className="p-8 text-center text-muted-foreground">Contato não liberado para o seu perfil.</div>;
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const valorAndamento = contactDeals.filter(d => getDealStatus(d) === "open").reduce((acc, d) => acc + (d.value || 0), 0);
  const valorVendido = contactDeals.filter(d => getDealStatus(d) === "won").reduce((acc, d) => acc + (d.value || 0), 0);
  const valorPerdido = contactDeals.filter(d => getDealStatus(d) === "lost").reduce((acc, d) => acc + (d.value || 0), 0);
  const totalNegociacoes = contactDeals.length;
  const wonDeals = contactDeals.filter(d => getDealStatus(d) === "won");
  const ticketMedio = wonDeals.length > 0 ? valorVendido / wonDeals.length : 0;
  
  // Empresas do workspace em que este contato ainda NÃO atua.
  const companiesToOffer = companies.filter(
    (c) =>
      c.workspaceId === contact.workspaceId &&
      !c.deletedAt &&
      !contactCompanies.some((atual) => atual.id === c.id),
  );

  const handleLinkCompany = async (empresaId: string) => {
    try {
      await linkCompany(contact.id, empresaId, contact.workspaceId);
      // Primeira empresa do contato vira a principal; as seguintes só se somam.
      if (!contact.companyId) await updateContact(contact.id, { companyId: empresaId });
      toast.success("Empresa vinculada ao contato.");
    } catch {
      toast.error("Não foi possível vincular a empresa. Tente novamente.");
    }
    setShowLinkCompany(false);
    setSearchLinkCompany("");
  };

  // Desvincular tira o contato DESTA empresa. Se a que sai era a principal, a
  // próxima assume — o cadastro nunca fica sem principal tendo outra disponível.
  // As negociações guardam a própria empresa: o aviso conta, mas não bloqueia (D4).
  const dealsNaEmpresa = (empresaId: string) => contactDeals.filter((d) => d.companyId === empresaId);

  const handleUnlinkCompany = async () => {
    if (!companyToUnlink) return;
    const restantes = contactCompanies.filter((c) => c.id !== companyToUnlink.id);

    try {
      await unlinkCompany(contact.id, companyToUnlink.id);
      if (contact.companyId === companyToUnlink.id) {
        await updateContact(contact.id, { companyId: restantes[0]?.id });
      }
      toast.success(`Contato desvinculado de ${companyToUnlink.name}.`);
    } catch {
      toast.error("Não foi possível desvincular a empresa. Tente novamente.");
    }
    setCompanyToUnlink(null);
  };

  const handleDeleteContact = async () => {
    setIsDeletingContact(true);
    try {
      await removeContact(contact.id);
      toast.success("Contato excluído");
      setShowDeleteContact(false);
      onBack();
    } catch (error) {
      console.error("Erro ao excluir contato:", error);
      toast.error("Erro ao excluir contato");
    } finally {
      setIsDeletingContact(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-muted/20">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <button type="button" onClick={onBack} className="transition-colors hover:text-primary">
                {backLabel}
              </button>
              <span>/</span>
              <span className="truncate text-foreground">Contato</span>
            </div>
            <h1 className="text-lg font-semibold text-foreground">{contact.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowDeleteContact(true)} className="text-destructive hover:text-destructive">
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
        <aside className="flex h-full w-[420px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card custom-scrollbar lg:w-[480px] xl:w-[540px]">
          <Accordion type="multiple" defaultValue={["cadastro"]} className="w-full">
            {/* Cadastro Section */}
            <AccordionItem value="cadastro" className="border-b border-border/50">
              <AccordionTrigger className="px-5 py-4 text-sm font-semibold hover:bg-muted/50 hover:no-underline">
                Cadastro
              </AccordionTrigger>
              <AccordionContent className="space-y-4 px-5 pb-6 pt-2">
                <div className="space-y-3">
                  <div className="flex items-start gap-2 py-1">
                    <span className="min-w-[108px] shrink-0 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nome <span className="text-destructive">*</span></span>
                    <div className="flex-1">
                      <InlineEditField
                        value={contact.name}
                        onSave={(v) => updateContact(contact.id, { name: v })}
                        className="font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 py-1">
                    <span className="min-w-[108px] shrink-0 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Qualificação</span>
                    {contact.qualificationClassification ? (
                      <span className="mt-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{contact.qualificationClassification}</span>
                    ) : (
                      <span className="flex h-8 items-center text-sm text-muted-foreground">Não qualificado</span>
                    )}
                  </div>

                  <div className="flex items-start gap-2 py-1">
                    <span className="min-w-[108px] shrink-0 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tipo de pessoa</span>
                    <span className="flex h-8 items-center text-sm font-medium text-foreground">
                      {contact.personType === "Fisica" ? "Pessoa Física" : contact.personType === "Juridica" ? "Pessoa Jurídica" : "Não informado"}
                    </span>
                  </div>

                  {contact.personType !== "Fisica" && (
                    <div className="flex items-start gap-2 py-1">
                      <span className="min-w-[108px] shrink-0 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {contactCompanies.length > 1 ? `Empresas (${contactCompanies.length})` : "Empresa"}
                      </span>
                      <div className="flex-1">
                        {contactCompanies.length === 0 ? (
                          <span className="flex h-8 items-center px-1 text-sm italic text-muted-foreground">Nenhuma empresa</span>
                        ) : (
                          <div className="space-y-0.5">
                            {contactCompanies.map((empresa) => (
                              <div key={empresa.id} className="group/empresa flex min-w-0 items-center gap-1">
                                <button
                                  onClick={() => onOpenCompany(empresa.id)}
                                  title={empresa.name}
                                  className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 px-1 py-1 text-left text-sm font-medium text-primary hover:underline"
                                >
                                  <Building2 className="h-4 w-4 shrink-0" />
                                  {/* min-w-0 é o que permite o truncate encolher dentro do flex:
                                      sem ele o nome longo empurrava o selo "Principal" para fora
                                      da coluna e ele aparecia cortado. O flex-wrap do botão é a
                                      segunda rede — em painel muito estreito o selo desce de linha
                                      em vez de sumir. */}
                                  <span className="min-w-0 flex-1 truncate">{empresa.name}</span>
                                  {contactCompanies.length > 1 && empresa.id === contact.companyId && (
                                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                                      Principal
                                    </span>
                                  )}
                                </button>
                                {/* `hidden` e não `opacity-0`: invisível por opacidade, o botão
                                    continua ocupando ~110px da linha — largura roubada do nome da
                                    empresa mesmo quando ninguém está com o mouse ali. */}
                                {contactCompanies.length > 1 && empresa.id !== contact.companyId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="hidden h-7 shrink-0 px-2 text-[11px] text-muted-foreground group-hover/empresa:inline-flex"
                                    onClick={() => updateContact(contact.id, { companyId: empresa.id })}
                                    title="Tornar esta a empresa principal"
                                  >
                                    Tornar principal
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="hidden h-7 w-7 shrink-0 text-muted-foreground hover:bg-red-50 hover:text-red-500 group-hover/empresa:inline-flex"
                                  onClick={() => setCompanyToUnlink({ id: empresa.id, name: empresa.name })}
                                  title="Desvincular desta empresa"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-7 px-1 text-[11px] text-muted-foreground hover:text-primary"
                          onClick={() => setShowLinkCompany(true)}
                        >
                          <Plus className="mr-1 h-3 w-3" /> Vincular empresa
                        </Button>
                      </div>
                    </div>
                  )}

                  {contact.personType !== "Fisica" && (
                    <div className="flex items-start gap-2 py-1">
                      <span className="min-w-[108px] shrink-0 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cargo</span>
                      <div className="flex-1">
                        <InlineEditField
                          value={contact.role || ""}
                          placeholder="Selecione o cargo"
                          options={roleOptions}
                          onSave={(v) => updateContact(contact.id, { role: v })}
                          className="font-medium"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2 py-1">
                    <span className="min-w-[108px] shrink-0 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Telefone</span>
                    <div className="flex-1">
                      <InlineEditField
                        value={contact.phone || ""}
                        maskType="phone"
                        showCopy
                        placeholder="+55..."
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
                        className="font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 py-1">
                    <span className="min-w-[108px] shrink-0 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">E-mail</span>
                    <div className="flex-1">
                      <InlineEditField
                        value={contact.email || ""}
                        showCopy
                        placeholder="exemplo@email.com"
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
                        className="font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 py-1">
                    <span className="min-w-[108px] shrink-0 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">CPF</span>
                    <div className="flex-1">
                      <InlineEditField
                        value={contact.cpf || ""}
                        showCopy
                        placeholder="00000000000"
                        onSave={(v) => updateContact(contact.id, { cpf: v || undefined })}
                        className="font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 py-1">
                    <span className="min-w-[108px] shrink-0 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Responsável interno</span>
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
                                const u = users.find(x => x.id === contact.assignedTo);
                                return (
                                  <>
                                    <UserAvatar 
                                      name={u?.name || "S"} 
                                      avatar={u?.avatar} 
                                      size="xs"
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
                                  updateContact(contact.id, { assignedTo: u.id });
                                  setOpenAssignedBox(false);
                                }}
                                className="flex items-center gap-2 w-full p-2 hover:bg-muted rounded-md transition-colors"
                              >
                                <UserAvatar name={u.name} avatar={u.avatar} size="sm" />
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
          </Accordion>
          <div className="h-8 shrink-0" />
        </aside>

        {/* Main Content Area */}
        <main className="flex flex-1 flex-col overflow-hidden bg-background">
          <div className="flex items-center border-b border-border bg-card px-8">
            <button
              className={`border-b-2 px-4 py-4 text-sm font-semibold transition-colors ${activeTab === "Análise do Cliente" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("Análise do Cliente")}
            >
              Análise do Cliente
            </button>
            <button
              className={`border-b-2 px-4 py-4 text-sm font-semibold transition-colors ${activeTab === "Outras Negociações" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("Outras Negociações")}
            >
              Outras Negociações
            </button>
            <button
              className={`border-b-2 px-4 py-4 text-sm font-semibold transition-colors ${activeTab === "Qualificação" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("Qualificação")}
            >
              Qualificação
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            {activeTab === "Análise do Cliente" && (
              <div className="max-w-6xl space-y-6">
                <CustomerAnalysis
                  deals={contactDeals}
                  qualificationClassification={contact.qualificationClassification}
                  qualificationScore={contact.qualificationScore}
                  qualificationCompletedAt={contact.qualificationCompletedAt}
                  qualificationResponsible={contact.qualificationResponsible}
                />
                {/* Fase 4: como este comprador se comporta em cada CNPJ — pergunta que
                    a análise consolidada acima não separa. Fica FORA do bloco
                    `{false && ...}` logo abaixo, que desativa os quatro indicadores e a
                    tabela de negociações desta aba desde antes desta mudança. */}
                {performancePorEmpresa.length > 1 && (
                  <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="border-b border-border bg-muted/40 px-5 py-3">
                      <h3 className="text-sm font-semibold text-foreground">Performance por empresa</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {contact.name} atua em {performancePorEmpresa.length} empresas.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Empresa</th>
                            <th className="px-5 py-3 text-right font-semibold">Negociações</th>
                            <th className="px-5 py-3 text-right font-semibold">Em andamento</th>
                            <th className="px-5 py-3 text-right font-semibold">Vendido</th>
                            <th className="px-5 py-3 text-right font-semibold">Perdido</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {performancePorEmpresa.map((linha) => (
                            <tr key={linha.empresa.id} className="hover:bg-muted/40">
                              <td className="px-5 py-3">
                                <button
                                  onClick={() => onOpenCompany(linha.empresa.id)}
                                  className="flex items-center gap-2 text-left font-medium text-primary hover:underline"
                                >
                                  <span className="truncate">{linha.empresa.name}</span>
                                  {linha.empresa.id === contact.companyId && (
                                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                                      Principal
                                    </span>
                                  )}
                                </button>
                                {linha.empresa.cnpj && (
                                  <span className="mt-0.5 block text-xs text-muted-foreground">{linha.empresa.cnpj}</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-right tabular-nums">{linha.total}</td>
                              <td className="px-5 py-3 text-right tabular-nums">{formatCurrency(linha.andamento)}</td>
                              <td className="px-5 py-3 text-right font-semibold tabular-nums text-emerald-700">{formatCurrency(linha.vendido)}</td>
                              <td className="px-5 py-3 text-right tabular-nums text-destructive">{formatCurrency(linha.perdido)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {false && <>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Análise do Cliente</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Visão consolidada do relacionamento e das negociações deste contato.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col rounded-xl border border-primary/15 bg-primary/5 p-5 shadow-sm">
                    <span className="text-sm font-medium text-muted-foreground">Valor total em andamento</span>
                    <span className="text-3xl font-bold mt-2 text-foreground">{formatCurrency(valorAndamento)}</span>
                  </div>
                  <div className="flex flex-col rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                    <span className="text-sm font-medium text-muted-foreground">Valor total vendido</span>
                    <span className="mt-2 text-3xl font-bold text-emerald-700">{formatCurrency(valorVendido)}</span>
                  </div>
                  <div className="flex flex-col rounded-xl border border-destructive/15 bg-destructive/5 p-5 shadow-sm">
                    <span className="text-sm font-medium text-muted-foreground">Valor total perdido</span>
                    <span className="mt-2 text-3xl font-bold text-destructive">{formatCurrency(valorPerdido)}</span>
                  </div>
                  <div className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
                    <span className="text-sm font-medium text-muted-foreground">Total de negociações</span>
                    <span className="text-3xl font-bold mt-2 text-foreground">{totalNegociacoes}</span>
                  </div>
                  <div className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
                    <span className="text-sm font-medium text-muted-foreground">Ticket médio</span>
                    <span className="text-3xl font-bold mt-2 text-foreground">{formatCurrency(ticketMedio)}</span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-3 font-semibold">Negociação</th>
                        <th className="py-3 font-semibold">Responsável</th>
                        <th className="py-3 font-semibold">Status</th>
                        <th className="py-3 font-semibold">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {contactDeals.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-muted-foreground">
                            Nenhuma negociação encontrada para este contato.
                          </td>
                        </tr>
                      ) : (
                        contactDeals.map(deal => (
                          <tr key={deal.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-5 py-4">
                              <button
                                onClick={() => onOpenDeal(deal.id)}
                                className="font-semibold text-primary hover:underline text-base block text-left"
                              >
                                {deal.dealName || "Sem Título"}
                              </button>
                              <span className="text-xs text-muted-foreground">{companies.find((item) => item.id === deal.companyId)?.name || deal.companyName || company?.name || "Sem empresa"}</span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const u = users.find(x => x.id === deal.assignedTo);
                                  return (
                                    <>
                                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground">
                                        {u?.name?.substring(0, 2).toUpperCase() || "—"}
                                      </div>
                                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                                        {u?.name || "Não atribuído"}
                                      </span>
                                    </>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              {getDealStatus(deal) === "won" ? (
                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">Ganha</span>
                              ) : getDealStatus(deal) === "lost" ? (
                                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[10px] font-bold uppercase text-destructive">Perdida</span>
                              ) : (
                                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase text-primary">Em andamento</span>
                              )}
                            </td>
                            <td className="px-5 py-4 font-medium">
                              {formatCurrency(deal.value || 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {contactDeals.length > 0 && (
                    <div className="flex items-center justify-between border-t border-border px-5 py-4 text-xs text-muted-foreground">
                      <div>Exibindo {contactDeals.length} Negociações</div>
                    </div>
                  )}
                </div>
                </>}
              </div>
            )}

            {activeTab === "Outras Negociações" && (
              <div className="mx-auto max-w-6xl rounded-xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-5 py-4">
                  <h2 className="text-lg font-semibold">Outras Negociações</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Negociações vinculadas a este contato.</p>
                </div>
                {contactDeals.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">Nenhuma negociação encontrada para este contato.</p> : <div className="divide-y divide-border">{contactDeals.map((deal) => <button key={deal.id} onClick={() => onOpenDeal(deal.id)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/40"><div><p className="font-semibold text-primary">{deal.dealName || "Sem título"}</p><p className="mt-1 text-xs text-muted-foreground">{companies.find((item) => item.id === deal.companyId)?.name || deal.companyName || company?.name || "Sem empresa"}</p></div><div className="text-right"><p className="font-semibold">{formatCurrency(deal.value || 0)}</p><span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", DEAL_STATUS_BADGE_CLASS[getDealStatus(deal)])}>{DEAL_STATUS_LABEL[getDealStatus(deal)]}</span></div></button>)}</div>}
              </div>
            )}

            {activeTab === "Qualificação" && <ContactQualificationTab contact={contact} userName={currentUser?.name || "Usuário"} onUpdateContact={updateContact} />}
          </div>
        </main>
      </div>

      <CreateDealDialog
        open={showCreateDeal}
        onOpenChange={setShowCreateDeal}
      />

      <AlertDialog open={showDeleteContact} onOpenChange={(open) => !isDeletingContact && setShowDeleteContact(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o contato <strong>{contact.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingContact}>Cancelar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" disabled={isDeletingContact} onClick={handleDeleteContact}>
                {isDeletingContact ? "Excluindo..." : "Excluir contato"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showLinkCompany} onOpenChange={(open) => { setShowLinkCompany(open); if (!open) setSearchLinkCompany(""); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Vincular empresa</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {contact.name} passa a aparecer na lista de contatos desta empresa, sem deixar as outras.
          </p>
          <Command>
            <CommandInput placeholder="Buscar empresa..." value={searchLinkCompany} onValueChange={setSearchLinkCompany} />
            <CommandList>
              <CommandEmpty>Nenhuma empresa disponível.</CommandEmpty>
              <CommandGroup>
                {companiesToOffer.map((empresa) => (
                  <CommandItem key={empresa.id} value={empresa.name} onSelect={() => handleLinkCompany(empresa.id)}>
                    <Building2 className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{empresa.name}</span>
                    {empresa.cnpj && <span className="ml-2 shrink-0 text-xs text-muted-foreground">{empresa.cnpj}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!companyToUnlink} onOpenChange={(open) => !open && setCompanyToUnlink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular desta empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{contact.name}</strong> deixa de aparecer em <strong>{companyToUnlink?.name}</strong>,
              mas continua no CRM e nas outras empresas em que estiver vinculado.
              {companyToUnlink && dealsNaEmpresa(companyToUnlink.id).length > 0 && (
                <>
                  {" "}Atenção: ele tem{" "}
                  <strong>
                    {dealsNaEmpresa(companyToUnlink.id).length}{" "}
                    {dealsNaEmpresa(companyToUnlink.id).length === 1 ? "negociação" : "negociações"}
                  </strong>{" "}
                  nesta empresa. As negociações não são afetadas — só o vínculo de cadastro sai.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlinkCompany}>Desvincular</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
