import { Shield } from "lucide-react";
import { VynkaLogo } from "@/components/VynkaLogo";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizationStore, type Organization } from "@/lib/organizationStore";

interface Props {
  userEmail: string;
  onSelect: (org: Organization) => void;
}

function OrganizationPickerSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-40 w-40 rounded-2xl" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-28" />
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 rounded-lg border border-border/60 px-4 py-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OrganizationPicker({ userEmail, onSelect }: Props) {
  const { organizations, isLoading: isLoadingOrgs, setActiveOrganization } = useOrganizationStore();

  const handleSelect = (org: Organization) => {
    setActiveOrganization(org.id);
    onSelect(org);
  };

  if (isLoadingOrgs) {
    return <OrganizationPickerSkeleton />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-3">
          <VynkaLogo className="text-[28px]" />
          <p className="text-sm text-muted-foreground">Selecione a organização</p>
          <p className="text-xs text-muted-foreground">{userEmail}</p>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          {organizations.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Shield className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">Nenhuma organização encontrada.</p>
              <p className="mt-1 text-xs">Peça ao administrador para liberar seu acesso.</p>
            </div>
          ) : (
            organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSelect(org)}
                className="flex w-full items-center gap-4 rounded-lg border border-transparent px-4 py-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/80 text-sm font-bold text-white">
                  {(org.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{org.name || "Sem Nome"}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
