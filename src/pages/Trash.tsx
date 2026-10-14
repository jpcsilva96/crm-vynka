import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, ContactRound, FileText, Inbox, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setWorkspaceHeader, supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { useDealsStore } from "@/lib/dealsStore";
import { useCRMContactsStore } from "@/lib/crmContactsStore";
import { useCRMCompaniesStore } from "@/lib/crmCompaniesStore";

type TrashItemType = "deal" | "contact" | "company";

type TrashItem = {
  id: string;
  type: TrashItemType;
  title: string;
  subtitle?: string;
  deletedAt: string;
};

const RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const typeConfig: Record<TrashItemType, { label: string; icon: typeof FileText }> = {
  deal: { label: "Negociação", icon: FileText },
  contact: { label: "Contato", icon: ContactRound },
  company: { label: "Empresa", icon: Building2 },
};

const db = supabase as any;

const getDaysRemaining = (deletedAt: string) => {
  const expiresAt = new Date(deletedAt).getTime() + RETENTION_DAYS * MS_PER_DAY;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / MS_PER_DAY));
};

export default function Trash() {
  const { activeWorkspaceId } = useWorkspaceStore();
  const fetchDeals = useDealsStore((state) => state.fetchDeals);
  const fetchContacts = useCRMContactsStore((state) => state.fetchContacts);
  const fetchCompanies = useCRMCompaniesStore((state) => state.fetchCompanies);
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState<TrashItem | null>(null);
  const [emptyTrashConfirmationOpen, setEmptyTrashConfirmationOpen] = useState(false);
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);

  const refreshActiveStores = useCallback(async () => {
    if (!activeWorkspaceId) return;
    await Promise.all([
      fetchDeals(activeWorkspaceId),
      fetchContacts(activeWorkspaceId),
      fetchCompanies(activeWorkspaceId),
    ]);
  }, [activeWorkspaceId, fetchCompanies, fetchContacts, fetchDeals]);

  const purgeExpiredItems = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const cutoff = new Date(Date.now() - RETENTION_DAYS * MS_PER_DAY).toISOString();

    const results = await Promise.all([
      db.from("crm_deals").delete().eq("workspace_id", activeWorkspaceId).filter("deleted_at", "not.is", null).lte("deleted_at", cutoff),
      db.from("crm_contacts").delete().eq("workspace_id", activeWorkspaceId).filter("deleted_at", "not.is", null).lte("deleted_at", cutoff),
      db.from("crm_companies").delete().eq("workspace_id", activeWorkspaceId).filter("deleted_at", "not.is", null).lte("deleted_at", cutoff),
    ]);

    results.forEach((result, index) => {
      if (result.error) {
        const table = ["crm_deals", "crm_contacts", "crm_companies"][index];
        console.error(`Error purging expired trash items from ${table}:`, result.error);
      }
    });
  }, [activeWorkspaceId]);

  const fetchTrash = useCallback(async () => {
    if (!activeWorkspaceId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setWorkspaceHeader(activeWorkspaceId);

    try {
      await purgeExpiredItems();

      const [dealsResult, contactsResult, companiesResult] = await Promise.all([
        db
          .from("crm_deals")
          .select("id, deal_code, deal_name, contact_name, deleted_at")
          .eq("workspace_id", activeWorkspaceId)
          .filter("deleted_at", "not.is", null)
          .order("deleted_at", { ascending: false }),
        db
          .from("crm_contacts")
          .select("id, name, phone, email, deleted_at")
          .eq("workspace_id", activeWorkspaceId)
          .filter("deleted_at", "not.is", null)
          .order("deleted_at", { ascending: false }),
        db
          .from("crm_companies")
          .select("id, name, cnpj, deleted_at")
          .eq("workspace_id", activeWorkspaceId)
          .filter("deleted_at", "not.is", null)
          .order("deleted_at", { ascending: false }),
      ]);

      const queryErrors = [
        { label: "negociações", error: dealsResult.error },
        { label: "contatos", error: contactsResult.error },
        { label: "empresas", error: companiesResult.error },
      ].filter((result) => result.error);

      if (queryErrors.length > 0) {
        queryErrors.forEach((result) => console.error(`Error fetching deleted ${result.label}:`, result.error));
        toast.error(`Erro ao carregar ${queryErrors.map((result) => result.label).join(", ")} da lixeira.`);
      }

      const nextItems: TrashItem[] = [
        ...(dealsResult.data || []).map((deal: any) => ({
          id: deal.id,
          type: "deal" as const,
          title: [deal.deal_code, deal.deal_name || deal.contact_name || "Negociação sem nome"].filter(Boolean).join(" - "),
          subtitle: deal.contact_name || undefined,
          deletedAt: deal.deleted_at,
        })),
        ...(contactsResult.data || []).map((contact: any) => ({
          id: contact.id,
          type: "contact" as const,
          title: contact.name || "Contato sem nome",
          subtitle: [contact.phone, contact.email].filter(Boolean).join(" • ") || undefined,
          deletedAt: contact.deleted_at,
        })),
        ...(companiesResult.data || []).map((company: any) => ({
          id: company.id,
          type: "company" as const,
          title: company.name || "Empresa sem nome",
          subtitle: company.cnpj || undefined,
          deletedAt: company.deleted_at,
        })),
      ].sort((left, right) => new Date(right.deletedAt).getTime() - new Date(left.deletedAt).getTime());

      setItems(nextItems);
    } catch (error) {
      console.error("Error fetching trash:", error);
      toast.error("Erro ao carregar a lixeira.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, purgeExpiredItems]);

  useEffect(() => {
    void fetchTrash();
  }, [fetchTrash]);

  const tableForType = (type: TrashItemType) =>
    type === "deal" ? "crm_deals" : type === "contact" ? "crm_contacts" : "crm_companies";

  const restoreItem = async (item: TrashItem) => {
    try {
      const payload = item.type === "deal"
        ? { deleted_at: null, updated_at: new Date().toISOString() }
        : { deleted_at: null };

      const { error } = await db.from(tableForType(item.type)).update(payload).eq("id", item.id);
      if (error) throw error;

      toast.success(`${typeConfig[item.type].label} restaurado(a).`);
      await refreshActiveStores();
      await fetchTrash();
    } catch (error) {
      console.error("Error restoring trash item:", error);
      toast.error("Erro ao restaurar item.");
    }
  };

  const confirmPermanentDelete = async () => {
    if (!pendingPermanentDelete) return;

    try {
      const { error } = await db.from(tableForType(pendingPermanentDelete.type)).delete().eq("id", pendingPermanentDelete.id);
      if (error) throw error;

      toast.success("Item excluído permanentemente.");
      setPendingPermanentDelete(null);
      await fetchTrash();
    } catch (error) {
      console.error("Error permanently deleting trash item:", error);
      toast.error("Erro ao excluir permanentemente.");
    }
  };

  const emptyTrash = async () => {
    if (!activeWorkspaceId || items.length === 0) return;

    setIsEmptyingTrash(true);
    try {
      const results = await Promise.all([
        db.from("crm_deals").delete().eq("workspace_id", activeWorkspaceId).filter("deleted_at", "not.is", null),
        db.from("crm_contacts").delete().eq("workspace_id", activeWorkspaceId).filter("deleted_at", "not.is", null),
        db.from("crm_companies").delete().eq("workspace_id", activeWorkspaceId).filter("deleted_at", "not.is", null),
      ]);
      const errors = results.map((result) => result.error).filter(Boolean);

      if (errors.length > 0) {
        errors.forEach((error) => console.error("Error emptying trash:", error));
        toast.error("Não foi possível esvaziar toda a lixeira. Atualize a tela para conferir os itens restantes.");
      } else {
        toast.success(`Lixeira esvaziada. ${items.length} item(ns) removido(s) permanentemente.`);
      }

      setEmptyTrashConfirmationOpen(false);
      await Promise.all([fetchTrash(), refreshActiveStores()]);
    } catch (error) {
      console.error("Error emptying trash:", error);
      toast.error("Erro ao esvaziar a lixeira.");
    } finally {
      setIsEmptyingTrash(false);
    }
  };

  const stats = useMemo(
    () => ({
      deal: items.filter((item) => item.type === "deal").length,
      contact: items.filter((item) => item.type === "contact").length,
      company: items.filter((item) => item.type === "company").length,
    }),
    [items],
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lixeira</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Itens excluídos ficam disponíveis para recuperação por até {RETENTION_DAYS} dias.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => setEmptyTrashConfirmationOpen(true)}
            disabled={loading || isEmptyingTrash || items.length === 0}
          >
            <Trash2 className="h-4 w-4" />
            Esvaziar lixeira
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => void fetchTrash()} disabled={loading || isEmptyingTrash}>
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {(["deal", "contact", "company"] as TrashItemType[]).map((type) => {
          const Icon = typeConfig[type].icon;
          return (
            <div key={type} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{typeConfig[type].label}s</p>
                  <p className="text-2xl font-bold text-foreground">{stats[type]}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
        {items.length === 0 ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Inbox className="mb-3 h-10 w-10 opacity-50" />
            <p className="text-sm font-semibold">Nenhum item na lixeira</p>
            <p className="mt-1 text-xs">Negociações, contatos e empresas excluídos aparecerão aqui.</p>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead>Excluído em</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const Icon = typeConfig[item.type].icon;
                  const daysRemaining = getDaysRemaining(item.deletedAt);
                  return (
                    <TableRow key={`${item.type}-${item.id}`}>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-foreground">
                          <Icon className="h-3.5 w-3.5" />
                          {typeConfig[item.type].label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[520px]">
                          <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                          {item.subtitle ? <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(item.deletedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {daysRemaining === 1 ? "1 dia restante" : `${daysRemaining} dias restantes`}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => void restoreItem(item)}>
                            Restaurar
                          </Button>
                          <Button variant="destructive" size="sm" className="gap-2" onClick={() => setPendingPermanentDelete(item)}>
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingPermanentDelete} onOpenChange={(open) => !open && setPendingPermanentDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá "{pendingPermanentDelete?.title}" de forma definitiva e não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmPermanentDelete()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={emptyTrashConfirmationOpen} onOpenChange={setEmptyTrashConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Esvaziar lixeira?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os {items.length} itens excluídos deste workspace serão removidos permanentemente. Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isEmptyingTrash}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void emptyTrash()}
              disabled={isEmptyingTrash}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isEmptyingTrash ? "Esvaziando..." : "Esvaziar lixeira"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
