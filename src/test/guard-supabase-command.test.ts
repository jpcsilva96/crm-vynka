import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * A guarda roda como hook PreToolUse do Claude Code, recebendo o payload por stdin.
 * O teste invoca o script de verdade (o caminho que o hook exerce), em vez de importar
 * a função interna: o parsing do stdin e o código de saída fazem parte do contrato.
 */
const GUARD = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../scripts/guard-supabase-command.mjs",
);
const EXIT_BLOQUEIO = 2;

const rodar = (command: string) =>
  spawnSync("node", [GUARD], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: "utf8",
  });

const bloqueia = (command: string) => rodar(command).status === EXIT_BLOQUEIO;

describe("guarda de comandos do Supabase CLI", () => {
  describe("bloqueia deploy em massa (regride produção para a versão do repo)", () => {
    it.each([
      ["supabase functions deploy"],
      ["supabase functions deploy --use-api"],
      ["supabase functions deploy --project-ref abcdefghijklmnopqrst"],
      ["supabase functions deploy --use-api --project-ref abcdefghijklmnopqrst"],
      ["npm run test && supabase functions deploy"],
    ])("%s", (command) => {
      expect(bloqueia(command)).toBe(true);
    });

    it("explica o motivo e aponta a alternativa", () => {
      const { stderr } = rodar("supabase functions deploy");
      expect(stderr).toContain("BLOQUEADO");
      expect(stderr).toContain("check-drift");
    });
  });

  describe("bloqueia reset destrutivo contra o projeto remoto", () => {
    it.each([
      ["supabase db reset --linked"],
      ["supabase db reset --project-ref abcdefghijklmnopqrst"],
    ])("%s", (command) => {
      expect(bloqueia(command)).toBe(true);
    });
  });

  describe("falha de forma segura quando não entende a entrada", () => {
    // Regressão: a 1ª versão liberava (exit 0) sempre que o JSON não parseava.
    // Um pipe de shell que altere o payload desativava a guarda em silêncio.
    const rodarCru = (input: string) =>
      spawnSync("node", [GUARD], { input, encoding: "utf8" }).status;

    it("bloqueia comando perigoso em texto cru, sem envelope JSON", () => {
      expect(rodarCru("supabase functions deploy")).toBe(EXIT_BLOQUEIO);
    });

    it("bloqueia mesmo com BOM antes do JSON", () => {
      expect(
        rodarCru("﻿" + JSON.stringify({ tool_input: { command: "supabase functions deploy" } })),
      ).toBe(EXIT_BLOQUEIO);
    });

    it("bloqueia com JSON truncado que ainda carrega o comando", () => {
      expect(rodarCru('{"tool_input":{"command":"supabase functions deploy"')).toBe(EXIT_BLOQUEIO);
    });

    it("libera entrada vazia", () => {
      expect(rodarCru("")).toBe(0);
    });
  });

  describe("não atrapalha o trabalho legítimo", () => {
    it.each([
      ["supabase functions deploy create-user"],
      ["supabase functions deploy upload-anexo --use-api --project-ref abcdefghijklmnopqrst"],
      ["supabase functions deploy storage-signed-url --project-ref=abcdefghijklmnopqrst"],
      ["supabase functions list"],
      ["supabase functions delete alguma-funcao"],
      ["supabase db reset"], // reset LOCAL é rotina de desenvolvimento
      ["supabase link --project-ref abcdefghijklmnopqrst"],
      ["npm run build"],
    ])("%s", (command) => {
      expect(bloqueia(command)).toBe(false);
    });
  });
});
