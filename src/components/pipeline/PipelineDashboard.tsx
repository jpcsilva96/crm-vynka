import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  LineChart as LineChartIcon,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setWorkspaceHeader } from "@/integrations/supabase/client";
import { type Deal, useDealsStore } from "@/lib/dealsStore";
import { useUsersStore } from "@/lib/usersStore";
import { useRolesStore } from "@/lib/rolesStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { usePipelineStagesStore } from "@/lib/pipelineStagesStore";
import { useCRMPipelinesStore } from "@/lib/crmPipelinesStore";
import { canViewDeal, isOwnVisibility } from "@/lib/permissions";
import { DashboardRuleInfo } from "@/components/pipeline/DashboardRuleInfo";
import type { DashboardRuleId } from "@/lib/dashboardRules";
import { buildStageCatalog, buildStageRows, resolveDealProbability } from "@/lib/dashboardStages";
import { cn, getDueDateTime, parseLocalDateValue } from "@/lib/utils";

type PeriodPreset = "today" | "7d" | "30d" | "90d" | "custom";
type RankingSort = "wonValue" | "conversion" | "averageTicket" | "wonCount" | "pipelineValue";

interface DashboardFilters {
  period: PeriodPreset;
  startDate: string;
  endDate: string;
  ownerId: string;
  pipelineId: string;
}

interface OwnerRankingRow {
  id: string;
  name: string;
  wonCount: number;
  totalDeals: number;
  conversion: number;
  wonValue: number;
  totalValue: number;
  averageTicket: number;
  pipelineValue: number;
}

const STALE_DAYS = 7;
const STAGE_STALE_DAYS = 14;
const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const toDateInput = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized.toISOString().slice(0, 10);
};

const getRange = (filters: DashboardFilters) => {
  const now = new Date();
  if (filters.period === "custom") {
    return {
      start: filters.startDate ? startOfDay(new Date(`${filters.startDate}T00:00:00`)) : startOfDay(now),
      end: filters.endDate ? endOfDay(new Date(`${filters.endDate}T00:00:00`)) : endOfDay(now),
    };
  }

  const daysByPreset: Record<Exclude<PeriodPreset, "custom">, number> = {
    today: 1,
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };
  const days = daysByPreset[filters.period];
  const start = startOfDay(now);
  start.setDate(start.getDate() - (days - 1));
  return { start, end: endOfDay(now) };
};

const getPreviousRange = (start: Date, end: Date) => {
  const rangeMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - rangeMs);
  return { start: previousStart, end: previousEnd };
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const date = parseLocalDateValue(value) || new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isWon = (deal: Deal) => deal.outcome === "won" || deal.stage === "won";
const isLost = (deal: Deal) => deal.outcome === "lost" || deal.stage === "lost";
const isActive = (deal: Deal) => !isWon(deal) && !isLost(deal);
const sumValue = (deals: Deal[]) => deals.reduce((acc, deal) => acc + (deal.value || 0), 0);
const getConversionRate = (won: number, total: number) => (total > 0 ? (won / total) * 100 : 0);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value || 0);

const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value || 0);
const formatPercent = (value: number) => `${(value || 0).toFixed(1).replace(".", ",")}%`;

