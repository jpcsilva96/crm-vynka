#!/usr/bin/env node
/**
 * Guarda de comandos perigosos do Supabase CLI, usada como hook PreToolUse do Claude Code.
 *
 * Lê o payload do hook em stdin e bloqueia dois comandos que já causaram ou quase causaram
 * incidente neste projeto:
 *
 *   1. `supabase functions deploy` SEM nome de função — deploya as 16 de uma vez, na direção
 *      repo -> produção. Como a produção esteve à frente do repo em várias funções, isso
 *      regride comportamento em massa (ver RULES.md §2).
 *   2. `supabase db reset` apontando para o projeto remoto — destrói dados de produção.
 *
 * Bloquear é a resposta certa mesmo com falso positivo: o custo de rodar de novo com o nome
 * explícito é segundos; o custo de um deploy em massa é um incidente com cliente.
 *
 * Saída: exit 0 libera. exit 2 bloqueia e devolve o motivo ao agente pelo stderr.
 */

const BLOQUEIO = 2;

let entrada = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (entrada += chunk));
process.stdin.on("end", () => {
  // Fail-safe: se o payload não parseia (BOM, encoding de shell, formato novo),
  // avalia o texto cru em vez de liberar. Guarda que sai calada quando não entende
  // a entrada é pior que guarda nenhuma, porque dá falsa sensação de proteção.
  let comando = entrada;
  try {
    comando = JSON.parse(entrada.replace(/^﻿/, "") || "{}")?.tool_input?.command ?? entrada;
  } catch {
    // segue com o texto cru
  }

  const motivo = avaliar(String(comando));
  if (!motivo) process.exit(0);

  process.stderr.write(motivo);
  process.exit(BLOQUEIO);
});

function avaliar(comando) {
  // Uma linha de shell pode encadear vários comandos; avalia cada segmento.
  for (const trecho of comando.split(/&&|\|\||;|\n/)) {
    const t = trecho.trim();
    // Aspas contam como fronteira: no fallback de texto cru o comando chega
    // embrulhado em JSON (`"command":"supabase ...`). Bloquear um `echo` por
    // engano custa nada; deixar passar um deploy em massa custa um incidente.
    if (!/(^|[\\/\s"'`])supabase(\.exe)?\s/.test(` ${t}`)) continue;

    if (/\bfunctions\s+deploy\b/.test(t) && !temNomeDeFuncao(t)) {
      return [
        "BLOQUEADO: `supabase functions deploy` sem nome de função deploya TODAS as funções,",
        "na direção repo -> produção. A produção já esteve à frente do repo neste projeto.",
        "",
        "Use: supabase functions deploy <nome-da-funcao> --use-api --project-ref <ref>",
        "Antes disso, rode scripts/check-drift.mjs para ver a direção do drift (RULES.md §1 e §2).",
        "",
      ].join("\n");
    }

    if (/\bdb\s+reset\b/.test(t) && /--linked|--project-ref/.test(t)) {
      return [
        "BLOQUEADO: `supabase db reset` contra o projeto remoto destrói dados de produção.",
        "Este projeto está em free tier: NÃO HÁ PITR. Reset remoto é irreversível.",
        "",
      ].join("\n");
    }
  }
  return null;
}

/** Há um argumento posicional depois de `deploy` que não seja uma flag nem valor de flag? */
function temNomeDeFuncao(trecho) {
  const depois = trecho.split(/\bfunctions\s+deploy\b/)[1] ?? "";
  const tokens = depois.trim().split(/\s+/).filter(Boolean);
  const flagsComValor = new Set([
    "--project-ref",
    "--import-map",
    "--entrypoint",
    "--region",
    "-p",
    "--password",
  ]);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith("-")) {
      // `--flag=valor` já carrega o valor; `--flag valor` consome o próximo token
      if (!token.includes("=") && flagsComValor.has(token)) i++;
      continue;
    }
    // Só conta como nome se parecer um slug de função. Sem isso, lixo de payload
    // truncado (uma aspa solta, por exemplo) passaria por nome e liberaria o deploy.
    if (/^[A-Za-z0-9_-]+$/.test(token)) return true;
  }
  return false;
}
