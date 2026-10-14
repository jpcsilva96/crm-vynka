import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsonResponse, requireWorkspaceUpload } from "../_shared/uploadAuth.ts";

/**
 * Assina, sob demanda, o link de um arquivo do bucket privado `anexos`.
 *
 * O bucket não tem policy nenhuma: só o service role o alcança. Gravar no banco a URL assinada não
 * serve, porque ela vale 1 hora e vira link morto.
 *
 * Por isso o banco guarda apenas o CAMINHO do arquivo, e o link nasce na hora de abrir: vive uma hora e
 * ninguém o guarda. Quem pede precisa estar autenticado e alcançar o workspace — a mesma validação
 * do upload — e o caminho pedido precisa pertencer àquele workspace.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const URL_TTL_SECONDS = 3600;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Método não permitido" }, corsHeaders);

  try {
    const body = await req.json().catch(() => ({}));
    const path = String(body?.path || "");
    const workspaceId = String(body?.workspaceId || "");

    if (!path) return jsonResponse(400, { error: "path é obrigatório" }, corsHeaders);

    // Ter acesso ao workspace não pode virar acesso ao workspace do vizinho: o caminho pedido tem
    // de estar dentro da pasta daquele workspace, e não pode escapar dela por "..".
    const prefixoDoWorkspace = `workspaces/${workspaceId}/`;
    if (!path.startsWith(prefixoDoWorkspace) || path.includes("..")) {
      return jsonResponse(403, { error: "FORBIDDEN" }, corsHeaders);
    }

    const serviceClient = await requireWorkspaceUpload(req, workspaceId);

    const { data, error } = await serviceClient.storage
      .from("anexos")
      .createSignedUrl(path, URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      return jsonResponse(404, { error: "Arquivo não encontrado ou indisponível" }, corsHeaders);
    }

    return jsonResponse(200, { url: data.signedUrl, expiresIn: URL_TTL_SECONDS }, corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar acesso ao arquivo";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 400;
    return jsonResponse(status, { error: message }, corsHeaders);
  }
});
