import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCRMContactsStore } from "@/lib/crmContactsStore";
import { useDealsStore } from "@/lib/dealsStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { Check, ChevronsUpDown, Plus, X, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CreateContactDialog } from "./CreateContactDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  currentContactIds: string[];
  primaryContactId?: string;
  companyId?: string; // If set, only show contacts from this company
  personType?: "Fisica" | "Juridica";
}

export function AssociateDealContactDialog({ open, onOpenChange, dealId, currentContactIds, primaryContactId, companyId, personType }: Props) {
  const { contacts } = useCRMContactsStore();
  const { updateDeal } = useDealsStore();
  const { activeWorkspaceId } = useWorkspaceStore();

  const [searchContact, setSearchContact] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [showCreateContact, setShowCreateContact] = useState(false);

  // Filter contacts: workspace, not already linked to this deal
  // If companyId exists, show only contacts from that company
  // If personType is Fisica, only show contacts WITHOUT a company
  const availableContacts = useMemo(() => {
    return contacts.filter(c => {
      if (c.workspaceId !== activeWorkspaceId) return false;
      if (currentContactIds.includes(c.id)) return false; // already linked
      
      // Regra: Pessoa Física não pode ter empresa
      if (personType === "Fisica" && c.companyId) return false;
      
      if (companyId) return c.companyId === companyId; // filter by company
      return true;
    });
  }, [contacts, activeWorkspaceId, currentContactIds, companyId, personType]);

  const selectedContact = availableContacts.find(c => c.id === selectedContactId);

  const handleAssociate = () => {
    if (!selectedContactId) {
      toast.error("Selecione um contato para associar.");
      return;
    }
    const newIds = [...currentContactIds, selectedContactId];
    const contact = contacts.find(c => c.id === selectedContactId);
    // Keep contactId as primary (first) for backward compat
    const becomesPrimary = !primaryContactId && currentContactIds.length === 0;
    updateDeal(dealId, {
      contactIds: newIds,
      contactId: newIds[0],
      primaryContactId: primaryContactId || newIds[0],
      contactName: contacts.find(c => c.id === newIds[0])?.name || "",
      ...(becomesPrimary ? { phone: contact?.phone || "" } : {}),
    });
    toast.success(`${contact?.name} adicionado à negociação!`);
    handleClose();
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
            <DialogTitle>Adicionar contato</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {companyId && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <span>Apenas contatos vinculados à mesma empresa desta negociação são exibidos.</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">
              Busque um contato{companyId ? " da empresa vinculada" : ""} para adicionar a esta negociação.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Buscar contato</label>
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
                      : searchContact || "Digite o nome do contato..."}
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
                        {companyId
                          ? "Nenhum contato disponível para esta empresa."
                          : "Nenhum contato encontrado."}
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
                              {c.role && <span className="text-xs text-muted-foreground">{c.role}</span>}
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
              style={selectedContactId ? { backgroundColor: "#c8ebee", color: "#007b8a" } : {}}
            >
              Adicionar Contato
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
