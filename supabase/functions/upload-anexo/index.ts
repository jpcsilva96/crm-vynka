import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildUploadPath, jsonResponse, requireWorkspaceUpload, validateUpload } from "../_shared/uploadAuth.ts";

/**
 * Recebe um anexo de negociação e o grava no bucket privado `anexos`.
 *
 * Devolve só o CAMINHO do arquivo: o banco guarda o caminho, e o link de leitura é assinado na hora
 * de abrir pela `storage-signed-url`. URL assinada gravada no banco expira e vira link morto.
 */

const BUCKET = "anexos";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Método não permitido" }, corsHeaders);
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const workspaceId = String(formData.get("workspaceId") || "");
    if (!(file instanceof File)) return jsonResponse(400, { error: "Arquivo não informado" }, corsHeaders);
    const serviceClient = await requireWorkspaceUpload(req, workspaceId);
    const contentType = validateUpload(file);
    const folder = contentType.startsWith("image/") ? "imagens" : "documentos";
    const path = buildUploadPath(workspaceId, file, folder);
    const { error } = await serviceClient.storage.from(BUCKET).upload(path, file, { contentType, upsert: false });
    if (error) throw error;
    return jsonResponse(200, { path }, corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar arquivo";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 400;
    return jsonResponse(status, { error: message }, corsHeaders);
  }
});
