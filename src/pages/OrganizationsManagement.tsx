import React, { useState, useMemo } from "react";
import { useOrganizationStore, Organization } from "@/lib/organizationStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Building2, Trash2, Edit2, Shield, Check, Save, Ban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ensureWorkspacePipelineStages } from "@/lib/pipelineStagesPersistence";

// ── Helper: calculate next due date ──────────────────────────────
function calcNextDueDate(billingFrequency: string, dueDay: number): string {
  const today = new Date();
  const day = Math.min(Math.max(dueDay || 1, 1), 28); // clamp 1-28

  const monthsToAdd: Record<string, number> = {
    Mensal: 1,
    Trimestral: 3,
    Semestral: 6,
    Anual: 12,
  };
  const increment = monthsToAdd[billingFrequency] || 1;

  // Start from the current month: try to build a date with the chosen day
  let candidate = new Date(today.getFullYear(), today.getMonth(), day);

  // If that date is today or already passed, jump forward by one period
  if (candidate <= today) {
    candidate = new Date(today.getFullYear(), today.getMonth() + increment, day);
  }

  // Format as YYYY-MM-DD
  const yyyy = candidate.getFullYear();
  const mm = String(candidate.getMonth() + 1).padStart(2, "0");
  const dd = String(candidate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ── Select helper styled like Input ──────────────────────────────
const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const maskCnpj = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .substring(0, 18);
};

const maskPhone = (value: string) => {
  const v = value.replace(/\D/g, "");
  if (v.length <= 10) {
    return v.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2").substring(0, 14);
  }
  return v.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").substring(0, 15);
};

const DEFAULT_FORM_STATE = {
  name: "",
  legalName: "",
  tradeName: "",
  cnpj: "",
  email: "",
  phone: "",
  whatsapp: "",
  website: "",
  managerName: "",
  contractEndDate: "",
  maxUsers: 10,
  maxWorkspaces: 3,
  status: "Ativo",
  isActive: true,
  billingFrequency: "Mensal",
  dueDay: 10,
  subscriptionStatus: "Ativa",
};

export const OrganizationsManagement = () => {
  const {
    organizations,
    addOrganization,
    updateOrganization,
    deleteOrganization,
    activeOrganizationId,
    setActiveOrganization,
  } = useOrganizationStore();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_STATE);
  const [organizationPendingDeletion, setOrganizationPendingDeletion] = useState<Organization | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-calculated next due date (read-only)
  const nextDueDate = useMemo(
    () => calcNextDueDate(formData.billingFrequency, formData.dueDay),
    [formData.billingFrequency, formData.dueDay]
  );

  const handleOpenAdd = () => {
    setFormData(DEFAULT_FORM_STATE);
    setEditingId(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (org: Organization) => {
    setFormData({
      name: org.name || "",
      legalName: org.legalName || "",
      tradeName: org.tradeName || "",
      cnpj: org.cnpj || "",
      email: org.email || "",
      phone: org.phone || "",
      whatsapp: org.whatsapp || "",
      website: org.website || "",
      managerName: org.managerName || "",
      contractEndDate: org.contractEndDate ? org.contractEndDate.split("T")[0] : "",
      maxUsers: org.maxUsers || 10,
      maxWorkspaces: org.maxWorkspaces || 3,
      status: org.status || "Ativo",
      isActive: org.isActive !== false,
      billingFrequency: org.billingFrequency || "Mensal",
      dueDay: org.dueDay || 10,
      subscriptionStatus: org.subscriptionStatus || "Ativa",
    });
    setEditingId(org.id);
    setIsAddOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("O Nome da Organização é obrigatório.");
      return;
    }

    try {
      const payload = {
        ...formData,
        contractEndDate: formData.contractEndDate
          ? new Date(formData.contractEndDate).toISOString()
          : undefined,
        nextDueDate,
      };

      if (editingId) {
        await updateOrganization(editingId, payload);
        toast.success("Organização atualizada com sucesso!");
      } else {
        const newOrg = await addOrganization(payload);
        if (newOrg) {
          // Auto-create a default workspace
          const { supabase } = await import("@/integrations/supabase/client");
          const workspaceId = crypto.randomUUID();
          await supabase.from("workspaces").insert({
            id: workspaceId,
            name: "Geral",
            color: "#6366f1",
            organization_id: newOrg.id
          });
          await ensureWorkspacePipelineStages(workspaceId);
        }
        toast.success("Organização criada com sucesso!");
      }
      setIsAddOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar organização.");
    }
  };

  const handleDeleteOrganization = async () => {
    if (!organizationPendingDeletion) return;

    setIsDeleting(true);
    try {
      await deleteOrganization(organizationPendingDeletion.id);
      toast.success("Organização excluída com sucesso!");
      setOrganizationPendingDeletion(null);
    } catch (error) {
      console.error("Erro ao excluir organização:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a organização.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Badge color for subscription status
  const subStatusColor = (s?: string) => {
    switch (s) {
      case "Ativa":
        return "bg-green-100 text-green-700";
      case "Em atraso":
        return "bg-yellow-100 text-yellow-700";
      case "Bloqueada":
        return "bg-red-100 text-red-700";
      case "Cancelada":
        return "bg-gray-200 text-gray-600";
      default:
        return "bg-green-100 text-green-700";
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizações (Multi-Tenant)</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os clientes e alterne o contexto administrativo.
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Organização
        </Button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {organizations.map((org) => (
          <div
            key={org.id}
            className={`flex flex-col p-4 rounded-xl border ${
              activeOrganizationId === org.id
                ? "border-primary ring-1 ring-primary/20 bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-1">
                {activeOrganizationId === org.id && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full flex items-center gap-1 uppercase mr-2">
                    <Check className="h-3 w-3" /> Contexto Ativo
                  </span>
                )}
                <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(org)} className="h-8 w-8">
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOrganizationPendingDeletion(org)}
                  className="h-8 w-8 text-destructive"
                  aria-label={`Excluir organização ${org.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <h3 className="font-semibold text-lg mb-1">{org.name}</h3>
            {org.cnpj && <p className="text-xs text-muted-foreground mb-1">CNPJ: {org.cnpj}</p>}

            <div className="flex flex-wrap gap-2 mb-4 mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${subStatusColor(org.subscriptionStatus)}`}>
                {org.subscriptionStatus || "Ativa"}
              </span>
              {['Bloqueada', 'Cancelada'].includes(org.subscriptionStatus || '') && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-200 text-red-800 flex items-center gap-1">
                  <Ban className="h-3 w-3" /> Acesso Bloqueado
                </span>
              )}
              {org.nextDueDate && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Venc: {new Date(org.nextDueDate + "T00:00:00").toLocaleDateString()}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Criado em {new Date(org.createdAt).toLocaleDateString()}
            </p>

            <Button
              variant={activeOrganizationId === org.id ? "default" : "outline"}
              className="mt-auto w-full gap-2"
              onClick={() => setActiveOrganization(org.id)}
            >
              <Shield className="h-4 w-4" />
              {activeOrganizationId === org.id ? "Atuando como esta Empresa" : "Entrar nesta Empresa"}
            </Button>
          </div>
        ))}
      </div>

      {/* ── Dialog: single-page form ──────────────────────────────── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Organização" : "Nova Organização"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* ── Dados da Organização ──────────────────────────── */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2 w-full">
                Dados da Organização
              </legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Nome da Organização *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome Principal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Razão Social</Label>
                  <Input
                    value={formData.legalName}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                    placeholder="Razão Social LTDA"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome Fantasia</Label>
                  <Input
                    value={formData.tradeName}
                    onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                    placeholder="Nome Fantasia"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: maskCnpj(e.target.value) })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
              </div>
            </fieldset>

            {/* ── Contato ──────────────────────────────────────── */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2 w-full">
                Contato
              </legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Responsável</Label>
                  <Input
                    value={formData.managerName}
                    onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                    placeholder="Nome Completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
                    placeholder="(00) 0000-0000"
                  />
                </div>
              </div>
            </fieldset>

            {/* ── Limites ──────────────────────────────────────── */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2 w-full">
                Limites
              </legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Máx. Usuários</Label>
                  <Input
                    type="number"
                    value={formData.maxUsers}
                    onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Máx. Workspaces</Label>
                  <Input
                    type="number"
                    value={formData.maxWorkspaces}
                    onChange={(e) => setFormData({ ...formData, maxWorkspaces: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </fieldset>

            {/* ── Assinatura ───────────────────────────────────── */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2 w-full">
                Assinatura
              </legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Periodicidade da Cobrança</Label>
                  <select
                    className={selectClass}
                    value={formData.billingFrequency}
                    onChange={(e) => setFormData({ ...formData, billingFrequency: e.target.value })}
                  >
                    <option value="Mensal">Mensal</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Semestral">Semestral</option>
                    <option value="Anual">Anual</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Dia do Vencimento</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={formData.dueDay}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDay: Math.min(Math.max(parseInt(e.target.value) || 1, 1), 28) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Próximo Vencimento</Label>
                  <Input
                    type="date"
                    value={nextDueDate}
                    disabled
                    className="bg-muted/40 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-muted-foreground">Calculado automaticamente</p>
                </div>
                <div className="space-y-2">
                  <Label>Status da Assinatura</Label>
                  <select
                    className={selectClass}
                    value={formData.subscriptionStatus}
                    onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value })}
                  >
                    <option value="Ativa">Ativa</option>
                    <option value="Em atraso">Em atraso</option>
                    <option value="Bloqueada">Bloqueada</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
                <div className="space-y-2 col-span-2">
                  <p className="text-[11px] text-muted-foreground mt-2">
                    * Se o status for alterado para <strong>Bloqueada</strong> ou <strong>Cancelada</strong>, o acesso dos usuários vinculados a esta organização será bloqueado automaticamente.
                  </p>
                </div>
              </div>
            </fieldset>
          </div>

          {/* ── Footer ─────────────────────────────────────────── */}
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" /> Salvar Organização
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={organizationPendingDeletion !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setOrganizationPendingDeletion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir organização?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a organização <strong>{organizationPendingDeletion?.name}</strong>?
              Os workspaces vinculados também serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDeleteOrganization} disabled={isDeleting}>
              {isDeleting ? "Excluindo..." : "Excluir organização"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
