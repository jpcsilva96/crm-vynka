import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCRMContactsStore } from "@/lib/crmContactsStore";
import { useOptionLabels } from "@/lib/optionListsStore";
import { useCRMCompaniesStore } from "@/lib/crmCompaniesStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn, isValidBrazilianPhone, maskPhone, maskCPF } from "@/lib/utils";
import { Phone, Mail, User, CreditCard } from "lucide-react";
import { useUsersStore } from "@/lib/usersStore";
import { UserAvatar } from "./UserAvatar";

export interface GlobalContact {
  id: string;
  name: string;
  company: string;
  emails: string[];
  phones: string[];
  role: string;
  deals: any[];
  personType?: "Fisica" | "Juridica";
  cpf?: string;
  assignedTo?: string;
  qualificationClassification?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: GlobalContact;
  defaultCompanyId?: string;
}

export function CreateContactDialog({ open, onOpenChange, initialData, defaultCompanyId }: Props) {
  const { contacts, addContact, updateContact } = useCRMContactsStore();
  const { companies, addCompany } = useCRMCompaniesStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { users } = useUsersStore();

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const roleOptions = useOptionLabels("contact_role", role);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [personType, setPersonType] = useState<"Fisica" | "Juridica">("Juridica");
  const [cpf, setCpf] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [openAssignedBox, setOpenAssignedBox] = useState(false);
  
  const [openCompanyBox, setOpenCompanyBox] = useState(false);
  const [companyId, setCompanyId] = useState<string>("");
  const [searchCompany, setSearchCompany] = useState("");

  const wsCompanies = useMemo(
    () => companies.filter((company) => company.workspaceId === activeWorkspaceId),
    [activeWorkspaceId, companies],
  );

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name || "");
      setRole(initialData.role === "Não preenchido" ? "" : (initialData.role || ""));
      setPhone(initialData.phones[0] || "");
      setEmail(initialData.emails[0] || "");
      setPersonType((initialData as any).personType || "Juridica");
      setCpf((initialData as any).cpf || "");
      setAssignedTo((initialData as any).assignedTo || "");
      
      if (initialData.company) {
        const comp = wsCompanies.find(c => c.name === initialData.company);
        if (comp) {
          setCompanyId(comp.id);
        } else {
          setSearchCompany(initialData.company);
        }
      }
    } else if (open && !initialData) {
      if (defaultCompanyId) {
        setCompanyId(defaultCompanyId);
        setPersonType("Juridica");
      }
    }
  }, [open, initialData, defaultCompanyId, wsCompanies]);

  const resetForm = () => {
    setName("");
    setRole("");
    setPhone("");
    setEmail("");
    setCompanyId("");
    setSearchCompany("");
    setPersonType("Juridica");
    setCpf("");
    setAssignedTo("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }

    if (!activeWorkspaceId) {
      toast.error("Selecione um workspace antes de criar um contato.");
      return;
    }

    if (phone.trim() && !isValidBrazilianPhone(phone)) {
      toast.error("Informe um telefone válido com DDD. Exemplo: (11) 99999-9999.");
      return;
    }

    if (phone) {
      const exists = contacts.find(c => c.workspaceId === activeWorkspaceId && c.phone === phone && c.id !== initialData?.id);
      if (exists) {
        toast.error("Este telefone já está cadastrado em outro contato.");
        return;
      }
    }

    if (email) {
      const exists = contacts.find(c => c.workspaceId === activeWorkspaceId && c.email === email && c.id !== initialData?.id);
      if (exists) {
        toast.error("Este e-mail já está cadastrado em outro contato.");
        return;
      }
    }

    let finalCompanyId = companyId;

    // Se o usuário digitou uma empresa que não existe e selecionou "Criar"
    if (!companyId && searchCompany.trim()) {
      const existing = wsCompanies.find(c => c.name.toLowerCase() === searchCompany.toLowerCase());
      if (existing) {
        finalCompanyId = existing.id;
      } else {
        const newComp = await addCompany({
          name: searchCompany.trim(),
          companyType: "MATRIZ",
          workspaceId: activeWorkspaceId!,
        });
        finalCompanyId = newComp.id;
      }
    }

    const contactData = {
      name: name.trim(),
      role: personType === "Juridica" ? (role.trim() || undefined) : undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      companyId: personType === "Juridica" ? (finalCompanyId || undefined) : undefined,
      personType,
      cpf: personType === "Fisica" ? cpf : undefined,
      assignedTo: assignedTo || undefined,
      workspaceId: activeWorkspaceId!,
    };

    try {
      if (initialData) {
        await updateContact(initialData.id, contactData);
        toast.success("Contato atualizado com sucesso!");
      } else {
        await addContact(contactData);
        toast.success("Contato criado com sucesso!");
      }
      resetForm();
      onOpenChange(false);
    } catch (e) {
      toast.error("Erro ao salvar contato no banco de dados.");
      console.error(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) resetForm();
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Contato" : "Criar Contato"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
          {/* Toggle Pessoa Fisica / Juridica */}
          <div className="flex p-1 bg-muted rounded-lg w-full">
            <button
              onClick={() => {
                setPersonType("Fisica");
                setRole("");
                setCompanyId("");
                setSearchCompany("");
              }}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                personType === "Fisica" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Pessoa Física
            </button>
            <button
              onClick={() => setPersonType("Juridica")}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                personType === "Juridica" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Pessoa Jurídica
            </button>
          </div>

          <div className={`grid gap-4 ${personType === "Juridica" ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="grid gap-2">
              <Label htmlFor="name">Nome do Contato</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Digite o nome do contato" />
            </div>
            
            {personType === "Juridica" && (
              <div className="grid gap-2">
                <Label htmlFor="role">Cargo</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="role" className="h-10">
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="phone" 
                  value={phone} 
                  onChange={(e) => setPhone(maskPhone(e.target.value))} 
                  placeholder="(11) 99999-9999" 
                  className="pl-10"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="Digite o e-mail do contato" 
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="assignedTo">Responsável</Label>
              <Popover open={openAssignedBox} onOpenChange={setOpenAssignedBox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openAssignedBox}
                    className="w-full justify-between font-normal h-10"
                  >
                    {assignedTo ? (() => {
                      const selectedUser = users.find(u => u.id === assignedTo);
                      return (
                        <div className="flex items-center gap-2">
                          <UserAvatar 
                            name={selectedUser?.name || "Responsável"} 
                            avatar={selectedUser?.avatar} 
                            className="w-5 h-5"
                          />
                          <span className="truncate">{selectedUser?.name || "Responsável"}</span>
                        </div>
                      );
                    })(
                    ) : (
                      "Selecione"
                    )}
                    <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
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
                          <Check className={cn("mr-2 h-4 w-4", !assignedTo ? "opacity-100" : "opacity-0")} />
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
                              <Check className={cn("mr-2 h-4 w-4", assignedTo === user.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex items-center gap-2">
                                <UserAvatar name={user.name} avatar={user.avatar} className="w-5 h-5" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2 flex flex-col">
              <Label className={cn(personType === "Fisica" && "opacity-50")}>Empresa</Label>
              <Popover open={openCompanyBox} onOpenChange={personType === "Juridica" ? setOpenCompanyBox : undefined}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCompanyBox}
                    className={cn(
                      "justify-between font-normal h-10",
                      personType === "Fisica" && "opacity-50 cursor-not-allowed bg-muted"
                    )}
                    disabled={personType === "Fisica"}
                  >
                    {companyId
                      ? wsCompanies.find((c) => c.id === companyId)?.name
                      : searchCompany || "Selecione"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Buscar ou adicionar empresa..." 
                      value={searchCompany}
                      onValueChange={setSearchCompany}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {searchCompany.trim() ? (
                          <button 
                            className="flex items-center gap-2 p-2 text-sm text-primary hover:bg-muted w-full text-left"
                            onClick={() => {
                              setCompanyId(""); 
                              setOpenCompanyBox(false);
                            }}
                          >
                            <Plus className="w-4 h-4" />
                            Criar "{searchCompany}"
                          </button>
                        ) : "Nenhuma empresa encontrada."}
                      </CommandEmpty>
                      <CommandGroup>
                        {wsCompanies.map((comp) => (
                          <CommandItem
                            key={comp.id}
                            value={comp.name}
                            onSelect={() => {
                              setCompanyId(comp.id === companyId ? "" : comp.id);
                              setSearchCompany("");
                              setOpenCompanyBox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                companyId === comp.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {comp.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {personType === "Fisica" && (
              <div className="grid gap-2">
                <Label htmlFor="cpf">CPF</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="cpf" 
                    value={cpf} 
                    onChange={(e) => setCpf(maskCPF(e.target.value))} 
                    placeholder="000.000.000-00" 
                    className="pl-10"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>{initialData ? "Salvar Alterações" : "Salvar Contato"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
