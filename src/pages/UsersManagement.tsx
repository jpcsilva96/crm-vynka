import { useState } from "react";
import { Check, Key, Pencil, Plus, Save, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DEFAULT_ROLE_PERMISSIONS, type RecordVisibility, type Role, type RolePermissions, useRolesStore } from "@/lib/rolesStore";
import { normalizeWorkspaceIds, type UserProfile, useUsersStore } from "@/lib/usersStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";

interface UsersManagementProps {
  embedded?: boolean;
}

type RoleForm = {
  name: string;
  permissions: RolePermissions;
};

const createDefaultRoleForm = (): RoleForm => ({
  name: "",
  permissions: { ...DEFAULT_ROLE_PERMISSIONS },
});

const AVAILABLE_MENUS = [
  { id: "pipeline", label: "CRM / Pipeline", description: "Negociações, tarefas, contatos e empresas." },
  { id: "settings", label: "Configurações", description: "Configurações operacionais do workspace." },
  { id: "users", label: "Usuários e Acessos", description: "Cadastro de usuários e perfis." },
];

const ROLE_PRESETS: Array<{ id: string; label: string; description: string; form: RoleForm }> = [
  {
    id: "org-admin",
    label: "Administrador",
    description: "Administra CRM, configurações e usuários da organização.",
    form: {
      name: "Administrador da Organização",
      permissions: {
        ...DEFAULT_ROLE_PERMISSIONS,
        menus: ["pipeline", "settings", "users"],
        dealsVisibility: "all",
        tasksVisibility: "all",
        contactsVisibility: "all",
        companiesVisibility: "all",
        canDeleteRecords: true,
        canManageSettings: true,
        canManageUsers: true,
        dealsDelete: true,
      },
    },
  },
  {
    id: "manager",
    label: "Gestor Comercial",
    description: "Opera o CRM com visão de toda a equipe.",
    form: {
      name: "Gestor Comercial",
      permissions: {
        ...DEFAULT_ROLE_PERMISSIONS,
        menus: ["pipeline"],
        dealsVisibility: "all",
        tasksVisibility: "all",
        contactsVisibility: "all",
        companiesVisibility: "all",
      },
    },
  },
  {
    id: "sales",
    label: "Vendedor",
    description: "Opera o CRM sem permissões destrutivas.",
    form: {
      name: "Vendedor",
      permissions: {
        ...DEFAULT_ROLE_PERMISSIONS,
        menus: ["pipeline"],
        dealsVisibility: "own",
        tasksVisibility: "own",
        contactsVisibility: "own",
        companiesVisibility: "own",
      },
    },
  },
];

const visibilityLabel: Record<RecordVisibility, string> = {
  all: "Todos do workspace",
  team: "Workspaces liberados",
  own: "Apenas próprios",
};

const VISIBILITY_FIELDS: Array<{
  key: keyof Pick<RolePermissions, "dealsVisibility" | "tasksVisibility" | "contactsVisibility" | "companiesVisibility">;
  label: string;
  ownLabel: string;
}> = [
  { key: "dealsVisibility", label: "Negociações", ownLabel: "Ver apenas negociações próprias" },
  { key: "tasksVisibility", label: "Tarefas", ownLabel: "Ver apenas tarefas proprias" },
  { key: "contactsVisibility", label: "Contatos", ownLabel: "Ver apenas contatos proprios" },
  { key: "companiesVisibility", label: "Empresas", ownLabel: "Ver apenas empresas proprias" },
];

