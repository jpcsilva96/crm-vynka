import { useState } from "react";
import { useWorkspaceStore, type Workspace } from "@/lib/workspaceStore";
import { useUsersStore } from "@/lib/usersStore";
import { useRolesStore } from "@/lib/rolesStore";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { VynkaLogo } from "@/components/VynkaLogo";

interface Props {
  userEmail: string;
  onSelect: (workspace: Workspace) => void;
}

function WorkspacePickerSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-40 w-40 rounded-2xl" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 rounded-lg border border-border/60 px-4 py-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
}

export function WorkspacePicker({ userEmail, onSelect }: Props) {
  const { workspaces, addWorkspace, setActiveWorkspace, isLoading: isLoadingWorkspaces } = useWorkspaceStore();
  const { users, isLoading: isLoadingUsers } = useUsersStore();
  const { roles, isLoading: isLoadingRoles } = useRolesStore();
  
  const currentUser = users.find(u => u.email === userEmail);
  const currentUserRole = roles.find(r => r.id === currentUser?.roleId);
  const isMaster = !!currentUserRole?.isMaster;

  const allowedWorkspaces = isMaster 
    ? workspaces 
    : workspaces.filter(ws => currentUser?.workspaces.includes(ws.id));

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const handleSelect = (ws: Workspace) => {
    setActiveWorkspace(ws.id);
    onSelect(ws);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    addWorkspace(newName.trim());
    setNewName("");
    setShowCreate(false);
  };

  if (isLoadingWorkspaces || isLoadingUsers || isLoadingRoles) {
    return <WorkspacePickerSkeleton />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-3">
          <VynkaLogo className="text-[28px]" />
          <p className="text-muted-foreground text-sm">Selecione a empresa</p>
          <p className="text-xs text-muted-foreground">{userEmail}</p>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          {allowedWorkspaces.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto opacity-30 mb-3" />
              <p className="text-sm">Nenhuma empresa liberada.</p>
              <p className="text-xs mt-1">Peça ao administrador para liberar seu acesso.</p>
            </div>
          ) : (
            allowedWorkspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSelect(ws)}
                className="flex w-full items-center gap-4 rounded-lg px-4 py-4 text-left transition-colors border border-transparent hover:border-primary hover:bg-primary/5"
              >
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: ws.color }}
                >
                  {(ws.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ws.name}</p>
                </div>
              </button>
            ))
          )}
        </div>

        {isMaster && (
          <Button onClick={() => setShowCreate(true)} variant="outline" className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Nova Empresa
          </Button>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Nome da empresa"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
