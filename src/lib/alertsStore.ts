import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  clearReadRemoteUserAlerts,
  fetchRemoteUserAlerts,
  markAllRemoteUserAlertsAsRead,
  markRemoteUserAlertAsRead,
  type RemoteUserAlert,
} from "@/lib/userAlerts";

/**
 * Central de alertas — **só menção em comentário** (decisão do cliente, 10/09/2026).
 *
 * Até aqui o sininho também derivava quatro avisos do estado local: tarefa vencida, negociação sem
 * atividade, previsão de fechamento vencida e novo atendimento. Eram calculados no navegador de cada
 * um e ninguém agia por eles — o cliente pediu para ficar só com o que é dirigido a uma pessoa.
 * Os quatro saíram do sininho E do histórico; os números continuam vivos no Dashboard, na seção
 * "Atividades e Pendências", que é outra tela e não mudou.
 *
 * Como consequência, o store deixou de calcular alerta: ele só espelha o que veio do banco.
 */

export type AlertType = "comment_mention";
export type AlertTarget = "deal";

export interface AppAlert {
  id: string;
  type: AlertType;
  workspaceId: string;
  userEmail: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
  active: boolean;
  dedupeKey: string;
  target: AlertTarget;
  targetId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

type AlertsState = {
  alerts: AppAlert[];
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  markAsRead: (alertId: string) => void;
  markAllAsRead: (workspaceId: string, userEmail: string) => void;
  clearRead: (workspaceId: string, userEmail: string) => void;
  syncRemoteAlerts: (input: { workspaceId: string; userEmail: string }) => Promise<void>;
};

const STORAGE_KEY = "vynka.alerts.center";

const getNowIso = () => new Date().toISOString();

const getScopedAlerts = (alerts: AppAlert[], workspaceId: string, userEmail: string) =>
  alerts.filter((alert) => alert.workspaceId === workspaceId && alert.userEmail === userEmail);

const mapRemoteAlert = (alert: RemoteUserAlert): AppAlert => ({
  ...alert,
  type: "comment_mention",
  target: "deal",
  metadata: {
    ...(alert.metadata || {}),
    remote: true,
  },
});

/** Só sobrevive o que é menção: descarta o que ficou gravado no navegador antes de 10/09. */
export const keepOnlyMentionAlerts = (alerts: unknown): AppAlert[] => {
  if (!Array.isArray(alerts)) return [];
  return alerts.filter(
    (alert): alert is AppAlert =>
      !!alert && typeof alert === "object" && (alert as AppAlert).type === "comment_mention",
  );
};

export const getAlertTypeLabel = (type: AlertType) =>
  type === "comment_mention" ? "Menção em comentário" : "Alerta";

export const useAlertsStore = create<AlertsState>()(
  persist(
    (set, get) => ({
      alerts: [],
      drawerOpen: false,

      setDrawerOpen: (open) => set({ drawerOpen: open }),

      markAsRead: (alertId) => {
        const alert = get().alerts.find((entry) => entry.id === alertId);
        if (alert && !alert.readAt) {
          void markRemoteUserAlertAsRead(alertId).catch((error) => {
            console.error("Erro ao marcar alerta como lido:", error);
          });
        }

        set((state) => ({
          alerts: state.alerts.map((entry) =>
            entry.id === alertId && !entry.readAt
              ? { ...entry, readAt: getNowIso(), updatedAt: getNowIso() }
              : entry,
          ),
        }));
      },

      markAllAsRead: (workspaceId, userEmail) => {
        const hasUnread = get().alerts.some(
          (alert) => alert.workspaceId === workspaceId && alert.userEmail === userEmail && !alert.readAt,
        );

        if (hasUnread) {
          void markAllRemoteUserAlertsAsRead(workspaceId, userEmail).catch((error) => {
            console.error("Erro ao marcar alertas como lidos:", error);
          });
        }

        set((state) => {
          const now = getNowIso();
          return {
            alerts: state.alerts.map((alert) =>
              alert.workspaceId === workspaceId && alert.userEmail === userEmail && !alert.readAt
                ? { ...alert, readAt: now, updatedAt: now }
                : alert,
            ),
          };
        });
      },

      clearRead: (workspaceId, userEmail) => {
        const hasRead = get().alerts.some(
          (alert) => alert.workspaceId === workspaceId && alert.userEmail === userEmail && !!alert.readAt,
        );

        if (hasRead) {
          void clearReadRemoteUserAlerts(workspaceId, userEmail).catch((error) => {
            console.error("Erro ao limpar alertas lidos:", error);
          });
        }

        set((state) => ({
          alerts: state.alerts.filter(
            (alert) => !(alert.workspaceId === workspaceId && alert.userEmail === userEmail && !!alert.readAt),
          ),
        }));
      },

      syncRemoteAlerts: async ({ workspaceId, userEmail }) => {
        try {
          const remoteAlerts = await fetchRemoteUserAlerts(workspaceId, userEmail);
          set((state) => {
            const outrosEscopos = state.alerts.filter(
              (alert) => !(alert.workspaceId === workspaceId && alert.userEmail === userEmail),
            );
            return {
              alerts: [...outrosEscopos, ...remoteAlerts.map(mapRemoteAlert)],
            };
          });
        } catch (error) {
          console.error("Erro ao sincronizar alertas remotos:", error);
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // Quem já usava o CRM tem os quatro tipos antigos gravados no navegador. Sem esta poda, eles
      // continuariam aparecendo no sininho para sempre, porque nada os apagaria.
      migrate: (persisted) => ({
        alerts: keepOnlyMentionAlerts((persisted as { alerts?: unknown } | undefined)?.alerts),
      }),
      partialize: (state) => ({
        alerts: state.alerts,
      }),
    },
  ),
);

export const getScopedAlertList = (alerts: AppAlert[], workspaceId: string, userEmail: string, includeInactive = false) =>
  getScopedAlerts(alerts, workspaceId, userEmail)
    .filter((alert) => alert.type === "comment_mention")
    .filter((alert) => includeInactive || alert.active)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

export const getUnreadAlertCount = (alerts: AppAlert[], workspaceId: string, userEmail: string) =>
  getScopedAlertList(alerts, workspaceId, userEmail).filter((alert) => !alert.readAt).length;