const daysBetween = (from?: string, to?: string) => {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getDealActivityDate = (deal: Deal) =>
  parseDate(deal.updatedAt) || parseDate(deal.createdAt) || new Date(0);

const getDealForecastDate = (deal: Deal) => {
  if (isActive(deal)) return parseDate(deal.closingDate) || parseDate(deal.createdAt);
  return parseDate(deal.updatedAt) || parseDate(deal.createdAt);
};

const getProjectedClosingDate = (deal: Deal, averageClosingTime: number) => {
  const explicitClosingDate = parseDate(deal.closingDate);
  if (explicitClosingDate) return explicitClosingDate;

  const createdAt = parseDate(deal.createdAt);
  if (!createdAt || averageClosingTime <= 0) return null;

  return addDays(createdAt, Math.max(1, Math.round(averageClosingTime)));
};

const resolveResponsible = (deal: Deal, users: { id: string; name?: string; email?: string }[]) => {
  if (!deal.assignedTo) return null;
  const normalizedAssigned = String(deal.assignedTo).trim();
  return (
    users.find((user) => user.id === normalizedAssigned) ||
    users.find((user) => user.email === normalizedAssigned) ||
    users.find((user) => user.name === normalizedAssigned) ||
    null
  );
};

function KpiCard({
  title,
  value,
  helper,
  icon: Icon,
  ruleId,
  tone = "default",
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  ruleId: DashboardRuleId;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const toneClass = {
    default: "bg-blue-500/10 text-blue-600",
    success: "bg-emerald-500/10 text-emerald-600",
    danger: "bg-rose-500/10 text-rose-600",
    warning: "bg-amber-500/10 text-amber-600",
  }[tone];

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
          <DashboardRuleInfo ruleId={ruleId} />
        </div>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", toneClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-normal">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function CombinedKpiCard({
  title,
  value,
  helper,
  secondary,
  icon: Icon,
  ruleId,
  tone = "default",
}: {
  title: string;
  value: string;
  helper: string;
  secondary: string;
  icon: React.ComponentType<{ className?: string }>;
  ruleId: DashboardRuleId;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const toneClass = {
    default: "bg-blue-500/10 text-blue-600",
    success: "bg-emerald-500/10 text-emerald-600",
    danger: "bg-rose-500/10 text-rose-600",
    warning: "bg-amber-500/10 text-amber-600",
  }[tone];

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
          <DashboardRuleInfo ruleId={ruleId} />
        </div>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", toneClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-normal">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        <p className="mt-2 text-[11px] text-muted-foreground/80">{secondary}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  helper,
  ruleId,
  children,
}: {
  title: string;
  helper: string;
  ruleId: DashboardRuleId;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <DashboardRuleInfo ruleId={ruleId} />
        </div>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">{children}</div>
      </CardContent>
    </Card>
  );
}

function PipelineDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 9 }).map((_, index) => (
            <Card key={index} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-3 w-40" />
                {index === 0 && <Skeleton className="h-3 w-32" />}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="shadow-sm">
            <CardHeader className="space-y-2 pb-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[280px] w-full rounded-xl" />
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="shadow-sm">
        <CardHeader className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-60" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid grid-cols-8 gap-4">
              {Array.from({ length: 8 }).map((__, cellIndex) => (
                <Skeleton key={cellIndex} className="h-4 w-full" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function PipelineDashboard() {
  const { deals, fetchDeals, isLoading } = useDealsStore();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const fetchStages = usePipelineStagesStore((state) => state.fetchStages);
  const { fetchPipelines, getPipelines } = useCRMPipelinesStore();
  const users = useUsersStore((state) => state.users);
  const roles = useRolesStore((state) => state.roles);
  const userEmail = localStorage.getItem("vynka_user_email");
  const currentUser = users.find((user) => user.email === userEmail);
  const currentUserRole = roles.find((role) => role.id === currentUser?.roleId);
  const onlyOwnRecords = isOwnVisibility(currentUserRole);
  const [rankingSort, setRankingSort] = useState<RankingSort>("wonValue");

  const defaultStart = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return toDateInput(date);
  }, []);

  const [filters, setFilters] = useState<DashboardFilters>({
    period: "30d",
    startDate: defaultStart,
    endDate: toDateInput(new Date()),
    ownerId: "all",
    pipelineId: "all",
  });
  const workspacePipelines = getPipelines(activeWorkspaceId).filter((pipeline) => pipeline.isActive);
  const selectedPipeline = workspacePipelines.find((pipeline) => pipeline.id === filters.pipelineId) || null;
  const stagesByPipeline = usePipelineStagesStore((state) => state.stagesByPipeline);
  // Com "Todos os Pipelines" a tela abrange vários funis: a probabilidade de cada negociação tem
  // de vir do pipeline DELA, então carregamos as etapas de todos, não só as do selecionado.
  const visiblePipelines = useMemo(
    () => (selectedPipeline ? [selectedPipeline] : workspacePipelines),
    [selectedPipeline, workspacePipelines],
  );
  const pipelineIdsKey = workspacePipelines.map((pipeline) => pipeline.id).join(",");

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setWorkspaceHeader(activeWorkspaceId);
    fetchDeals(activeWorkspaceId);
    fetchPipelines(activeWorkspaceId);
  }, [activeWorkspaceId, fetchDeals, fetchPipelines]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    for (const pipeline of workspacePipelines) {
      fetchStages(pipeline.id, activeWorkspaceId, pipeline.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId, fetchStages, pipelineIdsKey]);

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null;
  const { start, end } = useMemo(() => getRange(filters), [filters]);
  const previousRange = useMemo(() => getPreviousRange(start, end), [start, end]);

  const organizationUsers = useMemo(() => onlyOwnRecords && currentUser ? [currentUser] : users, [currentUser, onlyOwnRecords, users]);

  const baseDeals = useMemo(
    () =>
      deals.filter(
        (deal) =>
          (!activeWorkspaceId || deal.workspaceId === activeWorkspaceId) &&
          (filters.pipelineId === "all" || deal.pipelineId === filters.pipelineId) &&
          canViewDeal(currentUserRole, currentUser, deal),
      ),
    [activeWorkspaceId, currentUser, currentUserRole, deals, filters.pipelineId],
  );

  const filteredDeals = useMemo(() => {
    return baseDeals.filter((deal) => {
      const dealDate = getDealForecastDate(deal);
      if (!dealDate || dealDate < start || dealDate > end) return false;
      const responsible = resolveResponsible(deal, users);
      if (filters.ownerId === "unassigned" && responsible) return false;
      if (filters.ownerId !== "all" && filters.ownerId !== "unassigned" && responsible?.id !== filters.ownerId) return false;
      return true;
    });
  }, [baseDeals, end, filters.ownerId, start, users]);

  const previousDeals = useMemo(() => {
    return baseDeals.filter((deal) => {
      const dealDate = getDealForecastDate(deal);
      if (!dealDate || dealDate < previousRange.start || dealDate > previousRange.end) return false;
      const responsible = resolveResponsible(deal, users);
      if (filters.ownerId === "unassigned" && responsible) return false;
      if (filters.ownerId !== "all" && filters.ownerId !== "unassigned" && responsible?.id !== filters.ownerId) return false;
      return true;
    });
  }, [baseDeals, filters.ownerId, previousRange.end, previousRange.start, users]);

  const metrics = useMemo(() => {
    const activeDeals = filteredDeals.filter(isActive);
    const wonDeals = filteredDeals.filter(isWon);
    const lostDeals = filteredDeals.filter(isLost);
    const totalValue = sumValue(filteredDeals);
    const conversion = getConversionRate(wonDeals.length, filteredDeals.length);
    const valueConversion = getConversionRate(sumValue(wonDeals), totalValue);
    const averageTicket = wonDeals.length > 0 ? sumValue(wonDeals) / wonDeals.length : 0;
    const closingTimes = wonDeals
      .map((deal) => daysBetween(deal.createdAt, deal.updatedAt || deal.closingDate || deal.createdAt))
      .filter((value): value is number => value !== null);
    const averageClosingTime = closingTimes.length > 0 ? closingTimes.reduce((acc, value) => acc + value, 0) / closingTimes.length : 0;
    const projectedRevenueDeals = activeDeals.filter((deal) => {
      const projectedClosingDate = getProjectedClosingDate(deal, averageClosingTime);
      return !!projectedClosingDate && projectedClosingDate >= start && projectedClosingDate <= end;
    });
    const forecastRevenue = projectedRevenueDeals.reduce(
      (acc, deal) => acc + (deal.value || 0) * (resolveDealProbability(deal, stagesByPipeline) / 100),
      0,
    );

    return {
      activeDeals,
      wonDeals,
      lostDeals,
      totalDeals: filteredDeals.length,
      totalValue,
      activeValue: sumValue(activeDeals),
      wonValue: sumValue(wonDeals),
      lostValue: sumValue(lostDeals),
      conversion,
      valueConversion,
      averageTicket,
      averageClosingTime,
      forecastRevenue,
      projectedRevenueDeals,
    };
  }, [end, filteredDeals, stagesByPipeline, start]);

  const previousConversion = useMemo(() => {
    const wonDeals = previousDeals.filter(isWon);
    return getConversionRate(wonDeals.length, previousDeals.length);
  }, [previousDeals]);

  // Etapa só significa alguma coisa dentro do funil dela: "leads" é "Novos Leads" no Comercial e
  // "Opt-in" na Nutrição. Sem um pipeline escolhido, o gráfico não é desenhado (decisão de 15/09).
  const stageData = useMemo(
    () => (selectedPipeline ? buildStageRows(filteredDeals, [selectedPipeline], stagesByPipeline) : []),
    [filteredDeals, selectedPipeline, stagesByPipeline],
  );

  const evolutionData = useMemo(() => {
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
    const bucketCount = days <= 31 ? days : Math.min(12, Math.ceil(days / 7));
    const bucketSize = Math.ceil(days / bucketCount);

    return Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = new Date(start);
      bucketStart.setDate(bucketStart.getDate() + index * bucketSize);
      const bucketEnd = endOfDay(new Date(bucketStart));
      bucketEnd.setDate(bucketEnd.getDate() + bucketSize - 1);
      const label = bucketStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

      return {
        label,
        created: filteredDeals.filter((deal) => {
          const createdAt = parseDate(deal.createdAt);
          return createdAt && createdAt >= bucketStart && createdAt <= bucketEnd;
        }).length,
        won: filteredDeals.filter((deal) => {
          const closedAt = parseDate(deal.updatedAt || deal.createdAt);
          return isWon(deal) && closedAt && closedAt >= bucketStart && closedAt <= bucketEnd;
        }).length,
        lost: filteredDeals.filter((deal) => {
          const closedAt = parseDate(deal.updatedAt || deal.createdAt);
          return isLost(deal) && closedAt && closedAt >= bucketStart && closedAt <= bucketEnd;
        }).length,
      };
    });
  }, [end, filteredDeals, start]);

  const outcomeData = useMemo(
    () => [
      { name: "Ganhos", value: metrics.wonDeals.length, color: "#10b981" },
      { name: "Perdidos", value: metrics.lostDeals.length, color: "#ef4444" },
      { name: "Em andamento", value: metrics.activeDeals.length, color: "#2563eb" },
    ],
    [metrics.activeDeals.length, metrics.lostDeals.length, metrics.wonDeals.length],
  );

  const lossReasonsData = useMemo(() => {
    const reasons = new Map<string, number>();
    metrics.lostDeals.forEach((deal) => {
      const reason = deal.lossReason || "Outros";
      reasons.set(reason, (reasons.get(reason) || 0) + 1);
    });
    return Array.from(reasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [metrics.lostDeals]);

  const ownerRanking = useMemo<OwnerRankingRow[]>(() => {
    const rows = organizationUsers
      .map((user) => {
        const ownerDeals = filteredDeals.filter((deal) => resolveResponsible(deal, users)?.id === user.id);
        const wonDeals = ownerDeals.filter(isWon);
        const openDeals = ownerDeals.filter(isActive);
        const wonValue = sumValue(wonDeals);
        const totalValue = sumValue(ownerDeals);
        return {
          id: user.id,
          name: user.name || user.email,
          wonCount: wonDeals.length,
          totalDeals: ownerDeals.length,
          wonValue,
          totalValue,
          conversion: getConversionRate(wonValue, totalValue),
          averageTicket: wonDeals.length > 0 ? wonValue / wonDeals.length : 0,
          pipelineValue: sumValue(openDeals),
        };
      })
      .filter((row) => row.totalDeals > 0);

    const sorters: Record<RankingSort, (a: OwnerRankingRow, b: OwnerRankingRow) => number> = {
      wonValue: (a, b) => b.wonValue - a.wonValue,
      conversion: (a, b) => b.conversion - a.conversion,
      averageTicket: (a, b) => b.averageTicket - a.averageTicket,
      wonCount: (a, b) => b.wonCount - a.wonCount,
      pipelineValue: (a, b) => b.pipelineValue - a.pipelineValue,
    };

    return rows.sort(sorters[rankingSort]).slice(0, 8);
  }, [filteredDeals, organizationUsers, rankingSort, users]);

  const operational = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = startOfDay(new Date());
    tomorrow.setDate(tomorrow.getDate() + 1);
    const staleLimit = new Date();
    staleLimit.setDate(staleLimit.getDate() - STALE_DAYS);
    const stageStaleLimit = new Date();
    stageStaleLimit.setDate(stageStaleLimit.getDate() - STAGE_STALE_DAYS);

    const allTasks = filteredDeals.flatMap((deal) => (deal.tasks || []).map((task) => ({ ...task, deal })));
    return {
      staleDeals: metrics.activeDeals.filter((deal) => getDealActivityDate(deal) < staleLimit),
      overdueTasks: allTasks.filter((item) => {
        if ((item.status || (item.completed ? "completed" : "pending")) !== "pending") return false;
        const due = getDueDateTime(item.dueDate, item.dueTime);
        return !!due && due < today;
      }),
      todayTasks: allTasks.filter((item) => {
        if (!item.dueDate || (item.status || (item.completed ? "completed" : "pending")) !== "pending") return false;
        const due = getDueDateTime(item.dueDate, item.dueTime);
        if (!due) return false;
        return due >= today && due < tomorrow;
      }),
      overdueClosingDeals: metrics.activeDeals.filter((deal) => {
        const closingDate = parseDate(deal.closingDate);
        return !!closingDate && closingDate < today;
      }),
      unassignedDeals: metrics.activeDeals.filter((deal) => !resolveResponsible(deal, users)),
      stalledStageDeals: metrics.activeDeals.filter((deal) => (parseDate(deal.updatedAt || deal.createdAt) || new Date()) < stageStaleLimit),
    };
  }, [filteredDeals, metrics.activeDeals, users]);

  const insights = useMemo(() => {
    const items: { title: string; description: string; tone: "success" | "warning" | "danger" | "default" }[] = [];
    const delta = metrics.conversion - previousConversion;
    if (Math.abs(delta) >= 1) {
      items.push({
        title: delta > 0 ? "Conversão em alta" : "Conversão em queda",
        description: `Variação de ${formatPercent(Math.abs(delta))} em relação ao período anterior.`,
        tone: delta > 0 ? "success" : "danger",
      });
    }

    const stageCatalog = buildStageCatalog(visiblePipelines, stagesByPipeline);
    const highestLossStage = [
      ...stageCatalog.map((stage) => ({
        stage: stage.label,
        // mesmo identificador em pipelines diferentes é etapa diferente: casa os dois
        losses: metrics.lostDeals.filter((deal) => deal.stage === stage.id && deal.pipelineId === stage.pipelineId).length,
      })),
      { stage: "Ganho", losses: metrics.lostDeals.filter((deal) => deal.stage === "won").length },
      { stage: "Perdido", losses: metrics.lostDeals.filter((deal) => deal.stage === "lost").length },
    ].sort((a, b) => b.losses - a.losses)[0];
    if (highestLossStage?.losses > 0) {
      items.push({
        title: "Etapa com maior perda",
        description: `${highestLossStage.stage} concentra ${highestLossStage.losses} negociações perdidas.`,
        tone: "warning",
      });
    }

    const bestOwner = ownerRanking[0];
    if (bestOwner) {
      items.push({
        title: "Melhor responsável no período",
        description: `${bestOwner.name} lidera com ${formatCurrency(bestOwner.wonValue)} ganhos e ${formatPercent(bestOwner.conversion)} de conversão.`,
        tone: "success",
      });
    }

    if (operational.staleDeals.length > 0) {
      items.push({
        title: "Negociações sem movimentação",
        description: `${operational.staleDeals.length} oportunidades estão sem interação há mais de ${STALE_DAYS} dias.`,
        tone: "danger",
      });
    }

    if (operational.overdueClosingDeals.length > 0) {
      items.push({
        title: "Previsão de fechamento atrasada",
        description: `${operational.overdueClosingDeals.length} oportunidades abertas passaram da data prevista de fechamento.`,
        tone: "warning",
      });
    }

    if (metrics.activeDeals.length > 0 && metrics.conversion >= 40) {
      items.push({
        title: "Oportunidades de recuperação",
        description: `${metrics.activeDeals.length} negociações ativas podem aproveitar o desempenho atual do funil.`,
        tone: "default",
      });
    }

    return items.length > 0
      ? items
      : [{ title: "Base em acompanhamento", description: "Ainda não há volume suficiente para gerar alertas relevantes neste período.", tone: "default" as const }];
  }, [metrics.activeDeals.length, metrics.conversion, metrics.lostDeals, operational.overdueClosingDeals.length, operational.staleDeals.length, ownerRanking, previousConversion, stagesByPipeline, visiblePipelines]);

  const updateFilter = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard do Pipeline</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Visão gerencial de desempenho, conversão, gargalos e produtividade comercial.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <Filter className="h-4 w-4" />
              {selectedWorkspace?.name || "Workspace não selecionado"}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full space-y-1 md:w-[320px]">
              <Label className="flex items-center gap-1.5 text-xs">
                Período
                <DashboardRuleInfo ruleId="period-filter" />
              </Label>
              <Select value={filters.period} onValueChange={(value) => updateFilter("period", value as PeriodPreset)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-1 md:w-[320px]">
              <Label className="text-xs">Responsável</Label>
              <Select value={filters.ownerId} onValueChange={(value) => updateFilter("ownerId", value)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="unassigned">Sem responsável</SelectItem>
                  {organizationUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-1 md:w-[320px]">
              <Label className="text-xs">Pipeline</Label>
              <Select value={filters.pipelineId} onValueChange={(value) => updateFilter("pipelineId", value)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Pipelines</SelectItem>
                  {workspacePipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filters.period === "custom" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:w-[420px]">
              <div className="space-y-1">
                <Label className="text-xs">Inicio</Label>
                <Input className="h-9" type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fim</Label>
                <Input className="h-9" type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <PipelineDashboardSkeleton />
        ) : (
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-normal text-muted-foreground">Cards Executivos</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <CombinedKpiCard
                  title="Valor Total do Pipeline"
                  value={formatCurrency(metrics.activeValue)}
                  helper="Soma das oportunidades abertas"
                  secondary={`${formatNumber(metrics.activeDeals.length)} oportunidades abertas`}
                  icon={Wallet}
                  ruleId="pipeline-value"
                />
                <KpiCard title="Valor Total Ganho" value={formatCurrency(metrics.wonValue)} helper={`${metrics.wonDeals.length} negociações ganhas`} icon={Trophy} ruleId="won-value" tone="success" />
                <KpiCard title="Valor Total Perdido" value={formatCurrency(metrics.lostValue)} helper={`${metrics.lostDeals.length} negociações perdidas`} icon={XCircle} ruleId="lost-value" tone="danger" />
                <KpiCard title="Total de Negociações" value={formatNumber(metrics.totalDeals)} helper="Base filtrada no período" icon={BarChart3} ruleId="total-deals" />
                <KpiCard
                  title="Taxa de Conversão"
                  value={formatPercent(metrics.conversion)}
                  helper={`${metrics.wonDeals.length} ganhos de ${metrics.totalDeals} negociações`}
                  icon={TrendingUp}
                  ruleId="conversion-rate"
                  tone="success"
                />
                <KpiCard
                  title="Taxa de Conversão (R$)"
                  value={formatPercent(metrics.valueConversion)}
                  helper={`${formatCurrency(metrics.wonValue)} ganhos de ${formatCurrency(metrics.totalValue)}`}
                  icon={TrendingUp}
                  ruleId="conversion-value"
                  tone="success"
                />
                <KpiCard title="Ticket Médio" value={formatCurrency(metrics.averageTicket)} helper="Média das negociações ganhas" icon={Wallet} ruleId="average-ticket" />
                <KpiCard title="Tempo Médio de Fechamento" value={`${Math.round(metrics.averageClosingTime)} dias`} helper="Média entre criação e fechamento" icon={Clock3} ruleId="average-closing-time" tone="warning" />
                <KpiCard
                  title="Receita Prevista"
                  value={formatCurrency(metrics.forecastRevenue)}
                  helper={
                    metrics.averageClosingTime > 0
                      ? `${metrics.projectedRevenueDeals.length} oportunidades com fechamento estimado no período`
                      : "Sem histórico suficiente para estimar fechamento médio"
                  }
                  icon={LineChartIcon}
                  ruleId="forecast-revenue"
                />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ChartCard
                title="Volume de Oportunidade por Etapa (R$)"
                helper={selectedPipeline ? `Quantidade e valor acumulado por etapa · ${selectedPipeline.name}` : "Escolha um pipeline para ver o funil"}
                ruleId="stage-volume"
              >
                {!selectedPipeline ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                    <Filter className="h-6 w-6 text-muted-foreground/60" />
                    <p className="text-sm font-medium">Escolha um pipeline no filtro</p>
                    <p className="max-w-[320px] text-xs text-muted-foreground">
                      As etapas só são comparáveis dentro do mesmo funil: “leads” é “Novos Leads” no Pipeline
                      Comercial e “Opt-in” na Nutrição. Somar as duas numa barra só não diria nada.
                    </p>
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stageData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 1000}k`} />
                    <Tooltip formatter={(value, name) => (name === "value" ? formatCurrency(Number(value)) : formatNumber(Number(value)))} />
                    <Area yAxisId="right" type="monotone" dataKey="value" name="Valor" stroke="#2563eb" fill="#2563eb" fillOpacity={0.14} />
                    <Line yAxisId="left" type="monotone" dataKey="count" name="Quantidade" stroke="#10b981" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Evolução das Negociações" helper="Criadas, ganhas e perdidas no período" ruleId="deals-evolution">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="created" name="Criadas" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="won" name="Ganhas" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="lost" name="Perdidas" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Ganhos x Perdidos" helper="Distribuição da qualidade operacional" ruleId="outcome-split">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={(value) => formatNumber(Number(value))} />
                    <Pie data={outcomeData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={3}>
                      {outcomeData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Motivos de Perda" helper="Principais causas declaradas para negócios perdidos" ruleId="loss-reasons">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lossReasonsData.length ? lossReasonsData : [{ reason: "Sem perdas", count: 0 }]} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="reason" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="count" name="Perdas" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </section>

            <section className="grid grid-cols-1 gap-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold">Ranking de Responsáveis</CardTitle>
                      <p className="text-xs text-muted-foreground">Ganhos, volume, eficiência e potencial futuro</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Ranking por:</span>
                      <Select value={rankingSort} onValueChange={(value) => setRankingSort(value as RankingSort)}>
                        <SelectTrigger className="h-9 w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wonValue">Valor Ganho</SelectItem>
                          <SelectItem value="conversion">Taxa de Conversão (R$)</SelectItem>
                          <SelectItem value="averageTicket">Ticket Médio</SelectItem>
                          <SelectItem value="wonCount">Quantidade de Ganhos</SelectItem>
                          <SelectItem value="pipelineValue">Valor em Pipeline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[72px]">Posição</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead className="text-right">Total de Negociações</TableHead>
                          <TableHead className="text-right">Negociações Ganhas</TableHead>
                          <TableHead className="text-right">Taxa de Conversão (R$)</TableHead>
                          <TableHead className="text-right">Valor Total Ganho</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                          <TableHead className="text-right">Valor em Pipeline</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ownerRanking.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="h-[180px] text-center text-sm text-muted-foreground">
                              Sem ganhos no período filtrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          ownerRanking.map((row, index) => (
                            <TableRow key={row.id}>
                              <TableCell>
                                {index < 3 ? (
                                  <span
                                    className={cn(
                                      "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                                      index === 0 && "bg-amber-500/10 text-amber-600",
                                      index === 1 && "bg-slate-500/10 text-slate-600",
                                      index === 2 && "bg-orange-500/10 text-orange-600",
                                    )}
                                  >
                                    {index === 0 ? "1" : index === 1 ? "2" : "3"}
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">{index + 1}</span>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                <span className="truncate">{row.name}</span>
                              </TableCell>
                              <TableCell className="text-right">{formatNumber(row.totalDeals)}</TableCell>
                              <TableCell className="text-right">{formatNumber(row.wonCount)}</TableCell>
                              <TableCell className="text-right">{formatPercent(row.conversion)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.wonValue)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.averageTicket)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.pipelineValue)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Atividades e Pendências</CardTitle>
                  <p className="text-xs text-muted-foreground">Alertas operacionais para acompanhamento diário</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {[
                      { label: `Sem interação há mais de ${STALE_DAYS} dias`, value: operational.staleDeals.length, icon: AlertTriangle, tone: "text-amber-600 bg-amber-500/10" },
                      { label: "Tarefas atrasadas", value: operational.overdueTasks.length, icon: XCircle, tone: "text-rose-600 bg-rose-500/10" },
                      { label: "Fechamento atrasado", value: operational.overdueClosingDeals.length, icon: AlertTriangle, tone: "text-orange-600 bg-orange-500/10" },
                      { label: "Tarefas para hoje", value: operational.todayTasks.length, icon: CalendarDays, tone: "text-blue-600 bg-blue-500/10" },
                      { label: "Sem responsável", value: operational.unassignedDeals.length, icon: UserRound, tone: "text-slate-600 bg-slate-500/10" },
                      { label: `Paradas na etapa há ${STAGE_STALE_DAYS}+ dias`, value: operational.stalledStageDeals.length, icon: Clock3, tone: "text-orange-600 bg-orange-500/10" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-md border border-border p-3">
                        <div>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="mt-1 text-2xl font-bold">{formatNumber(item.value)}</p>
                        </div>
                        <span className={cn("flex h-9 w-9 items-center justify-center rounded-md", item.tone)}>
                          <item.icon className="h-4 w-4" />
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Insights do Pipeline</CardTitle>
                  <p className="text-xs text-muted-foreground">Regras de negocio calculadas localmente, sem IA externa</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.map((insight) => {
                      const Icon = insight.tone === "success" ? CheckCircle2 : insight.tone === "danger" ? TrendingDown : insight.tone === "warning" ? AlertTriangle : TrendingUp;
                      return (
                        <div key={insight.title} className="flex gap-3 rounded-md border border-border p-3">
                          <span
                            className={cn(
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                              insight.tone === "success" && "bg-emerald-500/10 text-emerald-600",
                              insight.tone === "danger" && "bg-rose-500/10 text-rose-600",
                              insight.tone === "warning" && "bg-amber-500/10 text-amber-600",
                              insight.tone === "default" && "bg-blue-500/10 text-blue-600",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{insight.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{insight.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
