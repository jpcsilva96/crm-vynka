// Contrato do vínculo contato x empresa (contato em mais de uma empresa), na migration base.
//
// Mesmo espírito de record-history-contract.test.ts: o que está aqui são decisões
// que, se desfeitas, degradam EM SILÊNCIO — o app continua funcionando, ninguém
// nota, e o preço só aparece na próxima investigação. O comportamento executado
// (RLS, gatilhos) é ensaiado contra o banco por scripts/ensaio-banco.mjs.
import { describe, expect, it } from "vitest";
import { BASE, comandosDasPolicies, constraints, funcao, gatilhos, policies } from "./baseMigration";

// Só o SQL que o Postgres executa: os corpos de função explicam no comentário o que
// foi DESCARTADO, e uma asserção de ausência pegaria a explicação em vez do código.
const semComentarios = (sql: string) =>
  sql
    .split("\n")
    .filter((linha) => !linha.trim().startsWith("--"))
    .join("\n");

describe("tabela de vínculos", () => {
  it("mantém RLS ligada", () => {
    expect(BASE).toContain("ALTER TABLE public.crm_contact_companies ENABLE ROW LEVEL SECURITY");
  });

  it("tem policy para SELECT, INSERT e DELETE — e nenhuma de UPDATE", () => {
    // A tabela é só PK composta mais campos derivados: mudar um vínculo é
    // apagar e criar outro. Uma policy de UPDATE abriria caminho para reescrever
    // vínculo sem passar pelo trigger de auditoria.
    expect(comandosDasPolicies("public.crm_contact_companies")).toEqual(["DELETE", "INSERT", "SELECT"]);
  });

  it("toda policy recorta o workspace aberto E exige ser membro dele", () => {
    // Só o cabeçalho x-workspace-id (escrito pelo navegador) deixava outra organização ler os
    // vínculos alheios forjando o cabeçalho (medido em 14/10/2026).
    const todas = policies("public.crm_contact_companies");
    expect(todas).toHaveLength(3);
    for (const p of todas) {
      expect(p).toContain("current_workspace_id()");
      expect(p).toContain("private.current_user_can_access_workspace");
    }
  });

  it("o trigger de sincronia NÃO apaga o vínculo anterior", () => {
    // Trocar a empresa principal de A para B deixa o contato vinculado a A e a B.
    // Um DELETE aqui destruiria a informação que o vínculo existe para preservar.
    expect(semComentarios(funcao("public.sync_contact_primary_company"))).not.toMatch(
      /DELETE\s+FROM\s+public\.crm_contact_companies/i,
    );
  });

  it("a função de sincronia é SECURITY DEFINER com search_path fixo", () => {
    const fn = funcao("public.sync_contact_primary_company");
    expect(fn).toMatch(/SECURITY DEFINER/);
    expect(fn).toMatch(/SET search_path TO 'public'/);
  });

  it("as duas foreign keys apagam o vínculo em cascata", () => {
    const fks = constraints("public.crm_contact_companies").join("\n");
    expect(fks).toMatch(/FOREIGN KEY \(contact_id\) REFERENCES crm_contacts\(id\) ON DELETE CASCADE/);
    expect(fks).toMatch(/FOREIGN KEY \(company_id\) REFERENCES crm_companies\(id\) ON DELETE CASCADE/);
  });
});

describe("auditoria dos vínculos", () => {
  const LOG = funcao("public.log_contact_company_link_change");

  it("o CHECK de table_name aceita a tabela de vínculos", () => {
    expect(constraints("public.crm_record_history").join("\n")).toMatch(
      /table_name = ANY \(ARRAY\['crm_contacts'::text, 'crm_companies'::text, 'crm_contact_companies'::text\]\)/,
    );
  });

  it("registra INSERT e DELETE", () => {
    // UPDATE não existe nesta tabela; INSERT sem DELETE registraria só metade da
    // história, e é o desvínculo que some sem deixar rastro.
    expect(gatilhos("public.crm_contact_companies").join("\n")).toContain(
      "AFTER INSERT OR DELETE ON public.crm_contact_companies",
    );
  });

  it("não usa COALESCE(NEW, OLD)", () => {
    // Com row types isso depende de resolução de tipo polimórfico e falha conforme
    // a versão — e aqui não há como descobrir antes da hora do socorro.
    expect(semComentarios(LOG)).not.toMatch(/COALESCE\s*\(\s*NEW\s*,\s*OLD\s*\)/i);
    expect(LOG).toMatch(/IF TG_OP = 'DELETE' THEN\s+linha := OLD;/);
  });

  it("guarda o nome da empresa junto do id", () => {
    // O id sozinho não diz nada numa investigação futura: a empresa pode ter sido
    // renomeada ou apagada desde então.
    expect(LOG).toMatch(/'company_name', to_jsonb\(nome_empresa\)/);
  });

  it("a função de log é SECURITY DEFINER com search_path fixo", () => {
    expect(LOG).toMatch(/SECURITY DEFINER/);
    expect(LOG).toMatch(/SET search_path TO 'public'/);
  });
});
