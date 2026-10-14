import { lazy, Suspense, useState, useCallback, useEffect, useMemo } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { OrganizationPicker } from "@/components/OrganizationPicker";
import { WorkspacePicker } from "@/components/WorkspacePicker";
import Login from "@/pages/Login";
import type { CRMTab } from "@/pages/Pipeline";
import { toast } from "sonner";
import {
  LogOut,
  Settings as SettingsIcon,
  Shield,
  BarChart3,
  ChevronsUpDown,
  Moon,
  Users,
  Briefcase,
  ListTodo,
  ContactRound,
  Building2,
  UserCircle2,
  Bell,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { WorkspaceSelector } from "@/components/WorkspaceSelector";
import { useWorkspaceStore, type Workspace } from "@/lib/workspaceStore";
import varianceLogoDark from "@/assets/variance-logo-white.png";
import varianceLogoLight from "@/assets/variance-logo-light.png";
import { useDealsStore } from "@/lib/dealsStore";
import { useUsersStore } from "@/lib/usersStore";
import { useRolesStore } from "@/lib/rolesStore";
import { useOrganizationStore } from "@/lib/organizationStore";
import { useThemeStore } from "@/lib/themeStore";
import { useCRMContactsStore } from "@/lib/crmContactsStore";
import { usePipelineNavigationStore } from "@/lib/pipelineNavigationStore";
import { UserAvatar } from "@/components/pipeline/UserAvatar";
import { AlertsDrawer } from "@/components/alerts/AlertsDrawer";
import { getScopedAlertList, getUnreadAlertCount, useAlertsStore, type AppAlert } from "@/lib/alertsStore";
import { canAccessMenu, canManageSettings, canManageUsers } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";

const Settings = lazy(() => import("@/pages/Settings"));
const Pipeline = lazy(() => import("@/pages/Pipeline"));
const Profile = lazy(() => import("@/pages/Profile"));
const UsersManagement = lazy(() => import("@/pages/UsersManagement"));
const Alerts = lazy(() => import("@/pages/Alerts"));
const Trash = lazy(() => import("@/pages/Trash"));
const OrganizationsManagement = lazy(() =>
  import("@/pages/OrganizationsManagement").then((module) => ({ default: module.OrganizationsManagement })),
);
const PipelineDashboard = lazy(() =>
  import("@/components/pipeline/PipelineDashboard").then((module) => ({ default: module.PipelineDashboard })),
);

function RouteLoading() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-background p-6 text-sm text-muted-foreground">
      Carregando...
    </div>
  );
}

