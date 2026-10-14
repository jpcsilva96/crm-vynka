import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDealsStore, type DealStage, QUALIFICATION_REQUIRED_STAGES } from "@/lib/dealsStore";
import { useCRMContactsStore, type CRMContact } from "@/lib/crmContactsStore";
import { useOptionLabels } from "@/lib/optionListsStore";
import { useCRMCompaniesStore, type CRMCompany } from "@/lib/crmCompaniesStore";
import { companyIdsOfContact, contactBelongsToCompany, filterContactsByCompany, useCRMContactCompaniesStore } from "@/lib/crmContactCompaniesStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { useUsersStore } from "@/lib/usersStore";
import { useCRMPipelinesStore } from "@/lib/crmPipelinesStore";
import { usePipelineStagesStore } from "@/lib/pipelineStagesStore";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, isPastLocalDate, isValidBrazilianPhone, maskPhone, maskCNPJ, maskCPF } from "@/lib/utils";
import { ClosingDateInput } from "@/components/pipeline/ClosingDateInput";
import { UserAvatar } from "./UserAvatar";
import { Check, ChevronsUpDown, Plus, Phone, Mail, X, Briefcase, CreditCard } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPhone?: string;
  defaultName?: string;
  defaultContactId?: string;
  initialPersonType?: "Fisica" | "Juridica";
  lockPersonType?: boolean;
  defaultPipelineId?: string;
  /** Abre a negociação já amarrada a uma empresa (usado pelo botão dentro da própria empresa). */
  defaultCompanyId?: string;
}

