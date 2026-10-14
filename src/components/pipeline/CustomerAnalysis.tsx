import { useMemo, type ReactNode } from "react";
import { Activity, Calendar, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { Bar, BarChart, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQualificationNextActions } from "@/lib/leadQualification";
import type { Deal } from "@/lib/dealsStore";

interface Props {
  deals: Deal[];
  title?: string;
  showQualification?: boolean;
  qualificationClassification?: string;
  qualificationScore?: number;
  qualificationCompletedAt?: string;
  qualificationResponsible?: string;
}

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const formatDate = (value: Date | null) => value ? value.toLocaleDateString("pt-BR") : "—";

export function CustomerAnalysis({ deals, title = "Análise do Cliente", showQualification = true, qualificationClassification, qualificationScore, qualificationCompletedAt, qualificationResponsible }: Props) {
  const metrics = useMemo(() => {
    const won = deals.filter((deal) => deal.outcome === "won" || deal.stage === "won");
    const lost = deals.filter((deal) => deal.outcome === "lost" || deal.stage === "lost");
    const ongoing = deals.filter((deal) => !deal.outcome && deal.stage !== "won" && deal.stage !== "lost");
    const dates = deals.map((deal) => new Date(deal.createdAt)).sort((a, b) => a.getTime() - b.getTime());
    const oldest = dates[0] || null;
    const newest = dates.at(-1) || null;
    const relationshipDays = oldest ? Math.max(0, Math.ceil((Date.now() - oldest.getTime()) / 86400000)) : 0;
    const totalValue = deals.reduce((total, deal) => total + (deal.value || 0), 0);
    const wonValue = won.reduce((total, deal) => total + (deal.value || 0), 0);
    const conversionRate = deals.length ? (won.length / deals.length) * 100 : 0;
    const ticket = won.length ? wonValue / won.length : totalValue / Math.max(deals.length, 1);
    const wonDates = won.map((deal) => new Date(deal.createdAt).getTime());
    const daysSinceLastWon = wonDates.length ? Math.max(0, Math.ceil((Date.now() - Math.max(...wonDates)) / 86400000)) : null;
    const intervals = dates.slice(1).map((date, index) => date.getTime() - dates[index].getTime());
    const avgIntervalDays = intervals.length ? Math.ceil(intervals.reduce((sum, value) => sum + value, 0) / intervals.length / 86400000) : null;
    const months: Record<string, { month: string; key: string; Total: number; Ganhas: number; Perdidas: number }> = {};
    deals.forEach((deal) => {
      const date = new Date(deal.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
      months[key] ||= { key, month: date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }), Total: 0, Ganhas: 0, Perdidas: 0 };
      months[key].Total += 1;
      if (deal.outcome === "won" || deal.stage === "won") months[key].Ganhas += 1;
      if (deal.outcome === "lost" || deal.stage === "lost") months[key].Perdidas += 1;
    });
    const lossReasons = lost.reduce<Record<string, number>>((result, deal) => {
      const reason = deal.lossReason || "Não informado";
      result[reason] = (result[reason] || 0) + 1;
      return result;
    }, {});
    const lossData = Object.entries(lossReasons).map(([name, value]) => ({ name, value }));
    const insights = [
      deals.length > 3 ? "Alta recorrência: este cliente possui histórico frequente no funil." : deals.length > 1 ? "Relacionamento em maturação: há mais de uma negociação no histórico." : null,
      conversionRate >= 60 ? "Histórico positivo de conversão: a maior parte das negociações foi concluída com sucesso." : conversionRate > 0 && conversionRate < 30 ? "Atenção à conversão: a taxa comercial está abaixo de 30%." : null,
      daysSinceLastWon !== null && avgIntervalDays !== null && daysSinceLastWon > avgIntervalDays * 1.5 ? `Cliente fora do prazo de recompra há ${daysSinceLastWon} dias.` : null,
      lossData[0] ? `Obstáculo comercial comum: ${lossData[0].name} (${lossData[0].value} ocorrência${lossData[0].value > 1 ? "s" : ""}).` : null,
    ].filter(Boolean) as string[];
    return { won, lost, ongoing, oldest, newest, relationshipDays, totalValue, wonValue, conversionRate, ticket, daysSinceLastWon, avgIntervalDays, evolution: Object.values(months).sort((a, b) => a.key.localeCompare(b.key)).slice(-6), lossData, insights: insights.length ? insights : ["Histórico inicial. Novos insights serão calculados conforme as negociações evoluírem."] };
  }, [deals]);

  return <div className="flex h-full max-w-6xl flex-col pb-12">
    <div className="mb-6 flex items-center justify-between"><h3 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h3></div>
    {showQualification && <Card className="mb-6 border-border shadow-sm"><CardContent className="p-4"><div className="grid gap-4 md:grid-cols-4">
      <Info label="Classificação do Lead" value={qualificationClassification || "Sem qualificação"} />
      <Info label="Pontuação BANT" value={`${qualificationScore ?? 0}/20 pontos`} />
      <Info label="Última qualificação" value={qualificationCompletedAt ? new Date(qualificationCompletedAt).toLocaleDateString("pt-BR") : "Não realizada"} small />
      <Info label="Responsável" value={qualificationResponsible || "Não informado"} small />
    </div>{qualificationClassification && <div className="mt-4 border-t border-border pt-3"><p className="text-xs font-semibold uppercase text-muted-foreground">Próxima ação sugerida</p><div className="mt-2 flex flex-wrap gap-2">{getQualificationNextActions(qualificationClassification).map((action) => <span key={action} className="rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs font-semibold">{action}</span>)}</div></div>}</CardContent></Card>}
    <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard title="Relacionamento" icon={<Calendar />} value={`${metrics.relationshipDays} ${metrics.relationshipDays === 1 ? "Dia" : "Dias"}`} rows={[["Negociações", `${deals.length}`], ["Primeira", formatDate(metrics.oldest)], ["Última", formatDate(metrics.newest)]]} />
      <MetricCard title="Conversão" icon={<Trophy />} value={`${metrics.conversionRate.toFixed(1)}%`} rows={[["Total", `${deals.length} neg.`], ["Ganhas", `${metrics.won.length}`], ["Perdidas", `${metrics.lost.length}`]]} />
      <MetricCard title="Performance Comercial" icon={<TrendingUp />} value={formatCurrency(metrics.wonValue)} rows={[["Total negociado", formatCurrency(metrics.totalValue)], ["Ticket médio", formatCurrency(metrics.ticket)]]} />
      <MetricCard title="Recorrência" icon={<Activity />} value={metrics.avgIntervalDays !== null ? `${metrics.avgIntervalDays} dias` : "—"} rows={[["Média retorno", metrics.avgIntervalDays !== null ? `${metrics.avgIntervalDays} dias` : "Único negócio"], ["Última compra ganha", metrics.daysSinceLastWon !== null ? `há ${metrics.daysSinceLastWon} dias` : "Sem vendas ganhas"]]} />
    </div>
    <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3"><ChartCard title="Qualidade do Relacionamento"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: "Ganhas", value: metrics.won.length, color: "#10b981" }, { name: "Perdidas", value: metrics.lost.length, color: "#ef4444" }, { name: "Em andamento", value: metrics.ongoing.length, color: "#f59e0b" }].filter((item) => item.value)} dataKey="value" innerRadius={60} outerRadius={80}>{[{ name: "Ganhas", value: metrics.won.length, color: "#10b981" }, { name: "Perdidas", value: metrics.lost.length, color: "#ef4444" }, { name: "Em andamento", value: metrics.ongoing.length, color: "#f59e0b" }].filter((item) => item.value).map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /><Legend verticalAlign="bottom" /></PieChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Evolução das Negociações ao Longo do Tempo" className="lg:col-span-2"><ResponsiveContainer width="100%" height="100%"><LineChart data={metrics.evolution}><XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="Total" stroke="#3b82f6" /><Line type="monotone" dataKey="Ganhas" stroke="#10b981" /><Line type="monotone" dataKey="Perdidas" stroke="#ef4444" /></LineChart></ResponsiveContainer></ChartCard></div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3"><ChartCard title="Principais Motivos de Perda">{metrics.lossData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.lossData} layout="vertical"><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={90} fontSize={10} /><Tooltip /><Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <p className="text-center text-xs italic text-muted-foreground">Nenhuma negociação foi marcada como perdida.</p>}</ChartCard>
      <Card className="border-border shadow-sm lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-1.5 text-sm font-bold"><Sparkles className="h-4 w-4 text-amber-500" />Insights do Cliente</CardTitle></CardHeader><CardContent className="space-y-3">{metrics.insights.map((insight, index) => <div key={insight} className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/40 p-3 text-sm"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-600">{index + 1}</span><span className="font-medium text-foreground">{insight}</span></div>)}</CardContent></Card></div>
  </div>;
}

function Info({ label, value, small }: { label: string; value: string; small?: boolean }) { return <div><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><p className={`mt-1 font-bold text-foreground ${small ? "text-sm" : "text-lg"}`}>{value}</p></div>; }
function MetricCard({ title, icon, value, rows }: { title: string; icon: ReactNode; value: string; rows: string[][] }) { return <Card className="border-border/80 bg-gradient-to-br from-background to-muted/20 shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">{title}</CardTitle><span className="text-primary">{icon}</span></CardHeader><CardContent className="space-y-2 pt-1"><div className="text-2xl font-bold text-foreground">{value}</div><div className="space-y-1 border-t border-border/50 pt-1 text-xs text-muted-foreground">{rows.map(([label, content]) => <div key={label} className="flex justify-between gap-2"><span>{label}:</span><span className="truncate font-semibold text-foreground">{content}</span></div>)}</div></CardContent></Card>; }
function ChartCard({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) { return <Card className={`border-border shadow-sm ${className}`}><CardHeader><CardTitle className="text-sm font-bold text-foreground">{title}</CardTitle></CardHeader><CardContent className="flex h-64 items-center justify-center">{children}</CardContent></Card>; }
