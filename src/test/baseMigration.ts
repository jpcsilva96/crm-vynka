// Leitura da migration base para os testes de contrato de schema.
//
// A migration base é gerada do catálogo do Postgres (pg_get_functiondef, pg_policies...), então o
// texto segue o formato do Postgres, não o de quem escreveu a origem: `SET search_path TO 'public'`,
// `CREATE POLICY nome ON public.t AS PERMISSIVE FOR SELECT TO authenticated`, e o corpo das funções
// é preservado como foi escrito.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations");
const baseFile = readdirSync(migrationsDir).find((nome) => nome.endsWith("_base_crm_vynka.sql"));
if (!baseFile) throw new Error("migration base não encontrada em supabase/migrations");

export const BASE = readFileSync(resolve(migrationsDir, baseFile), "utf8").split("\r\n").join("\n");

/** Definição completa de uma função, de `CREATE OR REPLACE FUNCTION <nome>(` até o fim do corpo. */
export function funcao(nomeQualificado: string): string {
  const inicio = BASE.indexOf(`CREATE OR REPLACE FUNCTION ${nomeQualificado}(`);
  if (inicio < 0) throw new Error(`função ${nomeQualificado} não está na migration base`);
  const fim = BASE.indexOf("$function$\n;", inicio);
  return BASE.slice(inicio, fim < 0 ? undefined : fim + "$function$\n;".length);
}

/** Todas as policies de uma tabela, cada uma como o comando completo. */
export function policies(tabela: string): string[] {
  const rx = new RegExp(`CREATE POLICY [^\\n]* ON ${tabela.replace(".", "\\.")} AS [\\s\\S]*?;\\n`, "g");
  return BASE.match(rx) ?? [];
}

/** Comandos (SELECT, INSERT, UPDATE, DELETE, ALL) cobertos pelas policies de uma tabela. */
export function comandosDasPolicies(tabela: string): string[] {
  return policies(tabela).map((p) => /AS \w+ FOR (\w+)/.exec(p)?.[1] ?? "?").sort();
}

/** Todos os CREATE TRIGGER sobre uma tabela. */
export function gatilhos(tabela: string): string[] {
  return BASE.split("\n").filter((l) => l.startsWith("CREATE TRIGGER") && l.includes(` ON ${tabela} `));
}

/** Constraints declaradas para uma tabela (ALTER TABLE ... ADD CONSTRAINT ...). */
export function constraints(tabela: string): string[] {
  return BASE.split("\n").filter((l) => l.startsWith(`ALTER TABLE ${tabela} ADD CONSTRAINT`));
}
