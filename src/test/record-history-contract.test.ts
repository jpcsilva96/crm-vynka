// Contrato das migrations da Fase 2 (rastro de alteração de contato e empresa).
// O que estes testes protegem são decisões que, se desfeitas, degradam o rastro
// EM SILÊNCIO — o app continua funcionando e ninguém nota até a próxima
// investigação chegar sem dado, que é exatamente o que aconteceu em 03/09/2026.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migration = (nome: string) =>
  readFileSync(resolve(here, "../../supabase/migrations", nome), "utf8");

const UPDATED_AT = migration("20260903160000_add_updated_at_to_crm_contacts_and_companies.sql");
const HISTORY = migration("20260903161000_add_crm_record_history.sql");

describe("migration do updated_at", () => {
  it("faz backfill a partir de created_at, não de NOW()", () => {
    // NOW() afirmaria que toda linha existente mudou no dia da migration.
    expect(UPDATED_AT).toContain("SET updated_at = created_at");
    expect(UPDATED_AT).not.toMatch(/SET updated_at = NOW\(\)/i);
  });

  it("cria os triggers DEPOIS do backfill", () => {
    // Ordem inversa faria o próprio UPDATE de backfill gravar NOW().
    const backfill = UPDATED_AT.indexOf("SET updated_at = created_at");
    const primeiroTrigger = UPDATED_AT.indexOf("CREATE TRIGGER");
    expect(backfill).toBeGreaterThan(-1);
    expect(primeiroTrigger).toBeGreaterThan(backfill);
  });

  it("liga o trigger nas duas tabelas do CRM", () => {
    expect(UPDATED_AT).toContain("BEFORE UPDATE ON public.crm_contacts");
    expect(UPDATED_AT).toContain("BEFORE UPDATE ON public.crm_companies");
  });
});

describe("migration do histórico", () => {
  it("mantém RLS ligada na tabela de histórico", () => {
    expect(HISTORY).toContain("ALTER TABLE public.crm_record_history ENABLE ROW LEVEL SECURITY");
  });

  it("é append-only: só policy de SELECT", () => {
    const policies = HISTORY.match(/CREATE POLICY[\s\S]*?FOR (\w+)/g) ?? [];
    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatch(/FOR SELECT/);
  });

  it("não cria foreign key para as tabelas de origem", () => {
    // A lixeira faz DELETE físico; uma FK com CASCADE apagaria o histórico de
    // quem mais interessa investigar.
    expect(HISTORY).not.toMatch(/REFERENCES\s+public\.crm_(contacts|companies)/i);
  });

  it("a função de log é SECURITY DEFINER", () => {
    // Sem isso a RLS bloqueia o INSERT do trigger para usuário comum e toda
    // edição de contato passa a falhar.
    const fn = HISTORY.slice(HISTORY.indexOf("CREATE OR REPLACE FUNCTION public.log_crm_record_change"));
    expect(fn).toMatch(/SECURITY DEFINER/);
    expect(fn).toMatch(/SET search_path = public/);
  });

  it("ignora updated_at no diff", () => {
    // updated_at muda em toda edição por causa do outro trigger: registrá-lo
    // encheria 100% do histórico de ruído.
    expect(HISTORY).toMatch(/campos_ignorados\s+CONSTANT\s+TEXT\[\]\s*:=\s*ARRAY\['updated_at'\]/);
  });

  it("não grava linha quando nada mudou de fato", () => {
    expect(HISTORY).toMatch(/IF diff = '\{\}'::jsonb THEN\s*\n\s*RETURN NULL;/);
  });

  it("registra o autor e a operação", () => {
    expect(HISTORY).toContain("auth.uid()");
    expect(HISTORY).toContain("TG_OP");
    expect(HISTORY).toContain("TG_TABLE_NAME");
  });

  it("dispara AFTER UPDATE nas duas tabelas", () => {
    expect(HISTORY).toContain("AFTER UPDATE ON public.crm_contacts");
    expect(HISTORY).toContain("AFTER UPDATE ON public.crm_companies");
  });

  it("guarda o valor anterior e o novo de cada campo", () => {
    // Só o campo alterado, sem o de/para, não responde a pergunta que motivou a fase.
    expect(HISTORY).toMatch(/jsonb_build_object\('de',\s*antes -> campo,\s*'para',\s*depois -> campo\)/);
  });
});
