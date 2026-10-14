import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/lib/workspaceStore";

const db = supabase as any;

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const FUNCTIONS_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1`;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface DealNoteAttachment {
  name: string;
  /** Caminho REAL no bucket (`workspaces/<id>/<pasta>/<uuid>-<nome>`). É por ele que se assina o link. */
  path: string;
  size?: number;
  type?: string;
  /**
   * URL assinada — só nos registros gravados antes de 10/09/2026, e **expirada** (valia 1 hora).
   * Não gravamos mais: o link é pedido na hora de abrir. Mantido no tipo para os registros antigos.
   */
  url?: string;
}

export interface DealNoteDocument {
  id: string;
  dealId: string;
  contentHtml: string;
  contentText: string;
  attachments: DealNoteAttachment[];
  lastEditedBy?: string;
  createdAt: string;
  updatedAt: string;
}

const mapRow = (row: any): DealNoteDocument => ({
  id: row.id,
  dealId: row.deal_id,
  contentHtml: row.content_html || "",
  contentText: row.content_text || "",
  attachments: Array.isArray(row.attachments) ? row.attachments : [],
  lastEditedBy: row.last_edited_by || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function fetchDealNote(dealId: string): Promise<DealNoteDocument | null> {
  const { data, error } = await supabase.from("crm_deal_notes").select("*").eq("deal_id", dealId).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function upsertDealNote(
  dealId: string,
  payload: {
    contentHtml: string;
    contentText: string;
    attachments: DealNoteAttachment[];
    lastEditedBy?: string;
  },
): Promise<DealNoteDocument> {
  const { data, error } = await db
    .from("crm_deal_notes")
    .upsert(
      {
        deal_id: dealId,
        content_html: payload.contentHtml,
        content_text: payload.contentText,
        attachments: payload.attachments,
        last_edited_by: payload.lastEditedBy || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "deal_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function uploadDealNoteAttachment(file: File, dealId: string): Promise<DealNoteAttachment> {
  const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  if (!workspaceId) throw new Error("Selecione um workspace antes de enviar um arquivo.");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente para enviar o arquivo.");

  const formData = new FormData();
  formData.append("file", file, file.name || `deal-file-${Date.now()}`);
  formData.append("workspaceId", workspaceId);

  const response = await fetch(`${FUNCTIONS_BASE}/upload-anexo`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Erro ao enviar arquivo para o armazenamento");
  }

  // Guarda-se o caminho real no bucket, nunca uma URL assinada: ela vale 1 hora e viraria link
  // morto. A URL é assinada na hora de abrir.
  if (!data?.path) {
    throw new Error("Caminho do arquivo não foi retornado pelo upload");
  }

  return {
    name: file.name,
    path: data.path,
    size: file.size,
    type: file.type,
  };
}

/**
 * Link temporário para abrir um anexo. Vale uma hora e não é guardado em lugar nenhum.
 *
 * O bucket é privado e sem policy: quem assina é a Edge Function, que confere se quem pediu alcança
 * aquele workspace e se o caminho pertence a ele.
 */
export async function getAttachmentSignedUrl(path: string): Promise<string> {
  const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  if (!workspaceId) throw new Error("Selecione um workspace para abrir o arquivo.");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente para abrir o arquivo.");

  const response = await fetch(`${FUNCTIONS_BASE}/storage-signed-url`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path, workspaceId }),
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok || !data?.url) {
    throw new Error(data?.error || "Não foi possível abrir o arquivo.");
  }

  return data.url as string;
}
