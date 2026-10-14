import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOptionLabels } from "@/lib/optionListsStore";
import { useCRMCompaniesStore, type CRMCompany, type CompanyType } from "@/lib/crmCompaniesStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { useUsersStore } from "@/lib/usersStore";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { UserAvatar } from "./UserAvatar";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, maskCNPJ } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: CRMCompany;
}

export function CreateCompanyDialog({ open, onOpenChange, initialData }: Props) {
  const { companies, addCompany, updateCompany } = useCRMCompaniesStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { users } = useUsersStore();

  const [openAssignedBox, setOpenAssignedBox] = useState(false);
  const [openParentBox, setOpenParentBox] = useState(false);

  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [segment, setSegment] = useState("");
  // o valor já gravado entra na lista mesmo se a opção tiver sido desativada
  const segmentOptions = useOptionLabels("segment", segment);
  const [url, setUrl] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [companyType, setCompanyType] = useState<CompanyType>("MATRIZ");
  const [parentCompanyId, setParentCompanyId] = useState("");

  const workspaceCompanies = useMemo(
    () => companies.filter((company) => company.workspaceId === activeWorkspaceId),
    [activeWorkspaceId, companies],
  );

  const linkedBranchesCount = useMemo(() => {
    if (!initialData) return 0;
    return workspaceCompanies.filter((company) => company.parentCompanyId === initialData.id).length;
  }, [initialData, workspaceCompanies]);

  const matrixOptions = useMemo(
    () =>
      workspaceCompanies.filter(
        (company) => company.companyType === "MATRIZ" && company.id !== initialData?.id,
      ),
    [initialData?.id, workspaceCompanies],
  );

  const selectedParentCompany = matrixOptions.find((company) => company.id === parentCompanyId);

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name || "");
      setCnpj(initialData.cnpj || "");
      setAssignedTo(initialData.assignedTo || "");
      setSegment(initialData.segment || "");
      setUrl(initialData.url || "");
      setAddress(initialData.address || "");
      setNotes(initialData.notes || "");
      setCompanyType(initialData.companyType || "MATRIZ");
      setParentCompanyId(initialData.parentCompanyId || "");
    } else if (!open) {
      resetForm();
    }
  }, [open, initialData]);

  const resetForm = () => {
    setName("");
    setCnpj("");
    setAssignedTo("");
    setSegment("");
    setUrl("");
    setAddress("");
    setNotes("");
    setCompanyType("MATRIZ");
    setParentCompanyId("");
    setOpenAssignedBox(false);
    setOpenParentBox(false);
  };

  const handleCompanyTypeChange = (value: CompanyType) => {
    setCompanyType(value);
    if (value === "MATRIZ") {
      setParentCompanyId("");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("A Razão Social é obrigatória.");
      return;
    }

    if (!activeWorkspaceId) {
      toast.error("Selecione um workspace antes de criar uma empresa.");
      return;
    }

    const exists = companies.find(
      (company) =>
        company.workspaceId === activeWorkspaceId &&
        company.name.toLowerCase() === name.trim().toLowerCase() &&
        company.id !== initialData?.id,
    );

    if (exists) {
      toast.error("Já existe uma empresa com esta Razão Social neste Workspace.");
      return;
    }

    const normalizedCnpj = cnpj.replace(/\D/g, "");
    const companyWithSameCnpj = normalizedCnpj
      ? companies.find(
          (company) =>
            company.workspaceId === activeWorkspaceId &&
            company.id !== initialData?.id &&
            company.cnpj?.replace(/\D/g, "") === normalizedCnpj,
        )
      : undefined;

    if (companyWithSameCnpj) {
      toast.error("Já existe uma empresa com este CNPJ neste Workspace.");
      return;
    }

    if (companyType === "FILIAL" && !parentCompanyId) {
      toast.error("Para cadastrar uma filial, selecione a empresa matriz.");
      return;
    }

    if (initialData?.companyType === "MATRIZ" && companyType === "FILIAL" && linkedBranchesCount > 0) {
      toast.error("Esta empresa possui filiais vinculadas. Remova ou transfira as filiais antes de alterar o tipo da empresa.");
      return;
    }

    if (initialData?.companyType === "FILIAL" && companyType === "MATRIZ") {
      const confirmed = window.confirm(
        "Ao transformar esta filial em matriz, o vínculo com a matriz atual será removido. Deseja continuar?",
      );
      if (!confirmed) return;
    }

    const companyData = {
      name: name.trim(),
      cnpj: cnpj.trim() || undefined,
      assignedTo: assignedTo.trim() || undefined,
      segment: segment.trim() || undefined,
      url: url.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      companyType,
      parentCompanyId: companyType === "FILIAL" ? parentCompanyId : undefined,
      workspaceId: activeWorkspaceId,
    };

    try {
      if (initialData) {
        await updateCompany(initialData.id, companyData);
        toast.success("Empresa atualizada com sucesso!");
      } else {
        await addCompany(companyData);
        toast.success("Empresa criada com sucesso!");
      }
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao salvar empresa no banco de dados.");
      console.error(error);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetForm();
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Empresa" : "Criar Empresa"}</DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto px-1 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Razão Social *</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Digite o nome da empresa" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="companyType">Tipo da Empresa</Label>
              <Select value={companyType} onValueChange={(value) => handleCompanyTypeChange(value as CompanyType)}>
                <SelectTrigger id="companyType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MATRIZ">Matriz</SelectItem>
                  <SelectItem value="FILIAL">Filial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {companyType === "FILIAL" ? (
              <div className="grid gap-2">
                <Label htmlFor="parentCompany">Empresa Matriz *</Label>
                <Popover open={openParentBox} onOpenChange={setOpenParentBox}>
                  <PopoverTrigger asChild>
                    <Button
                      id="parentCompany"
                      variant="outline"
                      role="combobox"
                      aria-expanded={openParentBox}
                      className="w-full justify-between font-normal"
                    >
                      {selectedParentCompany?.name || "Selecione a empresa matriz"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar empresa matriz..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma empresa matriz encontrada.</CommandEmpty>
                        <CommandGroup>
                          {matrixOptions.map((company) => (
                            <CommandItem
                              key={company.id}
                              value={company.name}
                              onSelect={() => {
                                setParentCompanyId(company.id);
                                setOpenParentBox(false);
                                setName(company.name || "");
                                setAssignedTo(company.assignedTo || "");
                                setSegment(company.segment || "");
                                setUrl(company.url || "");
                                setAddress(company.address || "");
                                setNotes(company.notes || "");
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", parentCompanyId === company.id ? "opacity-100" : "opacity-0")} />
                              {company.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" value={cnpj} onChange={(event) => setCnpj(maskCNPJ(event.target.value))} placeholder="00.000.000/0000-00" />
              </div>
            )}
          </div>

          {companyType === "FILIAL" && (
            <div className="grid gap-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={cnpj} onChange={(event) => setCnpj(maskCNPJ(event.target.value))} placeholder="00.000.000/0000-00" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="segment">Segmento</Label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger id="segment">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {segmentOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">URL</Label>
                <Input id="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Digite o endereço do site da empresa" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="assignedTo">Responsável Interno</Label>
              <Popover open={openAssignedBox} onOpenChange={setOpenAssignedBox}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={openAssignedBox} className="w-full justify-between font-normal">
                    {assignedTo
                      ? (() => {
                          const selectedUser = users.find((user) => user.id === assignedTo);
                          return (
                            <div className="flex items-center gap-2">
                              <UserAvatar name={selectedUser?.name || "Responsável"} avatar={selectedUser?.avatar} className="w-5 h-5" />
                              <span>{selectedUser?.name || "Responsável"}</span>
                            </div>
                          );
                        })()
                      : "Selecionar..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="start">
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
                          .filter((user) => user.workspaces.includes(activeWorkspaceId || "default") || user.workspaces.includes("all"))
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

            <div className="grid gap-2">
                <Label htmlFor="address">Endereço</Label>
                <Input id="address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Digite o endereço da empresa" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Resumo</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Descreva a empresa"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>{initialData ? "Salvar Alterações" : "Salvar Empresa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
