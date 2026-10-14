import { useMemo, useState } from "react";
import { useDealsStore } from "@/lib/dealsStore";
import { useCRMCompaniesStore, type CRMCompany } from "@/lib/crmCompaniesStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { useUsersStore } from "@/lib/usersStore";
import { exportRowsToExcel } from "@/lib/exportExcel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Inbox, Plus, Edit2, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildSearchText, matchesSearchTerm } from "@/lib/searchMatch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CreateCompanyDialog } from "./CreateCompanyDialog";
import { toast } from "sonner";
import { canViewAssignedRecord, canViewDeal } from "@/lib/permissions";
import type { Role } from "@/lib/rolesStore";
import type { UserProfile } from "@/lib/usersStore";

export interface GlobalCompany extends CRMCompany {
  dealsCount: number;
  branchesCount: number;
  parentCompanyName?: string;
}

interface Props {
  onOpenCompany?: (companyId: string) => void;
  currentUser?: UserProfile;
  currentUserRole?: Role;
}

export function GlobalCompaniesList({ onOpenCompany, currentUser, currentUserRole }: Props) {
  const { deals } = useDealsStore();
  const { companies, removeCompany } = useCRMCompaniesStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { users } = useUsersStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingCompany, setEditingCompany] = useState<GlobalCompany | undefined>(undefined);
  const [companyPendingDeletion, setCompanyPendingDeletion] = useState<GlobalCompany | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const mappedCompanies = useMemo(() => {
    if (!activeWorkspaceId) return [];

    const wsDeals = deals
      .filter((deal) => deal.workspaceId === activeWorkspaceId)
      .filter((deal) => canViewDeal(currentUserRole, currentUser, deal));
    const wsCompanies = companies
      .filter((company) => company.workspaceId === activeWorkspaceId)
      .filter((company) => canViewAssignedRecord(currentUserRole, currentUser, company.assignedTo, "companies"));

    return wsCompanies
      .map((company) => {
        const companyDeals = wsDeals.filter(
          (deal) => deal.companyId === company.id || (deal.companyName && deal.companyName.toLowerCase() === company.name.toLowerCase()),
        );
        const branchesCount = wsCompanies.filter((item) => item.parentCompanyId === company.id).length;
        const parentCompanyName = company.parentCompanyId
          ? wsCompanies.find((item) => item.id === company.parentCompanyId)?.name
          : undefined;

        return {
          ...company,
          dealsCount: companyDeals.length,
          branchesCount,
          parentCompanyName,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeWorkspaceId, companies, deals, currentUser, currentUserRole]);

  const visibleCompanies = useMemo(
    () =>
      mappedCompanies.filter((company) =>
        matchesSearchTerm(
          searchTerm,
          buildSearchText([
            company.name,
            company.segment,
            company.address,
            company.url,
            company.parentCompanyName,
            users.find((user) => user.id === company.assignedTo)?.name,
          ]),
          [company.cnpj],
        ),
      ),
    [mappedCompanies, searchTerm, users],
  );

  const handleDelete = async () => {
    if (!companyPendingDeletion) return;
    setIsDeleting(true);
    try {
      await removeCompany(companyPendingDeletion.id);
      toast.success("Empresa excluída com sucesso!");
      setCompanyPendingDeletion(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a empresa.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCompanies = () => {
    exportRowsToExcel({
      filename: `empresas-${new Date().toISOString().slice(0, 10)}`,
      sheetName: "Empresas",
      rows: visibleCompanies,
      columns: [
        { header: "Razão Social", value: "name" },
        { header: "CPF/CNPJ", value: (company) => company.cnpj || "-" },
        { header: "Estrutura", value: (company) => company.companyType === "FILIAL" ? "Filial" : "Matriz" },
        { header: "Nome da Matriz", value: (company) => company.parentCompanyName || "-" },
        { header: "Filiais", value: (company) => company.branchesCount },
        { header: "Responsável Interno", value: (company) => users.find((user) => user.id === company.assignedTo)?.name || "-" },
        { header: "Negociações", value: (company) => company.dealsCount },
        { header: "Segmento", value: (company) => company.segment || "-" },
        { header: "Site", value: (company) => company.url || "-" },
        { header: "Endereço", value: (company) => company.address || "-" },
      ],
    });

    toast.success(`Excel de empresas exportado com ${visibleCompanies.length} registro${visibleCompanies.length === 1 ? "" : "s"}.`);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="relative w-full max-w-[320px] min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por razão social, CNPJ, segmento..."
            aria-label="Buscar empresas"
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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCompanies} className="gap-2" disabled={visibleCompanies.length === 0}>
            <Download className="w-4 h-4" />
            Exportar Excel
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Empresa
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
              <TableHead className="h-10 align-middle font-semibold text-muted-foreground">Razão Social</TableHead>
              <TableHead className="h-10 align-middle font-semibold text-muted-foreground">CNPJ</TableHead>
              <TableHead className="h-10 align-middle font-semibold text-muted-foreground">Estrutura</TableHead>
              <TableHead className="h-10 align-middle font-semibold text-muted-foreground">Responsável Interno</TableHead>
              <TableHead className="h-10 align-middle text-center font-semibold text-muted-foreground">Negociações</TableHead>
              <TableHead className="h-10 w-[100px] align-middle font-semibold text-muted-foreground"></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visibleCompanies.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground opacity-60">
                    <Inbox className="mb-4 h-16 w-16 stroke-[1] text-muted-foreground/30" />
                    <span className="text-sm font-medium">
                      {searchTerm.trim() ? `Nenhuma empresa encontrada para "${searchTerm.trim()}"` : "Não há empresas cadastradas"}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visibleCompanies.map((company) => {
                const assignedUser = users.find((user) => user.id === company.assignedTo);
                const structureLabel =
                  company.companyType === "MATRIZ"
                    ? `Tipo: Matriz | Filiais: ${company.branchesCount}`
                    : `Tipo: Filial | Matriz: ${company.parentCompanyName || "Não definida"}`;

                return (
                  <TableRow key={company.id} className="group transition-colors hover:bg-muted/50">
                    <TableCell className="py-3">
                      {onOpenCompany ? (
                        <button onClick={() => onOpenCompany(company.id)} className="text-left font-semibold text-primary hover:underline">
                          {company.name}
                        </button>
                      ) : (
                        <span className="font-semibold text-foreground">{company.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">{company.cnpj || "-"}</TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">{structureLabel}</TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">{assignedUser?.name || "-"}</TableCell>
                    <TableCell className="py-3 text-center">
                      <span className="inline-flex h-7 min-w-[32px] items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-bold text-primary">
                        {company.dealsCount}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingCompany(company);
                            setShowCreate(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                          onClick={() => setCompanyPendingDeletion(company)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateCompanyDialog
        open={showCreate}
        onOpenChange={(value) => {
          setShowCreate(value);
          if (!value) setEditingCompany(undefined);
        }}
        initialData={editingCompany}
      />

      <AlertDialog
        open={companyPendingDeletion !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setCompanyPendingDeletion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa <strong>{companyPendingDeletion?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" disabled={isDeleting} onClick={handleDelete}>
                {isDeleting ? "Excluindo..." : "Excluir empresa"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
