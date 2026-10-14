import { supabase } from "@/integrations/supabase/client";
import type { CommentMention } from "@/lib/commentMentions";

export type RemoteAlertType = "comment_mention";
export type RemoteAlertTarget = "deal";

export interface RemoteUserAlert {
  id: string;
  type: RemoteAlertType;
  workspaceId: string;
  userEmail: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
  active: boolean;
  dedupeKey: string;
  target: RemoteAlertTarget;
  targetId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

const mapRow = (row: any): RemoteUserAlert => ({
  id: row.id,
  type: row.type,
  workspaceId: row.workspace_id,
  userEmail: row.user_email,
  title: row.title,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  readAt: row.read_at,
  active: !!row.active,
  dedupeKey: row.dedupe_key,
  target: row.target,
  targetId: row.target_id || undefined,
  metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
});

const getMentionDedupeKey = (commentId: string, mention: CommentMention) =>
  `comment_mention:${commentId}:${mention.userId || mention.userEmail || mention.handle}`;

export async function fetchRemoteUserAlerts(workspaceId: string, userEmail: string): Promise<RemoteUserAlert[]> {
  const { data, error } = await supabase
    .from("crm_user_alerts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_email", userEmail)
    .is("dismissed_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function markRemoteUserAlertAsRead(alertId: string) {
  const { error } = await supabase
    .from("crm_user_alerts")
    .update({
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  if (error) throw error;
}

export async function markAllRemoteUserAlertsAsRead(workspaceId: string, userEmail: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("crm_user_alerts")
    .update({
      read_at: now,
      updated_at: now,
    })
    .eq("workspace_id", workspaceId)
    .eq("user_email", userEmail)
    .is("read_at", null);

  if (error) throw error;
}

export async function clearReadRemoteUserAlerts(workspaceId: string, userEmail: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("crm_user_alerts")
    .update({ dismissed_at: now, updated_at: now })
    .eq("workspace_id", workspaceId)
    .eq("user_email", userEmail)
    .not("read_at", "is", null);

  if (error) throw error;
}

export async function syncCommentMentionAlerts(input: {
  workspaceId: string;
  dealId: string;
  dealName: string;
  commentId: string;
  authorName: string;
  authorEmail?: string;
  currentMentions: CommentMention[];
  previousMentions?: CommentMention[];
}) {
  const currentMentionedUsers = input.currentMentions.filter(
    (mention) => mention.userEmail && mention.userEmail.toLowerCase() !== input.authorEmail?.toLowerCase(),
  );
  const previousMentionMap = new Map(
    (input.previousMentions || [])
      .filter((mention) => mention.userEmail)
      .map((mention) => [mention.userEmail!.toLowerCase(), mention]),
  );
  const currentMentionMap = new Map(
    currentMentionedUsers.map((mention) => [mention.userEmail!.toLowerCase(), mention]),
  );

  // Na edição, só menção NOVA precisa de aviso: quem já estava no comentário já foi avisado, e
  // tentar de novo devolve 409 (chave duplicada) no console de quem está editando — ruído sem
  // efeito, mas ruído. No comentário novo não há menção anterior, então entram todas.
  const mencoesNovas = currentMentionedUsers.filter(
    (mention) => !previousMentionMap.has(mention.userEmail!.toLowerCase()),
  );

  if (mencoesNovas.length > 0) {
    const payload = mencoesNovas.map((mention) => ({
      workspace_id: input.workspaceId,
      user_email: mention.userEmail!.toLowerCase(),
      type: "comment_mention",
      title: "Você foi mencionado em um comentário",
      description: `${input.authorName} mencionou você na negociação "${input.dealName}".`,
      active: true,
      dedupe_key: getMentionDedupeKey(input.commentId, mention),
      target: "deal",
      target_id: input.dealId,
      read_at: null,
      updated_at: new Date().toISOString(),
      metadata: {
        dealId: input.dealId,
        dealName: input.dealName,
        commentId: input.commentId,
        authorName: input.authorName,
        mentionHandle: mention.handle,
      },
    }));

    // INSERT puro, um por um — nunca `upsert`.
    //
    // Medido em 10/09: o upsert do supabase-js SEMPRE manda ON CONFLICT (com merge- ou
    // ignore-duplicates), e com ON CONFLICT o Postgres exige que a linha nova passe também pela
    // policy de SELECT. O aviso é de OUTRA pessoa, e a nossa policy de leitura é restrita ao dono:
    // resultado, 403 "new row violates row-level security policy". Sem ON CONFLICT, a mesma linha
    // entra. Um a um porque, em lote, uma duplicata derrubaria os avisos das outras pessoas junto.
    //
    // 23505 = chave duplicada: o aviso daquela menção já existe e não há nada a fazer.
    const resultados = await Promise.all(
      payload.map((linha) => supabase.from("crm_user_alerts").insert(linha)),
    );
    const falha = resultados.find(({ error }) => error && error.code !== "23505");
    if (falha?.error) throw falha.error;
  }

  const removedMentions = Array.from(previousMentionMap.entries())
    .filter(([email]) => !currentMentionMap.has(email))
    .map(([, mention]) => mention);

  if (removedMentions.length > 0) {
    await deactivateCommentMentionAlerts(
      input.commentId,
      removedMentions.map((mention) => mention.userEmail!).filter(Boolean),
    );
  }
}

/**
 * Desliga o aviso de menção de um comentário — o de todo mundo, ou só o dos e-mails informados.
 *
 * Vai por RPC porque o aviso pertence a OUTRA pessoa: um UPDATE direto precisaria ler a linha, e a
 * leitura passa pela policy de SELECT, restrita ao dono. Medido em ensaio (10/09): com policy de
 * desativação o UPDATE afetava 0 linhas, em silêncio. A função no banco valida que quem chama
 * alcança o workspace do aviso e só sabe desligar.
 */
export async function deactivateCommentMentionAlerts(commentId: string, userEmails?: string[]) {
  const { error } = await (supabase as any).rpc("deactivate_comment_mention_alerts", {
    p_comment_id: commentId,
    p_user_emails: userEmails && userEmails.length > 0 ? userEmails : null,
  });

  if (error) throw error;
}
