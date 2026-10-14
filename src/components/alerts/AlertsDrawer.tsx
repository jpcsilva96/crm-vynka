import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, AtSign, Bell, CheckCheck, PhoneCall, Target, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AppAlert, AlertType } from "@/lib/alertsStore";
import { cn } from "@/lib/utils";

const ALERT_ICON_MAP: Record<AlertType, typeof AtSign> = {
  comment_mention: AtSign,
};

const ALERT_ICON_TONE: Record<AlertType, string> = {
  comment_mention: "text-violet-600 bg-violet-500/10",
};

const formatAlertDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
};

const formatAlertAbsoluteDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

interface Props {
  open: boolean;
  alerts: AppAlert[];
  onOpenChange: (open: boolean) => void;
  onAlertClick: (alert: AppAlert) => void;
  onMarkAllRead: () => void;
  onClearRead: () => void;
  onViewHistory: () => void;
}

export function AlertsDrawer({
  open,
  alerts,
  onOpenChange,
  onAlertClick,
  onMarkAllRead,
  onClearRead,
  onViewHistory,
}: Props) {
  const unreadCount = alerts.filter((alert) => !alert.readAt).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[560px] p-0 sm:max-w-[560px]">
        <div className="flex h-full min-h-0 flex-col">
          <SheetHeader className="border-b border-border px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle>Alertas</SheetTitle>
                  <SheetDescription>
                    {unreadCount > 0 ? `${unreadCount} não lido${unreadCount > 1 ? "s" : ""}` : "Tudo em dia por aqui."}
                  </SheetDescription>
                </div>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1">
            <div className="divide-y divide-border">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Bell className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Nenhum alerta no momento</p>
                  <p className="mt-1 text-sm text-muted-foreground">Novos eventos importantes vão aparecer aqui.</p>
                </div>
              ) : (
                alerts.map((alert) => {
                  const Icon = ALERT_ICON_MAP[alert.type];
                  return (
                    <button
                      key={alert.id}
                      onClick={() => onAlertClick(alert)}
                      className="flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full", ALERT_ICON_TONE[alert.type])}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.description}</p>
                          </div>
                          {!alert.readAt ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-destructive" /> : null}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{formatAlertDate(alert.updatedAt)}</span>
                          <span>{formatAlertAbsoluteDate(alert.updatedAt)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-border px-4 py-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
              <Button type="button" variant="outline" className="h-11 min-w-0 w-full justify-center gap-2 px-3 text-sm" onClick={onMarkAllRead}>
                <CheckCheck className="h-4 w-4" />
                Marcar todos como lidos
              </Button>
              <Button type="button" variant="outline" className="h-11 min-w-0 w-full justify-center gap-2 px-3 text-sm" onClick={onClearRead}>
                <Trash2 className="h-4 w-4" />
                Limpar lidos
              </Button>
              <Button type="button" className="h-11 min-w-0 w-full justify-center gap-2 px-3 text-sm" onClick={onViewHistory}>
                <Bell className="h-4 w-4" />
                Ver histórico
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
