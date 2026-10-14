#!/usr/bin/env node
/**
 * Ensaio do banco (RULES.md §6): aplica as migrations PENDENTES numa transação, exerce o
 * comportamento que importa como um usuário do app (papel `authenticated`, RLS valendo) e termina
 * SEMPRE em ROLLBACK. Nada fica gravado.
 *
 * Pendente = arquivo em supabase/migrations cuja versão não está em
 * supabase_migrations.schema_migrations. Num banco vazio, isso é a migration base inteira.
 *
 * Uso (as variáveis vêm do .env.local, que não vai para o git):
 *   set -a; . ./.env.local; set +a
 *   node scripts/ensaio-banco.mjs
 *
 * Exige: SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD, SUPABASE_POOLER_HOST.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(RAIZ, "supabase", "migrations");

const { SUPABASE_PROJECT_REF: ref, SUPABASE_DB_PASSWORD: password, SUPABASE_POOLER_HOST: host } = process.env;
if (!ref || !password || !host) {
  console.error("Defina SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD e SUPABASE_POOLER_HOST (ver .env.local).");
  process.exit(1);
}

// Porta 5432 = session pooler: uma sessão por conexão, então BEGIN/ROLLBACK valem para tudo.
const c = new pg.Client({
  host, port: 5432, user: `postgres.${ref}`, password, database: "postgres",
  ssl: { rejectUnauthorized: false }, statement_timeout: 120000,
});
const q = (sql, params) => c.query(sql, params);

// Identificadores fixos e fictícios; tudo some no ROLLBACK.
const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const WS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WS_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "a0000000-0000-4000-8000-00000000000a";
const USER_B = "b0000000-0000-4000-8000-00000000000b";
const VEND = "d0000000-0000-4000-8000-00000000000d";

const resultados = [];
const confere = (nome, ok, detalhe = "") => resultados.push({ nome, ok: Boolean(ok), detalhe });

/** Roda `fn` como um usuário logado do app: papel authenticated, claims do JWT e workspace no cabeçalho. */
async function comoUsuario(userId, email, workspaceId, fn) {
  await q("SAVEPOINT como_usuario");
  await q("SET LOCAL ROLE authenticated");
  await q("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, email, role: "authenticated" })]);
  await q("SELECT set_config('request.headers', $1, true)", [JSON.stringify({ "x-workspace-id": workspaceId })]);
  try {
    const out = await fn();
    await q("RESET ROLE");
    await q("RELEASE SAVEPOINT como_usuario");
    return out;
  } catch (e) {
    await q("ROLLBACK TO SAVEPOINT como_usuario");
    await q("RESET ROLE");
    await q("RELEASE SAVEPOINT como_usuario");
    throw e;
  }
}

async function criaUsuario(id, email, meta) {
  await q(
    `INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
     VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, $3::jsonb, now(), now())`,
    [id, email, JSON.stringify(meta)],
  );
}

async function pendentes() {
  const existe = (await q("SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS ok")).rows[0].ok;
  const aplicadas = existe
    ? new Set((await q("SELECT version FROM supabase_migrations.schema_migrations")).rows.map((r) => r.version))
    : new Set();
  return readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort().filter((f) => !aplicadas.has(f.split("_")[0]));
}

async function ensaio() {
  // 1. organização + workspace -> funil padrão e prefixo
  await q("INSERT INTO public.organizations (id, name) VALUES ($1, 'Ensaio A'), ($2, 'Ensaio B')", [ORG_A, ORG_B]);
  await q("INSERT INTO public.workspaces (id, name, organization_id) VALUES ($1, 'Ensaio A', $2), ($3, 'Ensaio B', $4)", [WS_A, ORG_A, WS_B, ORG_B]);
  const pipes = (await q("SELECT count(*)::int n FROM public.crm_pipelines WHERE workspace_id::text = $1", [WS_A])).rows[0].n;
  const etapas = (await q("SELECT count(*)::int n FROM public.crm_pipeline_stages WHERE workspace_id::text = $1", [WS_A])).rows[0].n;
  confere("workspace novo ganha pipelines e etapas", pipes > 0 && etapas > 0, `${pipes} pipelines, ${etapas} etapas`);
  const prefixo = (await q("SELECT deal_code_prefix FROM public.workspaces WHERE id = $1", [WS_A])).rows[0].deal_code_prefix;
  confere("prefixo padrão do workspace é VYN", prefixo === "VYN", prefixo);

  // 2. usuário no auth -> perfil
  const meta = (org, ws, papel) => ({ name: "Ensaio", roleId: papel, organizationId: org, workspaces: [ws] });
  await criaUsuario(USER_A, "ensaio-a@exemplo.com", meta(ORG_A, WS_A, "admin"));
  await criaUsuario(USER_B, "ensaio-b@exemplo.com", meta(ORG_B, WS_B, "admin"));
  await criaUsuario(VEND, "ensaio-v@exemplo.com", meta(ORG_A, WS_A, "vendedor"));
  const perfil = (await q("SELECT role_id, organization_id::text, workspaces FROM public.profiles WHERE id = $1", [USER_A])).rows[0];
  confere("usuário novo ganha perfil com papel, organização e workspace",
    perfil?.role_id === "admin" && perfil?.organization_id === ORG_A && perfil?.workspaces?.[0] === WS_A, JSON.stringify(perfil));

  // 3. negociação com código sequencial, criada sob RLS
  const pipeline = (await q("SELECT id FROM public.crm_pipelines WHERE workspace_id::text = $1 ORDER BY created_at LIMIT 1", [WS_A])).rows[0].id;
  const codigo = await comoUsuario(USER_A, "ensaio-a@exemplo.com", WS_A, async () => {
    await q("INSERT INTO public.crm_contacts (workspace_id, name, phone) VALUES ($1, 'Contato Um', '11999990000')", [WS_A]);
    return (await q(`INSERT INTO public.crm_deals (workspace_id, pipeline_id, contact_name, phone, stage, value)
                     VALUES ($1, $2, 'Contato Um', '11999990000', 'leads', 100) RETURNING deal_code`, [WS_A, pipeline])).rows[0].deal_code;
  });
  confere("negociação recebe código VYN-1", codigo === "VYN-1", codigo);

  // 4. telefone duplicado
  let dup = null;
  try {
    await comoUsuario(USER_A, "ensaio-a@exemplo.com", WS_A, () =>
      q("INSERT INTO public.crm_contacts (workspace_id, name, phone) VALUES ($1, 'Contato Dois', '(11) 99999-0000')", [WS_A]));
  } catch (e) { dup = e.message; }
  confere("contato com telefone duplicado é recusado", dup, dup || "aceitou o duplicado");

  // 5. isolamento entre organizações (com braço positivo)
  const visto = await comoUsuario(USER_B, "ensaio-b@exemplo.com", WS_A, async () => ({
    deals: (await q("SELECT count(*)::int n FROM public.crm_deals")).rows[0].n,
    contatos: (await q("SELECT count(*)::int n FROM public.crm_contacts")).rows[0].n,
    workspaces: (await q("SELECT count(*)::int n FROM public.workspaces WHERE id = $1", [WS_A])).rows[0].n,
    perfis: (await q("SELECT count(*)::int n FROM public.profiles WHERE organization_id = $1", [ORG_A])).rows[0].n,
  }));
  confere("outra organização não vê negociações, contatos, workspace nem perfis",
    Object.values(visto).every((n) => n === 0), JSON.stringify(visto));
  const colegas = await comoUsuario(VEND, "ensaio-v@exemplo.com", WS_A, async () =>
    (await q("SELECT count(*)::int n FROM public.profiles WHERE organization_id = $1", [ORG_A])).rows[0].n);
  confere("braço positivo: vendedor vê os colegas da própria organização", colegas === 2, String(colegas));

  // 6. privilégio: vendedor não se promove nem apaga workspace; admin edita
  const promo = await comoUsuario(VEND, "ensaio-v@exemplo.com", WS_A, async () =>
    (await q("UPDATE public.profiles SET role_id = 'master' WHERE id = $1", [VEND])).rowCount);
  confere("vendedor não muda o próprio papel", promo === 0, `linhas=${promo}`);
  const apagou = await comoUsuario(VEND, "ensaio-v@exemplo.com", WS_A, async () =>
    (await q("DELETE FROM public.workspaces WHERE id = $1", [WS_A])).rowCount);
  confere("vendedor não apaga o workspace", apagou === 0, `linhas=${apagou}`);
  const editou = await comoUsuario(USER_A, "ensaio-a@exemplo.com", WS_A, async () =>
    (await q("UPDATE public.workspaces SET color = '#000000' WHERE id = $1", [WS_A])).rowCount);
  confere("braço positivo: admin da organização edita o workspace", editou === 1, `linhas=${editou}`);
  const codigo2 = await comoUsuario(VEND, "ensaio-v@exemplo.com", WS_A, async () =>
    (await q(`INSERT INTO public.crm_deals (workspace_id, pipeline_id, contact_name, phone, stage, value, assigned_to)
              VALUES ($1, $2, 'Contato Três', '11988887777', 'leads', 50, $3) RETURNING deal_code`, [WS_A, pipeline, VEND])).rows[0].deal_code);
  confere("vendedor cria negociação e recebe VYN-2", codigo2 === "VYN-2", codigo2);

  // 7. histórico e vínculos: o cabeçalho do navegador não abre workspace alheio
  await comoUsuario(USER_A, "ensaio-a@exemplo.com", WS_A, async () => {
    const emp = await q("INSERT INTO public.crm_companies (workspace_id, name) VALUES ($1, 'Empresa A') RETURNING id", [WS_A]);
    await q("UPDATE public.crm_contacts SET company_id = $1, email = 'novo@exemplo.com' WHERE workspace_id = $2", [emp.rows[0].id, WS_A]);
  });
  const leitura = async (id, email) => comoUsuario(id, email, WS_A, async () => ({
    historico: (await q("SELECT count(*)::int n FROM public.crm_record_history")).rows[0].n,
    vinculos: (await q("SELECT count(*)::int n FROM public.crm_contact_companies")).rows[0].n,
  }));
  const doDono = await leitura(USER_A, "ensaio-a@exemplo.com");
  confere("braço positivo: dono lê histórico e vínculos do próprio workspace", doDono.historico > 0 && doDono.vinculos > 0, JSON.stringify(doDono));
  const alheio = await leitura(USER_B, "ensaio-b@exemplo.com");
  confere("outra organização, forjando o cabeçalho, não lê histórico nem vínculos", alheio.historico === 0 && alheio.vinculos === 0, JSON.stringify(alheio));
}

try {
  await c.connect();
  await q("BEGIN");
  const arquivos = await pendentes();
  for (const f of arquivos) {
    await q(readFileSync(join(MIGRATIONS, f), "utf8"));
    console.log(`aplicada (na transação): ${f}`);
  }
  if (arquivos.length === 0) console.log("nenhuma migration pendente; ensaiando o schema atual");
  await ensaio();
} catch (e) {
  console.error("ERRO:", e.message);
  process.exitCode = 1;
} finally {
  await q("ROLLBACK").catch(() => {});
  for (const r of resultados) console.log(`${r.ok ? "OK   " : "FALHA"} ${r.nome}${r.detalhe ? ` — ${r.detalhe}` : ""}`);
  if (resultados.some((r) => !r.ok)) process.exitCode = 1;
  console.log("ROLLBACK feito: nada foi gravado.");
  await c.end().catch(() => {});
}
