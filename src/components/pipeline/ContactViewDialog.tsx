import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type GlobalContact } from "./GlobalContactsList";
import { Edit2, Trash2, User, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { maskPhone } from "@/lib/utils";

interface Props {
  contact: GlobalContact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenDeal: (dealId: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ContactViewDialog({ contact, open, onOpenChange, onOpenDeal, onEdit, onDelete }: Props) {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-muted/20 p-0 overflow-hidden border-0 shadow-lg">
        <div className="bg-background m-4 mb-2 rounded-sm border border-border shadow-sm">
          <DialogHeader className="flex flex-row items-center justify-between p-4 border-b border-border space-y-0">
            <DialogTitle className="text-xl font-semibold text-foreground/80">
              {contact.name}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button onClick={onEdit} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button onClick={onDelete} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="p-4 space-y-4">
            {contact.personType !== "Fisica" && (
              <div className="text-sm text-foreground/80">
                <span className="text-muted-foreground font-medium w-20 inline-block">Cargo:</span> {contact.role}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground font-medium w-16">Telefone:</span> {contact.phones.length > 0 ? contact.phones.map(p => maskPhone(p)).join(", ") : "Não preenchido"}
            </div>
            {contact.emails.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-foreground/80">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground font-medium w-16">E-mail:</span> {contact.emails.join(", ")}
              </div>
            )}
          </div>
        </div>

        <div className="bg-background m-4 mb-2 rounded-sm border border-border shadow-sm">
          <div className="p-4 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground/80">Empresa</h3>
          </div>
          <div className="p-4">
            <div className="text-sm text-foreground/80">
              <span className="text-muted-foreground font-medium w-20 inline-block">Empresa:</span> {contact.company || "Não preenchida"}
            </div>
          </div>
        </div>

        <div className="bg-background m-4 mb-4 rounded-sm border border-border shadow-sm">
          <div className="p-4 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground/80">Negociações</h3>
          </div>
          <div className="divide-y divide-border">
            {contact.deals.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nenhuma negociação vinculada.</div>
            ) : (
              contact.deals.map(deal => (
                <div key={deal.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#fcead8] text-[#e89a5e] flex items-center justify-center shrink-0">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                      <button 
                        onClick={() => {
                          onOpenChange(false);
                          onOpenDeal(deal.id);
                        }}
                        className="text-[15px] font-medium text-muted-foreground hover:text-primary hover:underline text-left"
                      >
                        {deal.dealName || deal.contactName || "Sem Nome"}
                      </button>
                      <span className="text-[13px] text-muted-foreground/70">{deal.companyName || "—"}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-[#00a3ff]"></div>
                      {formatCurrency(deal.value || 0)}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-[#8b5cf6]"></div>
                      {formatCurrency(deal.value || 0)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