export function CreateDealDialog({ open, onOpenChange, defaultPhone, defaultName, defaultContactId, initialPersonType = "Fisica", lockPersonType = false, defaultPipelineId, defaultCompanyId }: Props) {
  const [dealName, setDealName] = useState("");
  const [personType, setPersonType] = useState<"Fisica" | "Juridica">(initialPersonType);
  const [pipelineId, setPipelineId] = useState(defaultPipelineId || "");
  const [stage, setStage] = useState<DealStage>("leads");
  const [closingDate, setClosingDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [openAssignedBox, setOpenAssignedBox] = useState(false);
  
  // Company Form State (Juridica)
  const [openCompanyBox, setOpenCompanyBox] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [searchCompany, setSearchCompany] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [internalSearch, setInternalSearch] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [showCreateCompanyForm, setShowCreateCompanyForm] = useState(false);

  // Contact Form State
  const [openContactBox, setOpenContactBox] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [searchContact, setSearchContact] = useState(defaultName || "");
  const [contactPhone, setContactPhone] = useState(defaultPhone || "");
  const [contactEmail, setContactEmail] = useState("");
  const [contactCpf, setContactCpf] = useState("");
  const [contactRole, setContactRole] = useState("");
  const roleOptions = useOptionLabels("contact_role", contactRole);
  
  const seededCompanyRef = useRef<string | null>(null);

  useEffect(() => {
    if (openContactBox) setInternalSearch("");
  }, [openContactBox]);
  
  const addDeal = useDealsStore((s) => s.addDeal);
  const { contacts, addContact } = useCRMContactsStore();
  const { companies, addCompany } = useCRMCompaniesStore();
  const contactCompanyLinks = useCRMContactCompaniesStore((state) => state.links);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const users = useUsersStore((s) => s.users);
  const { fetchPipelines, getPipelines } = useCRMPipelinesStore();
  const { fetchStages, getStages } = usePipelineStagesStore();

  const wsCompanies = companies.filter(c => c.workspaceId === activeWorkspaceId);
  const wsContacts = contacts.filter(c => c.workspaceId === activeWorkspaceId);
  const pipelines = getPipelines(activeWorkspaceId).filter((pipeline) => pipeline.isActive);
  const selectedPipeline = pipelines.find((pipeline) => pipeline.id === pipelineId) || pipelines[0];
  const pipelineStages = getStages(selectedPipeline?.id, selectedPipeline?.name);

  useEffect(() => {
    if (open && !defaultContactId) {
      setPersonType(initialPersonType);
    }
  }, [open, defaultContactId, initialPersonType]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    fetchPipelines(activeWorkspaceId);
  }, [activeWorkspaceId, fetchPipelines]);

  useEffect(() => {
    if (!pipelineId && defaultPipelineId) {
      setPipelineId(defaultPipelineId);
    }
  }, [defaultPipelineId, pipelineId]);

  useEffect(() => {
    if (!pipelineId && pipelines[0]?.id) {
      setPipelineId(pipelines[0].id);
    }
  }, [pipelineId, pipelines]);

  useEffect(() => {
    if (selectedPipeline?.id && activeWorkspaceId) {
      fetchStages(selectedPipeline.id, activeWorkspaceId, selectedPipeline.name);
    }
  }, [activeWorkspaceId, fetchStages, selectedPipeline?.id, selectedPipeline?.name]);

  useEffect(() => {
    if (pipelineStages.length > 0) {
      setStage((currentStage) => (pipelineStages.some((item) => item.id === currentStage) ? currentStage : pipelineStages[0].id));
    }
  }, [pipelineStages]);

  // Regra de negócio: etapas como Proposta/Negociação/Fechamento/Vitrine de Produtos exigem
  // uma qualificação concluída (mesma trava aplicada ao mover uma negociação já existente).
  // Se a etapa inicial escolhida está travada e nenhum contato selecionado está qualificado,
  // volta automaticamente para a primeira etapa do pipeline (ex: "Novos Leads").
  useEffect(() => {
    const hasQualifiedContact = selectedContactIds.some(
      (id) => wsContacts.find((c) => c.id === id)?.qualificationCompletedAt,
    );
    if (QUALIFICATION_REQUIRED_STAGES.has(stage) && !hasQualifiedContact) {
      const fallbackStage = pipelineStages[0];
      toast.error(
        `Esta etapa exige um contato qualificado. A etapa inicial foi ajustada para "${fallbackStage?.label || "Novos Leads"}".`,
      );
      setStage(fallbackStage?.id || "leads");
    }
  }, [selectedContactIds, wsContacts, stage, pipelineStages]);

  // If Juridica, contacts list should be filtered by the selected company.
  // If companyId is empty but personType=Juridica, we probably shouldn't let them select contact until company is selected
  // Or just show all if Fisica
  //
  // Fase 4: "os contatos desta empresa" inclui quem tem a empresa como PRINCIPAL
  // e quem está vinculado a ela por crm_contact_companies. Sem isto, abrir uma
  // negociação para o segundo CNPJ de um comprador exigia trocar a empresa dele.
  const availableContacts = personType === "Juridica" && companyId
    ? filterContactsByCompany(wsContacts, contactCompanyLinks, companyId)
    : personType === "Fisica" ? wsContacts.filter(c => !c.companyId) : [];

  // Se o usuário alternar para Física, limpa o estado de empresa
  useEffect(() => {
    if (personType === "Fisica") {
      setCompanyId("");
      setSearchCompany("");
      setCompanyCnpj("");
      setShowCreateCompanyForm(false);
    }
  }, [personType]);

  // Se uma empresa for selecionada, limpa os contatos anteriores se eles não pertencerem a ela
  useEffect(() => {
    if (personType === "Juridica" && companyId && selectedContactIds.length > 0) {
      const validIds = selectedContactIds.filter(id => {
        const c = wsContacts.find(x => x.id === id);
        return c && contactBelongsToCompany(contactCompanyLinks, c.id, companyId, c.companyId);
      });
      if (validIds.length !== selectedContactIds.length) {
        setSelectedContactIds(validIds);
      }
    }
  }, [companyId, personType, selectedContactIds, wsContacts, contactCompanyLinks]);

  /**
   * Semeadura a partir da empresa: o botão "Criar negociação" dentro da empresa já traz razão
   * social, CNPJ e os contatos dela. Semeia UMA vez por abertura (o ref) para não desfazer o que o
   * vendedor mexer depois — as listas de contato e empresa chegam por fetch e mudariam a dependência
   * do efeito no meio do preenchimento.
   */
  useEffect(() => {
    if (!open) {
      seededCompanyRef.current = null;
      return;
    }
    if (!defaultCompanyId || seededCompanyRef.current === defaultCompanyId) return;

    const company = wsCompanies.find((item) => item.id === defaultCompanyId);
    if (!company) return; // lista ainda não carregou: tenta de novo quando chegar

    seededCompanyRef.current = defaultCompanyId;
    setPersonType("Juridica");
    setCompanyId(company.id);
    setSearchCompany(company.name);
    setCompanyCnpj(company.cnpj || "");
    setSelectedContactIds(filterContactsByCompany(wsContacts, contactCompanyLinks, company.id).map((contact) => contact.id));
  }, [open, defaultCompanyId, wsCompanies, wsContacts, contactCompanyLinks]);

  // Initialize defaultContactId
  useEffect(() => {
    if (open && defaultContactId) {
      const contact = wsContacts.find(c => c.id === defaultContactId);
      if (contact) {
        if (!selectedContactIds.includes(contact.id)) {
          setSelectedContactIds([contact.id]);
        }
        if (contact.companyId) {
          setPersonType("Juridica");

          // Fase 4 (D3): com mais de uma empresa, a negociação NÃO nasce com
          // nenhuma escolhida — o vendedor escolhe entre as empresas dele. Adivinhar
          // a principal aqui faria a negociação nascer no CNPJ errado por
          // desatenção, e o CRM não teria como saber que errou. Com uma empresa só
          // (a maioria), segue preenchendo e ninguém ganha clique a mais.
          const empresasDoContato = companyIdsOfContact(contactCompanyLinks, contact.id, contact.companyId);
          if (empresasDoContato.length > 1) {
            setCompanyId("");
            setSearchCompany("");
            setCompanyCnpj("");
          } else {
            setCompanyId(contact.companyId);
            const comp = wsCompanies.find(c => c.id === contact.companyId);
            if (comp) {
              setSearchCompany(comp.name);
              setCompanyCnpj(comp.cnpj || "");
            }
          }
        } else {
          setPersonType("Fisica");
        }
      }
    }
  }, [open, defaultContactId, wsContacts, wsCompanies, contactCompanyLinks]); // Removed selectedContactIds to avoid infinite loop

  // Handle selected Company auto-fill
  useEffect(() => {
    if (companyId) {
      const c = wsCompanies.find(x => x.id === companyId);
      if (c) {
        setCompanyCnpj(c.cnpj || "");
        
        // Auto-select contact ONLY if we are in Juridica mode AND no contacts are currently selected
        if (personType === "Juridica" && selectedContactIds.length === 0 && !isCreatingContact) {
          const companyContacts = filterContactsByCompany(wsContacts, contactCompanyLinks, companyId);
          if (companyContacts.length > 0) {
            const first = companyContacts[0];
            setSelectedContactIds([first.id]);
          }
        }
      }
    }
  }, [companyId, wsCompanies, personType, wsContacts, contactCompanyLinks, selectedContactIds, isCreatingContact]);

  // Legacy auto-fill only for the "first" contact if we want,
  // but it's better to just use the contacts array now.

  // Cadastra uma empresa nova diretamente pela tela de negociação.
  // Regra de negócio: CNPJ é obrigatório nesse fluxo, e ao concluir a
  // empresa não tem nenhum contato vinculado ainda, então já abrimos o
  // formulário de novo contato para o usuário vincular um.
  const handleCreateCompany = async () => {
    if (!searchCompany.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }

    if (!companyCnpj.trim()) {
      toast.error("Informe o CNPJ para cadastrar a empresa.");
      return;
    }

    if (!activeWorkspaceId) {
      toast.error("Selecione um workspace antes de criar uma empresa.");
      return;
    }

    setCreatingCompany(true);
    try {
      const newCompany = await addCompany({
        name: searchCompany.trim(),
        cnpj: companyCnpj.trim(),
        companyType: "MATRIZ",
        workspaceId: activeWorkspaceId,
      });

      setCompanyId(newCompany.id);
      setSearchCompany(newCompany.name);
      setCompanyCnpj(newCompany.cnpj || "");
      setOpenCompanyBox(false);
      setShowCreateCompanyForm(false);
      setIsCreatingContact(true);
      toast.success("Empresa criada com sucesso! Informe o contato dela abaixo.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao criar empresa.");
    } finally {
      setCreatingCompany(false);
    }
  };

  const handleSubmit = async () => {
    if (!dealName.trim()) {
      toast.error("Informe o Nome da Negociação");
      return;
    }

    if (!activeWorkspaceId) {
      toast.error("Selecione um workspace antes de criar uma negociação.");
      return;
    }

    if (!selectedPipeline?.id) {
      toast.error("Selecione um pipeline para criar a negociação.");
      return;
    }

    if (closingDate && isPastLocalDate(closingDate)) {
      toast.error("A previsão de fechamento não pode ser uma data passada.");
      return;
    }
    
    let finalCompanyId = companyId;
    let finalCompanyName = searchCompany;
    let finalCompanyCnpj = companyCnpj;

    // Validação de regra de negócio: Pessoa Jurídica precisa de uma empresa vinculada
    if (personType === "Juridica" && !finalCompanyId) {
      toast.error("Selecione ou cadastre uma empresa para continuar.");
      return;
    }

    const finalContactIds = [...selectedContactIds];

    if (isCreatingContact && searchContact.trim()) {
      if (!contactPhone.trim()) {
        toast.error("O telefone do novo contato é obrigatório.");
        return;
      }
      if (!isValidBrazilianPhone(contactPhone)) {
        toast.error("Informe um telefone válido com DDD. Exemplo: (11) 99999-9999.");
        return;
      }
      const newCont = await addContact({
        name: searchContact.trim(),
        phone: contactPhone.trim() || undefined,
        email: contactEmail.trim() || undefined,
        role: personType === "Juridica" ? (contactRole.trim() || undefined) : undefined,
        cpf: personType === "Fisica" ? (contactCpf.trim() || undefined) : undefined,
        companyId: personType === "Juridica" ? finalCompanyId : undefined,
        personType,
        assignedTo: assignedTo || undefined,
        workspaceId: activeWorkspaceId!,
      });
      finalContactIds.push(newCont.id);
    }

    if (finalContactIds.length === 0) {
      toast.error("Selecione ou crie ao menos um Contato");
      return;
    }

    // Validação de regra de negócio: Pessoa Física não pode ter empresa
    if (personType === "Fisica") {
      const contactWithCompany = finalContactIds.find(id => {
        const c = wsContacts.find(cont => cont.id === id);
        return c && c.companyId;
      });
      
      if (contactWithCompany) {
        toast.error("Negociações de Pessoa Física só podem ser criadas para contatos sem vínculo com empresa.");
        return;
      }
    }

    // Para compatibilidade legada, pegamos o primeiro contato como principal
    const mainContact = wsContacts.find(c => c.id === finalContactIds[0]) || 
                       (finalContactIds.length > selectedContactIds.length ? { name: searchContact, phone: contactPhone, email: contactEmail, role: contactRole } : null);
    const inheritedQualification = wsContacts.find(
      (contact) => finalContactIds.includes(contact.id) && contact.qualificationCompletedAt,
    );

    // Validação de regra de negócio: etapas como Proposta/Negociação/Fechamento/Vitrine de
    // Produtos exigem uma qualificação concluída — mesma trava aplicada ao mover uma
    // negociação já existente para essas etapas.
    if (QUALIFICATION_REQUIRED_STAGES.has(stage) && !inheritedQualification?.qualificationCompletedAt) {
      toast.error("Esta negociação ainda não possui uma qualificação concluída. Selecione um contato já qualificado ou escolha outra etapa inicial.");
      return;
    }

    // Cria a negociação no DealsStore
    try {
      await addDeal({
        dealName: dealName.trim(),
        personType,
        contactId: finalContactIds[0],
        contactIds: finalContactIds,
        primaryContactId: finalContactIds[0],
        companyId: personType === "Juridica" ? (finalCompanyId || undefined) : undefined,
        email: mainContact?.email || "",
        cpf: contactCpf.trim(),
        companyName: personType === "Juridica" ? finalCompanyName : undefined,
        cnpj: personType === "Juridica" ? finalCompanyCnpj : undefined,
        sector: mainContact?.role || "",
        pipelineId: selectedPipeline.id,
        phone: mainContact?.phone || "",
        contactName: mainContact?.name || "",
        contactRole: mainContact?.role || "",
        stage,
        qualification: inheritedQualification?.qualificationClassification || undefined,
        qualificationBant: inheritedQualification?.qualificationBant,
        qualificationScore: inheritedQualification?.qualificationScore,
        qualificationClassification: inheritedQualification?.qualificationClassification,
        qualificationCompletedAt: inheritedQualification?.qualificationCompletedAt,
        qualificationResponsible: inheritedQualification?.qualificationResponsible,
        closingDate,
        assignedTo: assignedTo || undefined,
        value: 0,
        tags: [],
        notes: [],
        workspaceId: activeWorkspaceId || undefined,
      });
      
      toast.success("Oportunidade criada com sucesso!");
      onOpenChange(false);
      
      // Reset Form
      setDealName(""); setPersonType(initialPersonType); setPipelineId(defaultPipelineId || pipelines[0]?.id || ""); setStage(pipelineStages[0]?.id || "leads"); setClosingDate(""); setAssignedTo("");
      setSelectedContactIds([]);
      setIsCreatingContact(false);
      setSearchContact("");
      setContactPhone("");
      setContactEmail("");
      setContactCpf("");
      setContactRole("");
    } catch (e) {
      toast.error("Erro ao salvar negociação no banco de dados.");
      console.error(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{personType === "Fisica" ? "Criar Negociação PF" : "Criar Negociação PJ"}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-1 space-y-4 py-2">
          
          <div className="space-y-1.5">
            <Label>Nome da Negociação *</Label>
            <Input placeholder="Ex: Venda de software ou Imóvel" value={dealName} onChange={(e) => setDealName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Pipeline *</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={selectedPipeline?.id || ""}
              onChange={(e) => setPipelineId(e.target.value)}
            >
              <option value="" disabled>Selecione um pipeline</option>
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
              ))}
            </select>
          </div>

          {!lockPersonType && (
          <div className="space-y-1.5">
            <Label>Tipo de Cliente</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={personType}
              onChange={(e) => {
                setPersonType(e.target.value as "Fisica" | "Juridica");
                setSelectedContactIds([]); 
                setSearchContact("");
                setContactPhone(""); 
                setContactEmail("");
              }}
            >
              <option value="Fisica">Pessoa Física</option>
              <option value="Juridica">Pessoa Jurídica</option>
            </select>
          </div>

          )}

          <div className="border border-border rounded-md p-4 bg-muted/20 space-y-4">
            {personType === "Juridica" && (
              <div className="space-y-3 pb-4 border-b border-border">
                <div className="grid grid-cols-2 gap-3">
                  {/* min-w-0: item de grid não encolhe sozinho, e razão social longa invadia a coluna do CNPJ */}
                  <div className="space-y-1.5 flex min-w-0 flex-col">
                    <Label>Empresa *</Label>
                    <Popover open={openCompanyBox} onOpenChange={setOpenCompanyBox}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openCompanyBox}
                          title={companyId ? wsCompanies.find((c) => c.id === companyId)?.name : undefined}
                          className="w-full min-w-0 justify-between font-normal bg-background"
                        >
                          <span className="truncate text-left">
                            {companyId ? wsCompanies.find((c) => c.id === companyId)?.name : searchCompany || "Selecione ou busque..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar empresa..." value={searchCompany} onValueChange={setSearchCompany} />
                          <CommandList>
                            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                            <CommandGroup>
                              {wsCompanies.map((comp) => (
                                <CommandItem
                                  key={comp.id}
                                  value={comp.name}
                                  onSelect={() => {
                                    setCompanyId(comp.id);
                                    setSearchCompany(comp.name);
                                    setOpenCompanyBox(false);
                                    setShowCreateCompanyForm(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", companyId === comp.id ? "opacity-100" : "opacity-0")} />
                                  {comp.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {!companyId && !showCreateCompanyForm && (
                      <button
                        type="button"
                        onClick={() => { setOpenCompanyBox(false); setShowCreateCompanyForm(true); }}
                        className="mt-1 flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Plus className="h-3 w-3" /> Criar Empresa
                      </button>
                    )}
                  </div>

                  {companyId ? (
                    <div className="space-y-1.5 min-w-0">
                      <Label>CNPJ</Label>
                      <Input
                        value={companyCnpj}
                        disabled
                        className="bg-muted text-muted-foreground"
                      />
                    </div>
                  ) : null}
                </div>

                {showCreateCompanyForm && !companyId && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border border-dashed border-border">
                    <div className="space-y-1.5 col-span-2 flex justify-between items-center">
                      <Label className="text-[#00adc7] font-semibold">Nova Empresa</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => { setShowCreateCompanyForm(false); setSearchCompany(""); setCompanyCnpj(""); }}
                      >
                        Remover
                      </Button>
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>Nome da Empresa *</Label>
                      <Input
                        placeholder="Informe o nome da empresa"
                        value={searchCompany}
                        onChange={(e) => setSearchCompany(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>CNPJ *</Label>
                      <Input
                        placeholder="00.000.000/0000-00"
                        value={companyCnpj}
                        onChange={(e) => setCompanyCnpj(maskCNPJ(e.target.value))}
                        className="bg-background"
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button size="sm" onClick={handleCreateCompany} disabled={creatingCompany}>
                        {creatingCompany ? "Criando..." : "Cadastrar Empresa"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5 flex flex-col">
                <Label>Contato {personType === "Juridica" && "da Empresa"} *</Label>
                <Popover open={openContactBox} onOpenChange={setOpenContactBox}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      role="combobox" 
                      aria-expanded={openContactBox} 
                      className="justify-between font-normal bg-background w-full min-w-0 h-9"
                      disabled={personType === "Juridica" && !companyId}
                    >
                      <span className="truncate text-left">
                        {selectedContactIds.length === 1
                          ? wsContacts.find(c => c.id === selectedContactIds[0])?.name || `${selectedContactIds.length} contato(s) selecionado(s)`
                          : selectedContactIds.length > 1
                            ? `${selectedContactIds.length} contato(s) selecionado(s)`
                            : (isCreatingContact ? "Novo Contato..." : "Selecione...")}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Buscar contato..."
                        value={internalSearch}
                        onValueChange={setInternalSearch}
                      />
                      <CommandList>
                        <CommandGroup>
                          <CommandItem
                            value="createnewcontactshortcut"
                            onSelect={() => { 
                              if (personType === "Fisica") {
                                setSelectedContactIds([]);
                              }
                              setIsCreatingContact(true);
                              setOpenContactBox(false); 
                              setInternalSearch("");
                            }}
                            className="text-primary font-medium cursor-pointer"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {internalSearch ? `Criar "${internalSearch}"` : "Criar Novo Contato"}
                          </CommandItem>
                        </CommandGroup>
                        <CommandEmpty>
                          <p className="text-xs text-muted-foreground px-4 py-2">Nenhum contato encontrado.</p>
                        </CommandEmpty>
                        {availableContacts.length > 0 && (
                          <CommandGroup heading="Contatos Disponíveis">
                            {availableContacts.map((cont) => (
                              <CommandItem
                                key={cont.id}
                                value={cont.name}
                                onSelect={() => {
                                  if (personType === "Juridica") {
                                    if (!selectedContactIds.includes(cont.id)) {
                                      setSelectedContactIds(prev => [...prev, cont.id]);
                                    }
                                  } else {
                                    setSelectedContactIds([cont.id]);
                                    setIsCreatingContact(false);
                                  }
                                  setOpenContactBox(false);
                                  setInternalSearch("");
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedContactIds.includes(cont.id) ? "opacity-100" : "opacity-0")} />
                                {cont.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {personType === "Juridica" && !companyId && (
                  <p className="text-xs text-muted-foreground">Selecione ou cadastre uma empresa para escolher o contato.</p>
                )}
              </div>

              {/* Selected Contacts List */}
              {selectedContactIds.length > 0 && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Contatos Selecionados</Label>
                  <div className="grid gap-2">
                    {selectedContactIds.map(id => {
                      const contact = wsContacts.find(c => c.id === id);
                      if (!contact) return null;
                      return (
                        <div key={id} className="relative group p-3 bg-muted/20 rounded-lg border border-border/50 hover:border-[#00adc7]/30 transition-colors">
                          <button 
                            onClick={() => setSelectedContactIds(prev => prev.filter(x => x !== id))}
                            className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          
                          <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-sm pr-6">{contact.name}</span>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                              {contact.phone && (
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-3 h-3 text-[#00adc7]" />
                                  {contact.phone}
                                </div>
                              )}
                              {contact.email && (
                                <div className="flex items-center gap-1.5">
                                  <Mail className="w-3 h-3 text-[#00adc7]" />
                                  {contact.email}
                                </div>
                              )}
                              {contact.role && (
                                <div className="flex items-center gap-1.5">
                                  <Briefcase className="w-3 h-3 text-[#00adc7]" />
                                  {contact.role}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {isCreatingContact && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border border-dashed border-border">
                  <div className="space-y-1.5 col-span-2 flex justify-between items-center">
                    <Label className="text-[#00adc7] font-semibold">Novo Contato</Label>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setIsCreatingContact(false)}>
                      Remover
                    </Button>
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">
                    {personType === "Juridica"
                      ? `Este contato será cadastrado como Pessoa Jurídica, vinculado à empresa "${wsCompanies.find((c) => c.id === companyId)?.name || searchCompany}".`
                      : "Este contato será cadastrado como Pessoa Física."}
                  </p>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Nome do Contato *</Label>
                    <Input 
                      placeholder="Informe o nome completo do Contato" 
                      value={searchContact} 
                      onChange={(e) => setSearchContact(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="(11) 99999-9999" 
                        value={contactPhone} 
                        onChange={(e) => setContactPhone(maskPhone(e.target.value))} 
                        className="pl-10 bg-background"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        type="email" 
                        placeholder="email@exemplo.com" 
                        value={contactEmail} 
                        onChange={(e) => setContactEmail(e.target.value)} 
                        className="pl-10 bg-background"
                      />
                    </div>
                  </div>
                  {personType === "Juridica" ? (
                    <div className="space-y-1.5 col-span-2">
                      <Label>Cargo</Label>
                      <Select value={contactRole} onValueChange={setContactRole}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Selecione o cargo" />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1.5 col-span-2">
                      <Label>CPF</Label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="000.000.000-00"
                          value={contactCpf}
                          onChange={(e) => setContactCpf(maskCPF(e.target.value))}
                          className="pl-10 bg-background"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
          
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1.5">
              <Label>Etapa Inicial</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={stage}
                onChange={(e) => setStage(e.target.value as DealStage)}
              >
                {pipelineStages.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Previsão de Fechamento</Label>
              <ClosingDateInput
                aria-label="Previsão de Fechamento"
                value={closingDate}
                onCommit={setClosingDate}
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <Label>Responsável</Label>
            <Popover open={openAssignedBox} onOpenChange={setOpenAssignedBox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openAssignedBox}
                  className="w-full justify-between font-normal"
                >
                  {assignedTo ? (() => {
                    const selectedUser = users.find(u => u.id === assignedTo);
                    return (
                      <div className="flex items-center gap-2">
                        <UserAvatar 
                          name={selectedUser?.name || "Responsável"} 
                          avatar={selectedUser?.avatar} 
                        />
                        {selectedUser?.name || "Responsável"}
                      </div>
                    );
                  })() : (
                    "Selecione um responsável..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[380px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar usuário..." />
                  <CommandList>
                    <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="sem_responsavel"
                        onSelect={() => {
                          setAssignedTo("");
                          setOpenAssignedBox(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            assignedTo === "" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        Sem responsável
                      </CommandItem>
                      {users
                        .filter(u => u.workspaces.includes(activeWorkspaceId || "default") || u.workspaces.includes("all"))
                        .map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.name}
                            onSelect={() => {
                              setAssignedTo(user.id);
                              setOpenAssignedBox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                assignedTo === user.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex items-center gap-2">
                              <UserAvatar name={user.name} avatar={user.avatar} />
                              {user.name}
                            </div>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

        </div>
        
        <div className="flex justify-end gap-2 pt-4 mt-2 border-t px-6 pb-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Salvar Negociação</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
