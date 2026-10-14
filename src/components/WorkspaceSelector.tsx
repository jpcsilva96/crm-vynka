import { useState } from "react";
import { useWorkspaceStore, type Workspace } from "@/lib/workspaceStore";
import { useUsersStore } from "@/lib/usersStore";
import { useRolesStore } from "@/lib/rolesStore";
import { Building2, Plus, ChevronDown, Pencil, Trash2, Check, X, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  collapsed?: boolean;
  onLeaveWorkspace?: () => void;
}

export function WorkspaceSelector({ collapsed, onLeaveWorkspace }: Props) {
  const { workspaces, activeWorkspaceId, setActiveWorkspace, addWorkspace, updateWorkspace, deleteWorkspace } =
    useWorkspaceStore();
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  const userEmail = localStorage.getItem("variance_user_email");
  const { users } = useUsersStore();
  const { roles } = useRolesStore();
  
  const currentUser = users.find(u => u.email === userEmail);
  const currentUserRole = roles.find(r => r.id === currentUser?.roleId);
  const isMaster = !!currentUserRole?.isMaster;

  const allowedWorkspaces = isMaster 
    ? workspaces 
    : workspaces.filter(ws => currentUser?.workspaces.includes(ws.id));

  const [showManage, setShowManage] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const ws = await addWorkspace(newName.trim());
    if (ws) {
      setActiveWorkspace(ws.id);
      setNewName("");
      setShowCreate(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    await updateWorkspace(id, { name: editName.trim() });
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    deleteWorkspace(id);
  };

  const handleSwitchWorkspace = (wsId: string) => {
    setActiveWorkspace(wsId);
  };

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center justify-center w-full rounded-md bg-sidebar-accent py-2 hover:bg-sidebar-accent/80 transition-colors"
            title={activeWs?.name || "Workspace"}
          >
            <div
              className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold"
              style={{ backgroundColor: activeWs?.color || "#6366f1" }}
            >
              {activeWs ? activeWs.name.charAt(0).toUpperCase() : <Building2 className="h-3.5 w-3.5" />}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-56">
          {allowedWorkspaces.map((ws) => (
            <DropdownMenuItem key={ws.id} onClick={() => handleSwitchWorkspace(ws.id)} className="gap-2">
              <div
                className="h-5 w-5 rounded flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                style={{ backgroundColor: ws.color }}
              >
                {ws.name.charAt(0).toUpperCase()}
              </div>
              <span className="truncate text-xs">{ws.name}</span>
              {ws.id === activeWorkspaceId && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {onLeaveWorkspace && (
            <DropdownMenuItem onClick={onLeaveWorkspace} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="text-xs">Trocar workspace</span>
            </DropdownMenuItem>
          )}
          {isMaster && (
            <>
              <DropdownMenuItem onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="text-xs">Novo workspace</span>
              </DropdownMenuItem>
              {workspaces.length > 0 && (
                <DropdownMenuItem onClick={() => setShowManage(true)} className="gap-2">
                  <Pencil className="h-4 w-4" />
                  <span className="text-xs">Gerenciar</span>
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 w-full rounded-md bg-sidebar-accent px-2.5 py-2 hover:bg-sidebar-accent/80 transition-colors text-left">
            <div
              className="h-7 w-7 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: activeWs?.color || "#6366f1" }}
            >
              {activeWs ? activeWs.name.charAt(0).toUpperCase() : <Building2 className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-sidebar-foreground truncate">
                {activeWs?.name || "Selecionar workspace"}
              </p>
              <p className="text-[9px] text-muted-foreground">Workspace</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          {allowedWorkspaces.map((ws) => (
            <DropdownMenuItem key={ws.id} onClick={() => handleSwitchWorkspace(ws.id)} className="gap-2">
              <div
                className="h-5 w-5 rounded flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                style={{ backgroundColor: ws.color }}
              >
                {ws.name.charAt(0).toUpperCase()}
              </div>
              <span className="truncate text-xs">{ws.name}</span>
              {ws.id === activeWorkspaceId && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {onLeaveWorkspace && (
            <DropdownMenuItem onClick={onLeaveWorkspace} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="text-xs">Trocar workspace</span>
            </DropdownMenuItem>
          )}
          {isMaster && (
            <>
              <DropdownMenuItem onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="text-xs">Novo workspace</span>
              </DropdownMenuItem>
              {workspaces.length > 0 && (
                <DropdownMenuItem onClick={() => setShowManage(true)} className="gap-2">
                  <Pencil className="h-4 w-4" />
                  <span className="text-xs">Gerenciar workspaces</span>
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create workspace dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Nome do workspace"
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

      {/* Manage workspaces dialog */}
      <Dialog open={showManage} onOpenChange={setShowManage}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Workspaces</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
            {workspaces.map((ws) => (
              <div key={ws.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                <div
                  className="h-8 w-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: ws.color }}
                >
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                {editingId === ws.id ? (
                  <>
                    <Input
                      className="h-8 text-xs flex-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(ws.id)}
                      autoFocus
                    />
                    <button onClick={() => handleSaveEdit(ws.id)} className="p-1 text-primary hover:text-primary/80">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-medium flex-1 truncate">{ws.name}</span>
                    {ws.id === activeWorkspaceId && (
                      <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Ativo</span>
                    )}
                    <button
                      onClick={() => { setEditingId(ws.id); setEditName(ws.name); }}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(ws.id)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
