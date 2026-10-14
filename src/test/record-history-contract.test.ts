// Contrato do rastro de alteração de contato e empresa (migration base).
// O que estes testes protegem são decisões que, se desfeitas, degradam o rastro
// EM SILÊNCIO — o app continua funcionando e ninguém nota até a próxima
// investigação chegar sem dado.
import { describe, expect, it } from "vitest";
import { BASE, comandosDasPolicies, constraints, funcao, gatilhos, policies } from "./baseMigration";

describe("updated_at de contatos e empresas", () => {
  it("liga o trigger BEFORE UPDATE nas duas tabelas do CRM", () => {
    expect(gatilhos("public.crm_contacts").join("\n")).toMatch(/BEFORE UPDATE ON public\.crm_contacts .*update_updated_at_column/);
    expect(gatilhos("public.crm_companies").join("\n")).toMatch(/BEFORE UPDATE ON public\.crm_companies .*update_updated_at_column/);
  });
});

describe("tabela de histórico", () => {
  const LOG = funcao("public.log_crm_record_change");

  it("mantém RLS ligada na tabela de histórico", () => {
    expect(BASE).toContain("ALTER TABLE public.crm_record_history ENABLE ROW LEVEL SECURITY");
  });

  it("é append-only: só policy de SELECT", () => {
    expect(comandosDasPolicies("public.crm_record_history")).toEqual(["SELECT"]);
  });

  it("a leitura exige ser membro do workspace, não só o cabeçalho do navegador", () => {
    // O cabeçalho x-workspace-id é escrito pelo cliente; sozinho, deixava outra organização ler o
    // antes/depois de nome, telefone, e-mail e documento (medido em 14/10/2026).
    const [leitura] = policies("public.crm_record_history");
    expect(leitura).toContain("private.current_user_can_access_workspace");
  });

  it("não cria foreign key para as tabelas de origem", () => {
    // A lixeira faz DELETE físico; uma FK com CASCADE apagaria o histórico de
    // quem mais interessa investigar.
    expect(constraints("public.crm_record_history").join("\n")).not.toMatch(/FOREIGN KEY/);
  });

  it("a função de log é SECURITY DEFINER com search_path fixo", () => {
    // Sem isso a RLS bloqueia o INSERT do trigger para usuário comum e toda
    // edição de contato passa a falhar.
    expect(LOG).toMatch(/SECURITY DEFINER/);
    expect(LOG).toMatch(/SET search_path TO 'public'/);
  });

  it("ignora updated_at no diff", () => {
    // updated_at muda em toda edição por causa do outro trigger: registrá-lo
    // encheria 100% do histórico de ruído.
    expect(LOG).toMatch(/campos_ignorados\s+CONSTANT\s+TEXT\[\]\s*:=\s*ARRAY\['updated_at'\]/);
  });

  it("não grava linha quando nada mudou de fato", () => {
    expect(LOG).toMatch(/IF diff = '\{\}'::jsonb THEN\s*\n\s*RETURN NULL;/);
  });

  it("registra o autor e a operação", () => {
    expect(LOG).toContain("auth.uid()");
    expect(LOG).toContain("TG_OP");
    expect(LOG).toContain("TG_TABLE_NAME");
  });

  it("dispara AFTER UPDATE nas duas tabelas", () => {
    expect(gatilhos("public.crm_contacts").join("\n")).toMatch(/AFTER UPDATE ON public\.crm_contacts .*log_crm_record_change/);
    expect(gatilhos("public.crm_companies").join("\n")).toMatch(/AFTER UPDATE ON public\.crm_companies .*log_crm_record_change/);
  });

  it("guarda o valor anterior e o novo de cada campo", () => {
    // Só o campo alterado, sem o de/para, não responde a pergunta que motivou o rastro.
    expect(LOG).toMatch(/jsonb_build_object\('de',\s*antes -> campo,\s*'para',\s*depois -> campo\)/);
  });
});
