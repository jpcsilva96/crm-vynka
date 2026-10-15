import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCRMContactsStore } from "@/lib/crmContactsStore";
import { contactBelongsToCompany, useCRMContactCompaniesStore } from "@/lib/crmContactCompaniesStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CreateContactDialog } from "./CreateContactDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
}

export function AssociateContactDialog({ open, onOpenChange, companyId, companyName }: Props) {
  const { contacts, updateContact } = useCRMContactsStore();
  const contactCompanyLinks = useCRMContactCompaniesStore((state) => state.links);
  const linkCompany = useCRMContactCompaniesStore((state) => state.linkCompany);
  const { activeWorkspaceId } = useWorkspaceStore();

  const [searchContact, setSearchContact] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [showCreateContact, setShowCreateContact] = useState(false);

  // Fase 4: qualquer contato Pessoa Jurídica do workspace que ainda NÃO esteja
  // nesta empresa. Antes o filtro era `!c.companyId` — só contato sem empresa
  // nenhuma —, o que tornava impossível colocar um comprador em um segundo CNPJ
  // sem antes tirá-lo do primeiro.
  const availableContacts = useMemo(() => {
    return contacts.filter(
      c =>
        c.workspaceId === activeWorkspaceId &&
        c.personType === "Juridica" &&
        !contactBelongsToCompany(contactCompanyLinks, c.id, companyId, c.companyId)
    );
  }, [contacts, contactCompanyLinks, activeWorkspaceId, companyId]);

  const selectedContact = availableContacts.find(c => c.id === selectedContactId);

  const handleAssociate = async () => {
    if (!selectedContactId) {
      toast.error("Selecione um contato para associar.");
      return;
    }
    if (!activeWorkspaceId) {
      toast.error("Nenhum workspace ativo.");
      return;
    }

    try {
      await linkCompany(selectedContactId, companyId, activeWorkspaceId);
      // Contato que ainda não tinha empresa nenhuma ganha esta como principal;
      // quem já tinha mantém a dele — associar ACRESCENTA, não substitui.
      if (!selectedContact?.companyId) {
        await updateContact(selectedContactId, { companyId });
      }
      toast.success(`${selectedContact?.name} associado(a) a ${companyName}!`);
    } catch {
      toast.error("Não foi possível associar o contato. Tente novamente.");
      return;
    }

    onOpenChange(false);
    setSelectedContactId("");
    setSearchContact("");
  };

  const handleClose = () => {
    setSelectedContactId("");
    setSearchContact("");
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Associar contato</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Um contato pode atuar em mais de uma empresa.<br />
              Busque um contato Pessoa Jurídica que ainda não esteja aqui, ou crie um novo.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Buscar contato PJ sem empresa associada</label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full justify-between font-normal bg-background"
                  >
                    {selectedContactId
                      ? selectedContact?.name
                      : searchContact || "Digite o nome do contato para buscá-lo"}
                    <div className="flex items-center gap-1 ml-2">
                      {selectedContactId && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedContactId(""); setSearchContact(""); }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start" style={{ width: "var(--radix-popover-trigger-width)" }}>
                  <Command>
                    <CommandInput
                      placeholder="Buscar contato..."
                      value={searchContact}
                      onValueChange={setSearchContact}
                    />
                    <CommandList>
                      <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                        Nenhum contato disponível.
                      </CommandEmpty>
                      <CommandGroup>
                        {availableContacts.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => {
                              setSelectedContactId(c.id);
                              setSearchContact(c.name);
                              setComboOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedContactId === c.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-medium">{c.name}</span>
                              {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
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

          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="outline"
              className="text-primary border-primary/40 hover:bg-primary/10 gap-2"
              onClick={() => { handleClose(); setShowCreateContact(true); }}
            >
              <Plus className="w-4 h-4" />
              Criar novo Contato
            </Button>
            <Button
              disabled={!selectedContactId}
              onClick={handleAssociate}
              className="bg-muted text-muted-foreground disabled:opacity-50 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
              data-active={!!selectedContactId}
              style={selectedContactId ? { backgroundColor: "#c8ebee", color: "#007b8a" } : {}}
            >
              Associar Contato
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateContactDialog
        open={showCreateContact}
        onOpenChange={setShowCreateContact}
        defaultCompanyId={companyId}
      />
    </>
  );
}