export default function UsersManagement({ embedded = false }: UsersManagementProps) {
  const { users, addUser, updateUser, deleteUser } = useUsersStore();
  const { roles, addRole, updateRole, deleteRole } = useRolesStore();
  const { workspaces } = useWorkspaceStore();
  const visibleUsers = users.filter((user) => !roles.some((role) => role.id === user.roleId && role.isMaster));

  const [activeTab, setActiveTab] = useState("users");
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userPendingDelete, setUserPendingDelete] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    cpf: "",
    roleId: "",
    workspaces: [] as string[],
  });

  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>(() => createDefaultRoleForm());

  const resetRoleForm = () => {
    setEditingRoleId(null);
    setRoleForm(createDefaultRoleForm());
  };

  const setRolePermission = <K extends keyof RolePermissions>(key: K, value: RolePermissions[K]) => {
    setRoleForm((current) => ({
      ...current,
      permissions: { ...current.permissions, [key]: value },
    }));
  };

  const toggleMenu = (menuId: string, checked: boolean) => {
    setRoleForm((current) => {
      const menus = checked
        ? Array.from(new Set([...current.permissions.menus, menuId]))
        : current.permissions.menus.filter((id) => id !== menuId);

      return {
        ...current,
        permissions: {
          ...current.permissions,
          menus,
          canManageSettings: menuId === "settings" ? checked : current.permissions.canManageSettings,
          canManageUsers: menuId === "users" ? checked : current.permissions.canManageUsers,
        },
      };
    });
  };

  const applyPreset = (preset: RoleForm) => {
    setRoleForm({
      name: preset.name,
      permissions: { ...preset.permissions, menus: [...preset.permissions.menus] },
    });
    setShowRoleForm(true);
    setEditingRoleId(null);
  };

  const handleEditUser = (user: UserProfile) => {
    setEditingUserId(user.id);
    setUserForm({
      name: user.name,
      email: user.email,
      cpf: user.cpf,
      roleId: user.roleId,
      workspaces: normalizeWorkspaceIds(user.workspaces),
    });
    setShowUserForm(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.roleId) {
      toast.error("Preencha nome, email e perfil.");
      return;
    }

    const sanitizedUserForm = {
      ...userForm,
      workspaces: normalizeWorkspaceIds(userForm.workspaces),
    };

    try {
      if (editingUserId) {
        await updateUser(editingUserId, sanitizedUserForm);
        toast.success("Usuário atualizado!");
      } else {
        await addUser(sanitizedUserForm);
        toast.success("Usuário criado!");
      }
      setShowUserForm(false);
      setEditingUserId(null);
      setUserForm({ name: "", email: "", cpf: "", roleId: "", workspaces: [] });
    } catch {
      // Store shows the error toast.
    }
  };

  const handleResetPassword = (userId: string) => {
    if (confirm("Deseja realmente resetar a senha deste usuário para '123456'?")) {
      updateUser(userId, { password: "123456", requirePasswordChange: true });
      toast.success("Senha resetada para '123456' com sucesso!");
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userPendingDelete) return;

    setIsDeletingUser(true);
    try {
      await deleteUser(userPendingDelete.id);
      toast.success("Usuário excluído!");
      setUserPendingDelete(null);
    } catch {
      // Store shows the error toast.
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleEditRole = (role: Role) => {
    if (role.isMaster) {
      toast.error("O perfil Master não pode ser editado.");
      return;
    }
    setEditingRoleId(role.id);
    setRoleForm({
      name: role.name,
      permissions: { ...role.permissions, menus: [...role.permissions.menus] },
    });
    setShowRoleForm(true);
  };

  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error("Preencha o nome do perfil.");
      return;
    }

    const nextRole = {
      name: roleForm.name.trim(),
      permissions: {
        ...roleForm.permissions,
        dealsEdit: true,
        dealsDelete: roleForm.permissions.canDeleteRecords,
      },
    };

    try {
      if (editingRoleId) {
        await updateRole(editingRoleId, nextRole);
        toast.success("Perfil atualizado!");
      } else {
        await addRole(nextRole);
        toast.success("Perfil criado!");
      }
      setShowRoleForm(false);
      resetRoleForm();
    } catch {
      // Store shows the error toast.
    }
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-background", embedded && "h-auto overflow-visible bg-transparent")}>
      {!embedded ? (
        <div className="flex h-14 shrink-0 items-center gap-3 bg-chat-header px-6">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-chat-header-foreground">
            <Shield className="h-5 w-5 text-primary" />
            Gerenciamento de Acessos
          </h1>
        </div>
      ) : null}

      <div className={cn("mx-auto w-full max-w-5xl space-y-8 p-6 pb-24", embedded && "max-w-none p-0 pb-0")}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8 grid w-full max-w-[400px] grid-cols-2">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" /> Perfis de Acesso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Usuários do Sistema</h2>
              <Button onClick={() => { setShowUserForm(true); setEditingUserId(null); }} className="gap-2">
                <Plus className="h-4 w-4" /> Novo Usuário
              </Button>
            </div>

            {showUserForm && (
              <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
                <h3 className="text-base font-semibold">{editingUserId ? "Editar Usuário" : "Novo Usuário"}</h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome completo</Label>
                    <Input value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input value={userForm.cpf} onChange={(event) => setUserForm({ ...userForm, cpf: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Perfil de acesso</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={userForm.roleId}
                      onChange={(event) => setUserForm({ ...userForm, roleId: event.target.value })}
                    >
                      <option value="" disabled>Selecione um perfil...</option>
                      {roles.filter((role) => !role.isMaster).map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Workspaces liberados</Label>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {workspaces.map((workspace) => (
                      <label key={workspace.id} className="flex cursor-pointer items-center gap-2 rounded-md border p-3 hover:bg-muted/50">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={userForm.workspaces.includes(workspace.id)}
                          onChange={(event) => {
                            const workspaces = event.target.checked
                              ? normalizeWorkspaceIds([...userForm.workspaces, workspace.id])
                              : userForm.workspaces.filter((id) => id !== workspace.id);
                            setUserForm({ ...userForm, workspaces });
                          }}
                        />
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: workspace.color || "#ccc" }} />
                        <span className="text-sm font-medium">{workspace.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-border pt-4">
                  <Button variant="ghost" onClick={() => setShowUserForm(false)}>Cancelar</Button>
                  <Button onClick={handleSaveUser} className="gap-2">
                    <Save className="h-4 w-4" /> Salvar Usuário
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium">Nome / Email</th>
                    <th className="px-6 py-3 font-medium">Perfil</th>
                    <th className="px-6 py-3 font-medium">Workspaces</th>
                    <th className="px-6 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleUsers.map((user) => {
                    const role = roles.find((item) => item.id === user.roleId);
                    const userWorkspaceCount = normalizeWorkspaceIds(user.workspaces).length;
                    return (
                      <tr key={user.id} className="hover:bg-muted/30">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold", role?.isMaster ? "bg-primary/20 text-primary" : "bg-muted text-foreground")}>
                            {role?.name || "Desconhecido"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {role?.isMaster ? "Todos" : userWorkspaceCount > 0 ? `${userWorkspaceCount} liberados` : "Nenhum"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="ghost" size="icon" title="Resetar senha" onClick={() => handleResetPassword(user.id)} disabled={role?.isMaster}>
                            <Key className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => handleEditUser(user)} disabled={role?.isMaster}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Excluir" className="text-red-500 hover:text-red-600" onClick={() => setUserPendingDelete(user)} disabled={role?.isMaster}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Perfis de Acesso</h2>
              <Button onClick={() => { resetRoleForm(); setShowRoleForm(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Novo Perfil
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {ROLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.form)}
                  className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/60 hover:bg-muted/40"
                >
                  <p className="text-sm font-semibold text-foreground">{preset.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{preset.description}</p>
                </button>
              ))}
            </div>

            {showRoleForm && (
              <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
                <h3 className="text-base font-semibold">{editingRoleId ? "Editar Perfil" : "Novo Perfil"}</h3>
                <div className="space-y-2 max-w-md">
                  <Label>Nome do perfil</Label>
                  <Input value={roleForm.name} onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} placeholder="Ex: Vendedor, Backoffice" />
                </div>

                <div className="grid grid-cols-1 gap-8 border-t pt-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold">Módulos liberados</h4>
                    <div className="space-y-3">
                      {AVAILABLE_MENUS.map((menu) => (
                        <div key={menu.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
                          <div>
                            <Label className="cursor-pointer text-sm font-medium">{menu.label}</Label>
                            <p className="mt-1 text-xs text-muted-foreground">{menu.description}</p>
                          </div>
                          <Switch checked={roleForm.permissions.menus.includes(menu.id)} onCheckedChange={(checked) => toggleMenu(menu.id, checked)} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <h4 className="text-sm font-semibold">Regras simples</h4>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground">Visibilidade dos negócios</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none"
                        value={roleForm.permissions.dealsVisibility}
                        onChange={(event) => setRolePermission("dealsVisibility", event.target.value as RolePermissions["dealsVisibility"])}
                      >
                        <option value="all">Ver todos do workspace</option>
                        <option value="team">Ver workspaces liberados</option>
                        <option value="own">Ver apenas próprios negócios</option>
                      </select>
                    </div>

                    <div className="space-y-3">
                      {VISIBILITY_FIELDS.filter((field) => field.key !== "dealsVisibility").map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <Label className="text-xs uppercase text-muted-foreground">{field.label}</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none"
                            value={roleForm.permissions[field.key]}
                            onChange={(event) => setRolePermission(field.key, event.target.value as RecordVisibility)}
                          >
                            <option value="all">Ver todos do workspace</option>
                            <option value="team">Ver workspaces liberados</option>
                            <option value="own">{field.ownLabel}</option>
                          </select>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3 rounded-md border border-border p-3">
                      {[
                        ["canDeleteRecords", "Pode excluir registros", "Controle inicial para exclusões sensíveis do CRM."],
                        ["canManageSettings", "Pode gerenciar configurações", "Mantém o módulo Configurações disponível."],
                        ["canManageUsers", "Pode gerenciar usuários", "Mantém Usuários e Acessos disponível."],
                      ].map(([key, label, description]) => (
                        <div key={key} className="flex items-center justify-between gap-4">
                          <div>
                            <Label className="text-sm font-normal">{label}</Label>
                            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                          </div>
                          <Switch
                            checked={Boolean(roleForm.permissions[key as keyof RolePermissions])}
                            onCheckedChange={(checked) => {
                              setRolePermission(key as keyof RolePermissions, checked as never);
                              if (key === "canManageSettings") toggleMenu("settings", checked);
                              if (key === "canManageUsers") toggleMenu("users", checked);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-border pt-6">
                  <Button variant="ghost" onClick={() => { setShowRoleForm(false); resetRoleForm(); }}>Cancelar</Button>
                  <Button onClick={handleSaveRole} className="gap-2">
                    <Save className="h-4 w-4" /> Salvar Perfil
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <div key={role.id} className="flex flex-col space-y-4 rounded-lg border border-border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 font-bold text-foreground">
                        {role.name}
                        {role.isMaster && <Shield className="h-3.5 w-3.5 text-primary" />}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {role.isMaster ? "Acesso irrestrito ao sistema" : `${role.permissions.menus.length} módulo(s) liberado(s)`}
                      </p>
                    </div>
                    {!role.isMaster && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditRole(role)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteRole(role.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {!role.isMaster && (
                    <div className="mt-auto space-y-2 border-t pt-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Negociacoes</span>
                        <span className="font-medium">{visibilityLabel[role.permissions.dealsVisibility]}</span>
                      </div>
                      {[
                        ["Tarefas", role.permissions.tasksVisibility],
                        ["Contatos", role.permissions.contactsVisibility],
                        ["Empresas", role.permissions.companiesVisibility],
                      ].map(([label, visibility]) => (
                        <div key={String(label)} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{visibilityLabel[visibility as RecordVisibility]}</span>
                        </div>
                      ))}
                      {[
                        ["Excluir", role.permissions.canDeleteRecords],
                        ["Configurações", role.permissions.canManageSettings],
                        ["Usuários", role.permissions.canManageUsers],
                      ].map(([label, enabled]) => (
                        <div key={String(label)} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className={enabled ? "inline-flex items-center gap-1 text-emerald-600" : "text-muted-foreground"}>
                            {enabled ? <Check className="h-3 w-3" /> : null}
                            {enabled ? "Sim" : "Não"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!userPendingDelete} onOpenChange={(open) => !open && !isDeletingUser && setUserPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o acesso de {userPendingDelete?.name || "este usuário"} ({userPendingDelete?.email || "sem email"}). O usuário não poderá mais entrar no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingUser}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDeleteUser();
              }}
              disabled={isDeletingUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingUser ? "Excluindo..." : "Excluir usuário"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
