import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAlertTypeLabel,
  getScopedAlertList,
  getUnreadAlertCount,
  keepOnlyMentionAlerts,
  type AppAlert,
} from "@/lib/alertsStore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260910170000_fix_comment_mention_alerts_rls.sql"),
  "utf8",
);

const WS = "ws-1";
const EU = "vendedor@exemplo.com.br";

const alerta = (overrides: Partial<AppAlert> = {}): AppAlert => ({
  id: "a1",
  type: "comment_mention",
  workspaceId: WS,
  userEmail: EU,
  title: "Você foi mencionado em um comentário",
  description: "Maria mencionou você",
  createdAt: "2026-09-10T12:00:00.000Z",
  updatedAt: "2026-09-10T12:00:00.000Z",
  readAt: null,
  active: true,
  dedupeKey: "comment_mention:c1:u1",
  target: "deal",
  targetId: "deal-1",
  ...overrides,
});

describe("poda do que ficou gravado no navegador", () => {
  it("descarta os quatro tipos que saíram do sininho", () => {
    const gravado = [
      alerta(),
      { ...alerta({ id: "a2" }), type: "overdue_task" },
      { ...alerta({ id: "a3" }), type: "stale_deal" },
      { ...alerta({ id: "a4" }), type: "overdue_closing" },
      { ...alerta({ id: "a5" }), type: "new_attendance" },
    ];

    const sobrou = keepOnlyMentionAlerts(gravado);
    expect(sobrou).toHaveLength(1);
    expect(sobrou[0].id).toBe("a1");
  });

  it("aguenta estado ausente ou corrompido sem derrubar a tela", () => {
    expect(keepOnlyMentionAlerts(undefined)).toEqual([]);
    expect(keepOnlyMentionAlerts("nao é lista")).toEqual([]);
    expect(keepOnlyMentionAlerts([null, 42, { semTipo: true }])).toEqual([]);
  });
});

describe("lista do sininho", () => {
  it("mostra só o que é do usuário e do workspace atuais", () => {
    const alertas = [
      alerta({ id: "meu" }),
      alerta({ id: "de-outro", userEmail: "outra@exemplo.com.br" }),
      alerta({ id: "outro-ws", workspaceId: "ws-2" }),
    ];

    expect(getScopedAlertList(alertas, WS, EU).map((a) => a.id)).toEqual(["meu"]);
  });

  it("esconde alerta desligado, a menos que seja o histórico", () => {
    const alertas = [alerta({ id: "ligado" }), alerta({ id: "desligado", active: false })];

    expect(getScopedAlertList(alertas, WS, EU).map((a) => a.id)).toEqual(["ligado"]);
    expect(getScopedAlertList(alertas, WS, EU, true).map((a) => a.id).sort()).toEqual(["desligado", "ligado"]);
  });

  it("ordena do mais recente para o mais antigo", () => {
    const alertas = [
      alerta({ id: "velho", updatedAt: "2026-09-01T12:00:00.000Z" }),
      alerta({ id: "novo", updatedAt: "2026-09-10T18:00:00.000Z" }),
    ];

    expect(getScopedAlertList(alertas, WS, EU).map((a) => a.id)).toEqual(["novo", "velho"]);
  });

  it("não conta como não lido o que já foi lido nem o que é de outro tipo", () => {
    const alertas = [
      alerta({ id: "nao-lido" }),
      alerta({ id: "lido", readAt: "2026-09-10T13:00:00.000Z" }),
      // tipo que saiu do sininho: chega assim de um navegador que ainda tem o estado antigo
      { ...alerta({ id: "tarefa-vencida" }), type: "overdue_task" } as unknown as AppAlert,
    ];

    expect(getUnreadAlertCount(alertas, WS, EU)).toBe(1);
  });

  it("rotula o único tipo que restou", () => {
    expect(getAlertTypeLabel("comment_mention")).toBe("Menção em comentário");
  });
});

/**
 * Contrato textual, no espírito de security-contract.test.ts: a migration é o que destrava a menção
 * e o que segura a privacidade do alerta. Se alguém afrouxar isso, o teste quebra — de propósito.
 */
describe("contrato da migration de RLS", () => {
  it("abre o INSERT validando o destinatário", () => {
    expect(migration).toContain("crm_user_alerts_insert_workspace");
    expect(migration).toContain("private.email_can_access_workspace");
    expect(migration.indexOf("CREATE POLICY crm_user_alerts_insert_workspace")).toBeLessThan(
      migration.indexOf("CREATE POLICY crm_user_alerts_delete_own"),
    );
  });

  it("mantém leitura, alteração e exclusão restritas ao dono", () => {
    for (const policy of ["crm_user_alerts_select_own", "crm_user_alerts_update_own", "crm_user_alerts_delete_own"]) {
      expect(migration).toContain(policy);
    }
    // nenhuma policy de leitura pode existir sem a comparação com o e-mail do JWT
    const trechoSelect = migration.slice(
      migration.indexOf("CREATE POLICY crm_user_alerts_select_own"),
      migration.indexOf("CREATE POLICY crm_user_alerts_insert_workspace"),
    );
    expect(trechoSelect).toContain("auth.jwt() ->> 'email'");
  });

  it("desliga alerta alheio só pela função de escopo estreito", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.deactivate_comment_mention_alerts");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("alerta.type = 'comment_mention'");
    expect(migration).toContain("private.current_user_can_access_workspace(alerta.workspace_id::text)");
    // a função nunca reativa nem apaga
    expect(migration).not.toContain("SET active = TRUE");
    expect(migration).not.toContain("DELETE FROM public.crm_user_alerts");
  });

  it("derruba as policies antigas antes de criar as novas (permissiva soma por OR)", () => {
    expect(migration).toContain("DROP POLICY IF EXISTS %I ON public.crm_user_alerts");
    expect(migration.indexOf("DROP POLICY IF EXISTS %I ON public.crm_user_alerts")).toBeLessThan(
      migration.indexOf("CREATE POLICY crm_user_alerts_select_own"),
    );
  });
});
