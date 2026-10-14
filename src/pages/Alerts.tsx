import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CheckCheck, Filter, PhoneCall, Target, TrendingUp, AlertTriangle, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppAlert, AlertType } from "@/lib/alertsStore";
import { getAlertTypeLabel } from "@/lib/alertsStore";
import { cn } from "@/lib/utils";

type AlertHistoryFilter = "all" | "unread" | "read";

const ALERT_ICON_MAP: Record<AlertType, typeof AtSign> = {
  comment_mention: AtSign,
};

const ALERT_ICON_TONE: Record<AlertType, string> = {
  comment_mention: "text-violet-600 bg-violet-500/10",
};

interface Props {
  alerts: AppAlert[];
  onAlertClick: (alert: AppAlert) => void;
  onMarkAllRead: () => void;
  onClearRead: () => void;
}

export default function Alerts({ alerts, onAlertClick, onMarkAllRead, onClearRead }: Props) {
  const [statusFilter, setStatusFilter] = useState<AlertHistoryFilter>("all");

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (statusFilter === "unread") return !alert.readAt;
      if (statusFilter === "read") return !!alert.readAt;
      return true;
    });
  }, [alerts, statusFilter]);

  const unreadCount = alerts.filter((alert) => !alert.readAt).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Alertas</h1>
                <p className="text-sm text-muted-foreground">Acompanhe os eventos que pedem atenção no workspace atual.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AlertHistoryFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="unread">Não lidos</SelectItem>
                <SelectItem value="read">Lidos</SelectItem>
              </SelectContent>
            </Select>

            <Button type="button" variant="outline" className="gap-2" onClick={onMarkAllRead}>
              <CheckCheck className="h-4 w-4" />
              Marcar todos como lidos
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={onClearRead}>
              Limpar lidos
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{alerts.length} alertas</Badge>
          <Badge variant="outline">{unreadCount} não lidos</Badge>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[220px]">Tipo</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className="w-[160px]">Usuário</TableHead>
                <TableHead className="w-[180px]">Data</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAlerts.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Bell className="mb-3 h-10 w-10 opacity-30" />
                      <p className="text-sm font-medium">Nenhum alerta encontrado</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAlerts.map((alert) => {
                  const Icon = ALERT_ICON_MAP[alert.type];
                  return (
                    <TableRow key={alert.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onAlertClick(alert)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={cn("flex h-9 w-9 items-center justify-center rounded-full", ALERT_ICON_TONE[alert.type])}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{getAlertTypeLabel(alert.type)}</p>
                            <p className="text-xs text-muted-foreground">{alert.active ? "Ativo" : "Histórico"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-foreground">{alert.description}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{alert.userEmail}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(alert.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={alert.readAt ? "outline" : "default"}>{alert.readAt ? "Lido" : "Não lido"}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