type Page = "profile" | "settings" | "pipeline" | "pipelineDashboard" | "users" | "organizations" | "alerts" | "trash";

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem("variance_user_email"));
  const { workspaces, activeWorkspaceId, setActiveWorkspace, fetchWorkspaces } = useWorkspaceStore();
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const [workspaceReady, setWorkspaceReady] = useState(() => !!localStorage.getItem("variance_active_ws"));
  const [organizationReady, setOrganizationReady] = useState(() => !!localStorage.getItem("variance_active_org"));

  const { users, fetchUsers, isLoading: isUsersLoading } = useUsersStore();
  const { roles, fetchRoles, isLoading: isRolesLoading } = useRolesStore();
  const { theme, toggleTheme } = useThemeStore();
  const { organizations, fetchOrganizations, activeOrganizationId, setActiveOrganization, isLoading: isOrgLoading } =
    useOrganizationStore();
  const alerts = useAlertsStore((state) => state.alerts);
  const alertsDrawerOpen = useAlertsStore((state) => state.drawerOpen);
  const setAlertsDrawerOpen = useAlertsStore((state) => state.setDrawerOpen);
  const syncRemoteAlerts = useAlertsStore((state) => state.syncRemoteAlerts);
  const markAlertAsRead = useAlertsStore((state) => state.markAsRead);
  const markAllAlertsAsRead = useAlertsStore((state) => state.markAllAsRead);
  const clearReadAlerts = useAlertsStore((state) => state.clearRead);

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem("variance_user_email");
    setUserEmail(null);
    setOrganizationReady(false);
    setWorkspaceReady(false);
    setActiveOrganization(null);
    setActiveWorkspace(null);
  }, [setActiveOrganization, setActiveWorkspace]);

  useEffect(() => {
    if (!userEmail) return;

    let cancelled = false;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      const authenticatedEmail = data.user?.email?.toLowerCase() || null;
      if (error || !authenticatedEmail || authenticatedEmail !== userEmail.toLowerCase()) {
        clearLocalSession();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [clearLocalSession, userEmail]);

  useEffect(() => {
    if (userEmail) {
      fetchRoles();
      fetchOrganizations();
    }
  }, [userEmail, fetchRoles, fetchOrganizations]);

  useEffect(() => {
    if (userEmail && !isOrgLoading) {
      fetchUsers();
      fetchWorkspaces();
    }
  }, [userEmail, activeOrganizationId, isOrgLoading, fetchUsers, fetchWorkspaces]);

  const currentUser = userEmail ? users.find((u) => u.email.toLowerCase() === userEmail.toLowerCase()) : undefined;
  const currentUserRole = roles.find((r) => r.id === currentUser?.roleId);
  const isMaster = !!currentUserRole?.isMaster;

  useEffect(() => {
    if (!currentUser || !currentUserRole || isMaster || !currentUser.organizationId) return;

    if (activeOrganizationId !== currentUser.organizationId) {
      setActiveOrganization(currentUser.organizationId);
      setActiveWorkspace(null);
      setWorkspaceReady(false);
    }

    setOrganizationReady(true);
  }, [currentUser, currentUserRole, isMaster, activeOrganizationId, setActiveOrganization, setActiveWorkspace]);

  useEffect(() => {
    if (isMaster && organizations.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      organizations.forEach((org) => {
        if (org.subscriptionStatus === "Ativa" && org.nextDueDate) {
          const dueDate = new Date(org.nextDueDate + "T00:00:00");
          if (dueDate < today) {
            useOrganizationStore
              .getState()
              .updateOrganization(org.id, { subscriptionStatus: "Em atraso" })
              .then(() => {
                toast.warning(
                  `Assinatura em atraso: A organização "${org.name}" passou do vencimento e foi alterada para "Em atraso".`,
                  { duration: 10000 },
                );
              });
          }
        }
      });
    }
  }, [isMaster, organizations]);

  const handleLogin = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    localStorage.setItem("variance_user_email", normalizedEmail);
    setUserEmail(normalizedEmail);
    setOrganizationReady(false);
    setWorkspaceReady(false);
    setActiveOrganization(null);
    setActiveWorkspace(null);
  };

  const handleLogout = () => {
    void supabase.auth.signOut();
    clearLocalSession();
  };

  const handleUserEmailChange = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    localStorage.setItem("variance_user_email", normalizedEmail);
    setUserEmail(normalizedEmail);
  };

  const handleOrganizationSelected = useCallback(() => {
    setOrganizationReady(true);
  }, []);

  const { fetchContacts: fetchCRMContacts } = useCRMContactsStore();
  const { deals, fetchDeals } = useDealsStore();
  useEffect(() => {
    if (workspaceReady && activeWorkspaceId) {
      fetchCRMContacts(activeWorkspaceId);
      fetchDeals(activeWorkspaceId);
    }
  }, [workspaceReady, activeWorkspaceId, fetchCRMContacts, fetchDeals]);

  const handleWorkspaceSelected = useCallback((_ws: Workspace) => {
    setWorkspaceReady(true);
  }, []);

  const { showCreateDeal, openDealId } = usePipelineNavigationStore();

  useEffect(() => {
    if (showCreateDeal || openDealId) {
      navigate(openDealId ? `/pipeline/${openDealId}` : "/pipeline");
    }
  }, [showCreateDeal, openDealId, navigate]);

  const handleLeaveWorkspace = useCallback(() => {
    setWorkspaceReady(false);
    setActiveWorkspace(null);
  }, [setActiveWorkspace]);

  const activeOrg = organizations.find((o) => o.id === activeOrganizationId);
  const isBlockedOrg = activeOrg && ["Bloqueada", "Cancelada"].includes(activeOrg.subscriptionStatus || "");

  const canOpenPipeline = canAccessMenu(currentUserRole, "pipeline");
  const canOpenSettings = canManageSettings(currentUserRole);
  const canOpenUsers = canManageUsers(currentUserRole);
  const pathname = location.pathname;
  const activeCRMTab: CRMTab =
    pathname.startsWith("/tasks") ? "Tarefas" :
    pathname.startsWith("/contacts") ? "Contatos" :
    pathname.startsWith("/companies") ? "Empresas" :
    "Negociações";
  const page: Page =
    pathname.startsWith("/profile") ? "profile" :
    pathname.startsWith("/settings") ? "settings" :
    pathname.startsWith("/users") ? "users" :
    pathname.startsWith("/organizations") ? "organizations" :
    pathname.startsWith("/alerts") ? "alerts" :
    pathname.startsWith("/trash") ? "trash" :
    pathname.startsWith("/dashboard") ? "pipelineDashboard" :
    "pipeline";

  const scopedAlerts = useMemo(
    () => activeWorkspaceId && userEmail ? getScopedAlertList(alerts, activeWorkspaceId, userEmail) : [],
    [activeWorkspaceId, alerts, userEmail],
  );
  const allScopedAlerts = useMemo(
    () => activeWorkspaceId && userEmail ? getScopedAlertList(alerts, activeWorkspaceId, userEmail, true) : [],
    [activeWorkspaceId, alerts, userEmail],
  );
  const unreadAlertsCount = useMemo(
    () => activeWorkspaceId && userEmail ? getUnreadAlertCount(alerts, activeWorkspaceId, userEmail) : 0,
    [activeWorkspaceId, alerts, userEmail],
  );

  useEffect(() => {
    if (!activeWorkspaceId || !userEmail || !workspaceReady) return;

    void syncRemoteAlerts({ workspaceId: activeWorkspaceId, userEmail });
    const intervalId = window.setInterval(() => {
      void syncRemoteAlerts({ workspaceId: activeWorkspaceId, userEmail });
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeWorkspaceId, syncRemoteAlerts, userEmail, workspaceReady]);

  const handleAlertNavigation = useCallback((alert: AppAlert) => {
    markAlertAsRead(alert.id);
    setAlertsDrawerOpen(false);

    // Só existe um destino desde 10/09: a negociação onde a menção foi escrita.
    if (alert.targetId) {
      navigate(`/pipeline/${alert.targetId}`);
      return;
    }

    navigate("/");
  }, [markAlertAsRead, navigate, setAlertsDrawerOpen]);

  const handleViewAlertsHistory = useCallback(() => {
    setAlertsDrawerOpen(false);
    navigate("/alerts");
  }, [navigate, setAlertsDrawerOpen]);

  if (!userEmail) {
    return <Login onLogin={handleLogin} />;
  }

  const isUserContextLoading = isOrgLoading || isUsersLoading || isRolesLoading || !currentUser || !currentUserRole;

  if (!organizationReady || !activeOrganizationId) {
    if (isUserContextLoading) {
      return (
        <div className="h-screen bg-background">
          <RouteLoading />
        </div>
      );
    }

    if (!isMaster) {
      if (currentUser?.organizationId) {
        return (
          <div className="h-screen bg-background">
            <RouteLoading />
          </div>
        );
      }

      return (
        <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
          <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <Shield className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h2 className="mb-2 text-2xl font-bold">Acesso não configurado</h2>
            <p className="mb-6 text-muted-foreground">
              Seu usuário não está vinculado a uma organização. Peça ao administrador para revisar seu cadastro.
            </p>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              Sair
            </Button>
          </div>
        </div>
      );
    }

    return <OrganizationPicker userEmail={userEmail} onSelect={handleOrganizationSelected} />;
  }

  if (!workspaceReady || !activeWs) {
    return <WorkspacePicker userEmail={userEmail} onSelect={handleWorkspaceSelected} />;
  }

  if (isBlockedOrg && !isMaster) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <Shield className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h2 className="mb-2 text-2xl font-bold">Acesso Bloqueado</h2>
          <p className="mb-6 text-muted-foreground">
            O acesso a esta organização está suspenso. Por favor, entre em contato com o administrador para regularizar a assinatura.
          </p>
          <Button onClick={handleLogout} variant="outline" className="w-full">
            Sair
          </Button>
        </div>
      </div>
    );
  }


  const isSettingsPage = page === "settings";
  const isHeaderMenuPage = page === "profile" || page === "organizations" || page === "users" || page === "trash" || isSettingsPage;
  const openCRMModule = (tab: CRMTab) => {
    const pathByTab: Record<CRMTab, string> = {
      "Negociações": "/pipeline",
      "Tarefas": "/tasks",
      "Contatos": "/contacts",
      "Empresas": "/companies",
    };
    navigate(pathByTab[tab]);
  };
  const navButtonClass = (active: boolean) =>
    `inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors ${
      active ? "bg-primary text-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"
    }`;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-chat-bg">
      <header className="border-b border-border bg-sidebar-background/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar-background/90">
        <div
          className="flex items-center justify-between gap-6 px-4 lg:px-6"
          style={{ height: 80, maxHeight: 80 }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-6">
            <div
              className="flex shrink-0 items-center justify-start overflow-hidden"
              style={{ width: 190, height: 80 }}
            >
              <img
                src={theme === "light" ? varianceLogoLight : varianceLogoDark}
                alt="Variance"
                className={`block shrink-0 object-contain ${theme === "light" ? "mix-blend-multiply" : ""}`}
                style={{ width: 180, height: "auto", maxWidth: "none" }}
              />
            </div>

            <div className="min-w-0 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 pr-2">
                <div className="min-w-[220px] max-w-[280px] shrink-0">
                  <WorkspaceSelector onLeaveWorkspace={handleLeaveWorkspace} />
                </div>

                {canOpenPipeline && (
                  <>
                    <button onClick={() => navigate("/dashboard")} className={navButtonClass(page === "pipelineDashboard")}>
                      <BarChart3 className="h-4 w-4 shrink-0" />
                      <span>Dashboard</span>
                    </button>

                    <button
                      onClick={() => openCRMModule("Negociações")}
                      className={navButtonClass(page === "pipeline" && activeCRMTab === "Negociações")}
                    >
                      <Briefcase className="h-4 w-4 shrink-0" />
                      <span>Negociações</span>
                    </button>

                    <button
                      onClick={() => openCRMModule("Tarefas")}
                      className={navButtonClass(page === "pipeline" && activeCRMTab === "Tarefas")}
                    >
                      <ListTodo className="h-4 w-4 shrink-0" />
                      <span>Tarefas</span>
                    </button>

                    <button
                      onClick={() => openCRMModule("Contatos")}
                      className={navButtonClass(page === "pipeline" && activeCRMTab === "Contatos")}
                    >
                      <ContactRound className="h-4 w-4 shrink-0" />
                      <span>Contatos</span>
                    </button>

                    <button
                      onClick={() => openCRMModule("Empresas")}
                      className={navButtonClass(page === "pipeline" && activeCRMTab === "Empresas")}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span>Empresas</span>
                    </button>
                  </>
                )}

              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              aria-label="Abrir central de alertas"
              onClick={() => setAlertsDrawerOpen(true)}
              className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-sidebar-accent/50 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Bell className="h-5 w-5" />
              {unreadAlertsCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                  {unreadAlertsCount > 99 ? "99+" : unreadAlertsCount}
                </span>
              ) : null}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Abrir menu do perfil"
                  className={`flex h-11 w-11 items-center justify-center rounded-lg border outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    isHeaderMenuPage
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-sidebar-accent/50"
                  }`}
                >
                  <UserAvatar name={currentUser?.name || "Usuario"} avatar={currentUser?.avatar} size="md" className="h-8 w-8" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-[min(20rem,calc(100vw-1rem))] border-border bg-popover p-0 text-popover-foreground shadow-xl"
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                    {currentUser?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-popover-foreground">{currentUser?.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{currentUser?.email}</span>
                  </div>
                </div>

                <DropdownMenuSeparator className="m-0 bg-border" />

                <div className="p-2">
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      toggleTheme();
                    }}
                    className="h-11 cursor-pointer gap-3 rounded-md px-3 focus:bg-accent focus:text-accent-foreground"
                  >
                    <Moon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">Tema escuro</span>
                    <Switch
                      checked={theme === "dark"}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="pointer-events-none data-[state=checked]:bg-primary"
                    />
                  </DropdownMenuItem>
                </div>

                {(isMaster || canOpenSettings || canOpenUsers) && <DropdownMenuSeparator className="m-0 bg-border" />}

                <div className="p-2">
                  <DropdownMenuItem
                    onClick={() => navigate("/profile")}
                    className="h-11 cursor-pointer gap-3 rounded-md px-3 focus:bg-accent focus:text-accent-foreground"
                  >
                    <UserCircle2 className="h-4 w-4 shrink-0" />
                    <span>Perfil</span>
                  </DropdownMenuItem>

                  {isMaster && (
                    <DropdownMenuItem
                      onClick={() => navigate("/organizations")}
                      className="h-11 cursor-pointer gap-3 rounded-md px-3 focus:bg-accent focus:text-accent-foreground"
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span>Organizações</span>
                    </DropdownMenuItem>
                  )}

                  {canOpenUsers && (
                    <DropdownMenuItem
                      onClick={() => navigate("/users")}
                      className="h-11 cursor-pointer gap-3 rounded-md px-3 focus:bg-accent focus:text-accent-foreground"
                    >
                      <Users className="h-4 w-4 shrink-0" />
                      <span>Usuários e Acessos</span>
                    </DropdownMenuItem>
                  )}

                  {canOpenSettings && (
                    <DropdownMenuItem
                      onClick={() => navigate("/settings")}
                      className="h-11 cursor-pointer gap-3 rounded-md px-3 focus:bg-accent focus:text-accent-foreground"
                    >
                      <SettingsIcon className="h-4 w-4 shrink-0" />
                      <span>Configurações</span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={() => navigate("/trash")}
                    className="h-11 cursor-pointer gap-3 rounded-md px-3 focus:bg-accent focus:text-accent-foreground"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span>Lixeira</span>
                  </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator className="m-0 bg-border" />

                <div className="p-2">
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="h-11 cursor-pointer gap-3 rounded-md px-3 focus:bg-accent focus:text-accent-foreground"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<Navigate to={canOpenPipeline ? "/pipeline" : "/profile"} replace />} />
          <Route path="/profile" element={<Profile userEmail={userEmail} onUserEmailChange={handleUserEmailChange} />} />
          <Route path="/settings/*" element={<Settings userEmail={userEmail} />} />
          <Route path="/users" element={<UsersManagement />} />
          <Route path="/organizations" element={<OrganizationsManagement />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="/dashboard" element={<PipelineDashboard />} />
          <Route
            path="/alerts"
            element={
              <Alerts
                alerts={allScopedAlerts}
                onAlertClick={handleAlertNavigation}
                onMarkAllRead={() => activeWorkspaceId && userEmail && markAllAlertsAsRead(activeWorkspaceId, userEmail)}
                onClearRead={() => activeWorkspaceId && userEmail && clearReadAlerts(activeWorkspaceId, userEmail)}
              />
            }
          />
          <Route path="/pipeline" element={<Pipeline userEmail={userEmail} activeTab="Negociações" />} />
          <Route path="/pipeline/:dealId" element={<Pipeline userEmail={userEmail} activeTab="Negociações" />} />
          <Route path="/tasks" element={<Pipeline userEmail={userEmail} activeTab="Tarefas" />} />
          {/* A negociação aberta pela Tarefas mora numa rota da PRÓPRIA aba, como já acontece em
              /contacts/:contactId e /companies/:companyId. Se ela abrisse em /pipeline/:dealId, a
              aba viraria Negociações: a lista de tarefas desmontaria e o fechar cairia no Kanban. */}
          <Route path="/tasks/:dealId" element={<Pipeline userEmail={userEmail} activeTab="Tarefas" />} />
          <Route path="/contacts" element={<Pipeline userEmail={userEmail} activeTab="Contatos" />} />
          <Route path="/contacts/:contactId" element={<Pipeline userEmail={userEmail} activeTab="Contatos" />} />
          <Route path="/companies" element={<Pipeline userEmail={userEmail} activeTab="Empresas" />} />
          <Route path="/companies/:companyId" element={<Pipeline userEmail={userEmail} activeTab="Empresas" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>

      <AlertsDrawer
        open={alertsDrawerOpen}
        alerts={scopedAlerts}
        onOpenChange={setAlertsDrawerOpen}
        onAlertClick={handleAlertNavigation}
        onMarkAllRead={() => activeWorkspaceId && userEmail && markAllAlertsAsRead(activeWorkspaceId, userEmail)}
        onClearRead={() => activeWorkspaceId && userEmail && clearReadAlerts(activeWorkspaceId, userEmail)}
        onViewHistory={handleViewAlertsHistory}
      />
    </div>
  );
};

export default Index;
