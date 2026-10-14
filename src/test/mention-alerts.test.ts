import { describe, expect, it } from "vitest";
import {
  getAlertTypeLabel,
  getScopedAlertList,
  getUnreadAlertCount,
  keepOnlyMentionAlerts,
  type AppAlert,
} from "@/lib/alertsStore";
import { comandosDasPolicies, funcao, policies } from "./baseMigration";

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
 * Contrato textual da migration base: as policies são o que destrava a menção e o que segura a
 * privacidade do alerta. Se alguém afrouxar isso, o teste quebra — de propósito.
 */
describe("contrato de RLS dos alertas", () => {
  const todas = policies("public.crm_user_alerts");
  const porNome = (nome: string) => todas.find((p) => p.startsWith(`CREATE POLICY ${nome} `)) ?? "";

  it("abre o INSERT validando o destinatário", () => {
    // Alerta de menção é para OUTRA pessoa: o INSERT não pode exigir que o alerta seja do autor
    // (RULES.md §13), mas tem de exigir que o destinatário alcance o workspace.
    const insert = porNome("crm_user_alerts_insert_workspace");
    expect(insert).toContain("FOR INSERT");
    expect(insert).toContain("private.email_can_access_workspace");
    expect(insert).toContain("private.current_user_can_access_workspace");
  });

  it("mantém leitura, alteração e exclusão restritas ao dono", () => {
    for (const nome of ["crm_user_alerts_select_own", "crm_user_alerts_update_own", "crm_user_alerts_delete_own"]) {
      expect(porNome(nome)).toContain("auth.jwt() ->> 'email'");
    }
  });

  it("nenhuma policy cobre todos os comandos de uma vez (permissiva soma por OR)", () => {
    expect(comandosDasPolicies("public.crm_user_alerts")).toEqual(["DELETE", "INSERT", "SELECT", "UPDATE"]);
  });

  it("desliga alerta alheio só pela função de escopo estreito", () => {
    const fn = funcao("public.deactivate_comment_mention_alerts");
    expect(fn).toContain("SECURITY DEFINER");
    expect(fn).toContain("alerta.type = 'comment_mention'");
    expect(fn).toContain("private.current_user_can_access_workspace(alerta.workspace_id::text)");
    // a função nunca reativa nem apaga
    expect(fn).not.toContain("SET active = TRUE");
    expect(fn).not.toContain("DELETE FROM public.crm_user_alerts");
  });
});
