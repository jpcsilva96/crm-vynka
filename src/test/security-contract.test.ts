import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readProjectFile(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

function projectPathExists(path: string) {
  return existsSync(resolve(root, path));
}

describe("security contract", () => {
  it("requires manage-users authorization before creating users with the service role", () => {
    const createUserFunction = readProjectFile("supabase/functions/create-user/index.ts");

    expect(createUserFunction).toContain("canManageUsers");
    expect(createUserFunction).toContain("Not allowed to create users");
    expect(createUserFunction).toContain("Not allowed to assign master role");
    expect(createUserFunction).toContain('.from("profiles")');
    expect(createUserFunction).toContain(".upsert({");
    expect(createUserFunction).toContain("listUsers");
    expect(createUserFunction).toContain("already been registered");
    expect(createUserFunction).toContain("Not allowed to move an existing user into this organization");
    expect(createUserFunction).toContain("Not allowed to update a master user");
    expect(createUserFunction.indexOf("canManageUsers")).toBeLessThan(
      createUserFunction.indexOf("supabaseAdmin.auth.admin.createUser"),
    );
  });

  it("prevents non-master user updates from assigning or editing master users", () => {
    const updateUserFunction = readProjectFile("supabase/functions/update-user/index.ts");

    expect(updateUserFunction).toContain("callerIsMaster");
    expect(updateUserFunction).toContain("Not allowed to assign master role");
    expect(updateUserFunction).toContain("Not allowed to update a master user");
    expect(updateUserFunction.indexOf("currentTargetRole")).toBeLessThan(
      updateUserFunction.indexOf("supabaseAdmin.auth.admin.updateUserById"),
    );
  });

  it("keeps committed local secret scripts out of the repository", () => {
    const gitignore = readProjectFile(".gitignore");

    expect(projectPathExists("create_user.mjs")).toBe(false);
    expect(projectPathExists("apply_layout.cjs")).toBe(false);
    expect(projectPathExists("gerar_excel.ps1")).toBe(false);
    expect(projectPathExists("scratch/update_db_token.js")).toBe(false);
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain("scratch/");
  });

  it("hardens roles and task automation RLS in the pre-production migration", () => {
    const migration = readProjectFile("supabase/migrations/20260723145317_pre_prod_security_hardening.sql");

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_workspace_id()");
    expect(migration).toContain("roles_manageable_by_masters");
    expect(migration).toContain("private.current_user_is_master()");
    expect(migration).toContain("task_automation_rules_workspace_member_access");
    expect(migration).toContain("task_automation_executions_workspace_member_access");
    expect(migration).toContain("private.current_user_can_access_workspace");
    expect(migration).not.toContain("FOR ALL TO public");
  });

  it("routes user deletion through the authorized admin function", () => {
    const usersStore = readProjectFile("src/lib/usersStore.ts");
    const deleteUserFunction = readProjectFile("supabase/functions/delete-user/index.ts");

    expect(usersStore).toContain('supabase.functions.invoke("delete-user"');
    expect(usersStore).not.toContain('.from("profiles").delete().eq("id", id)');
    expect(deleteUserFunction).toContain("canManageUsers");
    expect(deleteUserFunction).toContain("Not allowed to delete this user");
    expect(deleteUserFunction).toContain("Not allowed to delete your own user");
    expect(deleteUserFunction).toContain("supabaseAdmin.auth.admin.deleteUser");
    expect(deleteUserFunction.indexOf("canManageUsers")).toBeLessThan(
      deleteUserFunction.indexOf("supabaseAdmin.auth.admin.deleteUser"),
    );
  });

  it("removes open legacy RLS policies from sensitive browser tables", () => {
    const migration = readProjectFile("supabase/migrations/20260720152156_harden_legacy_rls_and_create_user_auth.sql");

    expect(migration).toContain('DROP POLICY IF EXISTS "Anyone can view channels"');
    expect(migration).toContain("channels owned by authenticated user");
    expect(migration).not.toContain("USING (true)");
    expect(migration).not.toContain("WITH CHECK (true)");
  });

  it("keeps the versioned .env free of secrets", () => {
    // O `.env` e rastreado de proposito: e insumo de build e so carrega valores publicos
    // (URL, project id, chave publicavel), que ja viajam no bundle. Desrastrea-lo derrubaria
    // o CRM, porque 5 modulos leem `import.meta.env.VITE_*` sem fallback. O que precisa de
    // guarda, entao, nao e o rastreamento -- e o CONTEUDO. RULES.md §10.
    const env = readProjectFile(".env");

    // Credenciais de escrita ou de servidor nao podem viver em arquivo versionado.
    expect(env).not.toMatch(/sbp_[A-Za-z0-9]/);          // token da Management API
    expect(env).not.toMatch(/sb_secret_/);               // secret key do Supabase
    expect(env).not.toMatch(/service_role/);             // service role em texto claro
    expect(env).not.toMatch(/SERVICE_ROLE/);

    // Um JWT esconde o papel em base64, entao a busca literal acima passa batido -- foi
    // assim que este mutante sobreviveu na primeira versao do teste. Decodifica e verifica.
    for (const jwt of env.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g) ?? []) {
      const payload = JSON.parse(
        Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"),
      ) as { role?: string };
      expect(payload.role).not.toBe("service_role");
    }
    expect(env).not.toMatch(/PASSWORD\s*=\s*["']?\S/i);  // senha de banco, e-mail ou usuario
    expect(env).not.toMatch(/SECRET\s*=\s*["']?\S/i);

    // O que DEVE estar aqui, senao o build gera um client quebrado.
    expect(env).toContain("VITE_SUPABASE_URL");
    expect(env).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
  });

  it("validates the persisted browser email against the Supabase session", () => {
    const indexPage = readProjectFile("src/pages/Index.tsx");

    expect(indexPage).toContain("supabase.auth.getUser()");
    expect(indexPage).toContain("authenticatedEmail !== userEmail.toLowerCase()");
    expect(indexPage).toContain("clearLocalSession()");
  });

  it("routes first-access profile updates through the authorized user function", () => {
    const loginPage = readProjectFile("src/pages/Login.tsx");

    expect(loginPage).toContain('supabase.functions.invoke("update-user"');
    expect(loginPage).not.toContain('.from("profiles").update({ require_password_change: false })');
  });

  it("hardens organization profile roles and workspace RLS without allowing self privilege edits", () => {
    const migration = readProjectFile("supabase/migrations/20260720153355_harden_core_org_rls.sql");

    expect(migration).toContain("ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY");
    expect(migration).not.toContain("FOR UPDATE TO authenticated\n      USING (\n        id = auth.uid()");
  });

  it("does not silently ignore CRM deal note and task write failures", () => {
    const dealsStore = readProjectFile("src/lib/dealsStore.ts");

    expect(dealsStore).toContain("Error registering deal creation history:");
    expect(dealsStore).toContain("Error linking deal contacts:");
    expect(dealsStore).toContain("Error adding deal note:");
    expect(dealsStore).toContain("Error adding deal task:");
    expect(dealsStore).toContain("Error editing deal task:");
    expect(dealsStore).toContain("Error toggling deal task:");
    expect(dealsStore).toContain("Error completing deal task:");
    expect(dealsStore).toContain("Error cancelling deal task:");
    expect(dealsStore).toContain("Error adding deal history event:");
    expect(dealsStore.match(/set\(\{ deals: previousDeals \}\);/g)?.length ?? 0).toBeGreaterThanOrEqual(10);
  });

  it("sanitizes persisted deal note HTML before rendering or saving", () => {
    const dealNotesTab = readProjectFile("src/components/pipeline/DealNotesTab.tsx");

    expect(dealNotesTab).toContain("sanitizeNoteHtml");
    expect(dealNotesTab).toContain('name.startsWith("on")');
    expect(dealNotesTab).toContain('name === "style"');
    expect(dealNotesTab).toContain("SAFE_LINK_PROTOCOLS");
    expect(dealNotesTab).toContain("sanitizeUrl(attachment.url)");
  });
});
