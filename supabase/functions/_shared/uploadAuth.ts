import { createServiceClient, createUserClient } from "./supabase.ts";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SAFE_FILE_NAME = /[^a-zA-Z0-9._-]/g;

export function jsonResponse(status: number, payload: Record<string, unknown>, corsHeaders: HeadersInit) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function requireWorkspaceUpload(req: Request, workspaceId: string) {
  if (!workspaceId) throw new Error("workspaceId é obrigatório");
  const userClient = createUserClient(req);
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) throw new Error("UNAUTHORIZED");

  const serviceClient = createServiceClient();
  const [{ data: profile, error: profileError }, { data: workspace, error: workspaceError }] = await Promise.all([
    serviceClient.from("profiles").select("organization_id, role_id, workspaces").eq("id", user.id).maybeSingle(),
    serviceClient.from("workspaces").select("id, organization_id").eq("id", workspaceId).maybeSingle(),
  ]);
  if (profileError || workspaceError || !profile || !workspace) throw new Error("FORBIDDEN");

  const { data: role } = await serviceClient.from("roles").select("is_master").eq("id", profile.role_id).maybeSingle();
  const allowedWorkspaces = Array.isArray(profile.workspaces) ? profile.workspaces.map(String) : [];
  const isAllowed = Boolean(role?.is_master) || (
    profile.organization_id === workspace.organization_id &&
    (allowedWorkspaces.includes("all") || allowedWorkspaces.includes(workspaceId))
  );
  if (!isAllowed) throw new Error("FORBIDDEN");
  return serviceClient;
}

export function validateUpload(file: File) {
  if (!file || file.size <= 0) throw new Error("Arquivo inválido");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("O arquivo excede o limite de 10 MB");
  const type = file.type || "application/octet-stream";
  const allowed = type.startsWith("image/") || /pdf|document|presentation|msword|officedocument/.test(type);
  if (!allowed) throw new Error("Tipo de arquivo não permitido");
  return type;
}

export function buildUploadPath(workspaceId: string, file: File, folder: string) {
  const safeName = (file.name || "upload").replace(SAFE_FILE_NAME, "_").slice(-120);
  return `workspaces/${workspaceId}/${folder}/${crypto.randomUUID()}-${safeName}`;
}
