// Contrato das migrations da Fase 4 (contato em mais de uma empresa).
//
// Mesmo espírito de record-history-contract.test.ts: o que está aqui são decisões
// que, se desfeitas, degradam EM SILÊNCIO — o app continua funcionando, ninguém
// nota, e o preço só aparece na próxima investigação. Teste textual de propósito;
// não há Postgres descartável neste projeto para testar a migration executando
// (ata de 03/09, A1).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migration = (nome: string) =>
  readFileSync(resolve(here, "../../supabase/migrations", nome), "utf8");

const VINCULOS = migration("20260904120000_add_crm_contact_companies.sql");
const AUDITORIA = migration("20260904140000_audit_crm_contact_companies.sql");

// Só o SQL que o Postgres executa. Necessário porque as migrations deste projeto
// explicam no comentário o que foi DESCARTADO, e uma asserção de ausência pegaria
// justamente a explicação em vez do código.
const semComentarios = (sql: string) =>
  sql
    .split("\n")
    .filter((linha) => !linha.trim().startsWith("--"))
    .join("\n");

describe("migration da tabela de vínculos", () => {
  it("mantém RLS ligada", () => {
    expect(VINCULOS).toContain("ALTER TABLE public.crm_contact_companies ENABLE ROW LEVEL SECURITY");
  });

  it("tem policy para SELECT, INSERT e DELETE — e nenhuma de UPDATE", () => {
    // A tabela é só PK composta mais dois campos derivados: mudar um vínculo é
    // apagar e criar outro. Uma policy de UPDATE abriria caminho para reescrever
    // vínculo sem passar pelo trigger de auditoria.
    const policies = VINCULOS.match(/FOR (SELECT|INSERT|DELETE|UPDATE)/g) || [];
    expect(policies.sort()).toEqual(["FOR DELETE", "FOR INSERT", "FOR SELECT"]);
  });

  it("toda policy usa o workspace do usuário", () => {
    const condicoes = VINCULOS.match(/workspace_id::text = public\.current_workspace_id\(\)/g) || [];
    expect(condicoes.length).toBe(3);
  });

  it("o trigger de sincronia NÃO apaga o vínculo anterior", () => {
    // Trocar a empresa principal de A para B deixa o contato vinculado a A e a B.
    // É o que preserva a informação que o defeito de 02/09 destruía. Um DELETE
    // aqui transformaria a Fase 4 no mesmo bug com outro nome.
    const fn = semComentarios(VINCULOS.slice(VINCULOS.indexOf("FUNCTION public.sync_contact_primary_company")));
    expect(fn).not.toMatch(/DELETE\s+FROM\s+public\.crm_contact_companies/i);
  });

  it("a função de sincronia é SECURITY DEFINER com search_path fixo", () => {
    const fn = VINCULOS.slice(VINCULOS.indexOf("FUNCTION public.sync_contact_primary_company"));
    expect(fn).toMatch(/SECURITY DEFINER/);
    expect(fn).toMatch(/SET search_path = public/);
  });

  it("o backfill é idempotente", () => {
    expect(VINCULOS).toMatch(/ON CONFLICT DO NOTHING/i);
  });

  it("o backfill inclui contato na lixeira", () => {
    // Restaurar da lixeira é UPDATE de deleted_at, que não passa pelo trigger (ele
    // só olha company_id). Filtrar aqui faria o contato voltar sem os vínculos.
    const backfill = semComentarios(VINCULOS.slice(VINCULOS.indexOf("INSERT INTO public.crm_contact_companies")));
    expect(backfill).not.toMatch(/deleted_at\s+IS\s+NULL/i);
  });

  it("as duas foreign keys apagam o vínculo em cascata", () => {
    expect(VINCULOS).toMatch(/REFERENCES public\.crm_contacts\(id\)\s+ON DELETE CASCADE/);
    expect(VINCULOS).toMatch(/REFERENCES public\.crm_companies\(id\)\s+ON DELETE CASCADE/);
  });
});

describe("migration da auditoria dos vínculos", () => {
  it("o CHECK de table_name passa a aceitar a tabela de vínculos", () => {
    expect(AUDITORIA).toMatch(/CHECK \(table_name IN \('crm_contacts', 'crm_companies', 'crm_contact_companies'\)\)/);
  });

  it("registra INSERT e DELETE", () => {
    // UPDATE não existe nesta tabela; INSERT sem DELETE registraria só metade da
    // história, e é o desvínculo que some sem deixar rastro.
    expect(AUDITORIA).toContain("AFTER INSERT OR DELETE ON public.crm_contact_companies");
  });

  it("não usa COALESCE(NEW, OLD)", () => {
    // Com row types isso depende de resolução de tipo polimórfico e falha conforme
    // a versão — e aqui não há como descobrir antes da hora do socorro.
    expect(semComentarios(AUDITORIA)).not.toMatch(/COALESCE\s*\(\s*NEW\s*,\s*OLD\s*\)/i);
    expect(AUDITORIA).toMatch(/IF TG_OP = 'DELETE' THEN\s+linha := OLD;/);
  });

  it("guarda o nome da empresa junto do id", () => {
    // O id sozinho não diz nada numa investigação futura: a empresa pode ter sido
    // renomeada ou apagada desde então.
    expect(AUDITORIA).toMatch(/'company_name', to_jsonb\(nome_empresa\)/);
  });

  it("a função de log é SECURITY DEFINER com search_path fixo", () => {
    const fn = AUDITORIA.slice(AUDITORIA.indexOf("FUNCTION public.log_contact_company_link_change"));
    expect(fn).toMatch(/SECURITY DEFINER/);
    expect(fn).toMatch(/SET search_path = public/);
  });

  it("o backfill do histórico não inventa autoria", () => {
    // changed_by NULL é "existe desde esta data, autor desconhecido". Atribuir um
    // usuário qualquer seria pior do que não ter autoria nenhuma.
    const backfill = AUDITORIA.slice(AUDITORIA.indexOf("INSERT INTO public.crm_record_history"));
    expect(backfill).toMatch(/'INSERT',\s*\n\s*NULL,/);
  });

  it("o backfill do histórico é idempotente", () => {
    const backfill = AUDITORIA.slice(AUDITORIA.indexOf("INSERT INTO public.crm_record_history"));
    expect(backfill).toMatch(/WHERE NOT EXISTS/i);
  });

  it("o backfill usa o created_at do vínculo, não NOW()", () => {
    // NOW() afirmaria que todo vínculo nasceu no dia da migration, o que é falso
    // para os 53 do backfill anterior.
    const backfill = AUDITORIA.slice(AUDITORIA.indexOf("INSERT INTO public.crm_record_history"));
    expect(backfill).toContain("l.created_at");
    expect(backfill).not.toMatch(/NOW\(\)/i);
  });
});
