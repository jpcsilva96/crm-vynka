#!/usr/bin/env node
/**
 * Compara o código das Edge Functions que estão RODANDO em produção com o que está no repo.
 *
 * Existe porque o repo já esteve atrás da produção sem ninguém saber: um `functions deploy`
 * teria regredido soft-delete, multi-pipeline e a rota de proposta da API pública de uma vez.
 * Ver RULES.md §1 e §2.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=... node scripts/check-drift.mjs [--slug upload-anexo] [--write-prod-src <dir>]
 *
 * Exit 0 = repo e produção batem. Exit 1 = há divergência (ou erro de leitura).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchDeployedSources,
  listFunctions,
  normalizarParaComparar,
  requireToken,
} from "./lib/deployed-source.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Sem valor padrão de propósito: um ref fixo aqui já apontou cópias deste código para a produção
// de outro cliente. Quem roda declara o projeto.
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
if (!PROJECT_REF) {
  console.error("Defina SUPABASE_PROJECT_REF com o ref do projeto Supabase do crm-vynka.");
  process.exit(1);
}

const args = process.argv.slice(2);
const arg = (nome) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : null;
};
const slugFiltro = arg("--slug");
const dirSaida = arg("--write-prod-src");

const token = requireToken();
const funcoes = await listFunctions(PROJECT_REF, token);
const alvos = funcoes
  .filter((f) => !slugFiltro || f.slug === slugFiltro)
  .sort((a, b) => a.slug.localeCompare(b.slug));

if (alvos.length === 0) {
  console.error(`Nenhuma função deployada com slug '${slugFiltro}'.`);
  process.exit(1);
}

const linhas = [];
let divergentes = 0;

for (const fn of alvos) {
  let deployado;
  try {
    deployado = await fetchDeployedSources(PROJECT_REF, fn.slug, token);
  } catch (erro) {
    linhas.push({ slug: fn.slug, veredito: "ERRO NA LEITURA", detalhe: erro.message });
    divergentes++;
    continue;
  }

  if (dirSaida) {
    for (const [caminho, conteudo] of Object.entries(deployado)) {
      const destino = join(dirSaida, fn.slug, caminho);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, conteudo, "utf8");
    }
  }

  const difs = [];
  for (const [caminho, fonteProd] of Object.entries(deployado)) {
    const noRepo = join(RAIZ, "supabase", caminho);
    if (!existsSync(noRepo)) {
      difs.push(`${caminho}: existe em produção, não existe no repo`);
      continue;
    }
    const fonteRepo = readFileSync(noRepo, "utf8");
    if (normalizarParaComparar(fonteProd) !== normalizarParaComparar(fonteRepo)) {
      const dp = normalizarParaComparar(fonteProd).split("\n");
      const dr = normalizarParaComparar(fonteRepo).split("\n");
      difs.push(`${caminho}: DIVERGE (prod ${dp.length} linhas × repo ${dr.length})`);
    }
  }

  const existeNoRepo = existsSync(join(RAIZ, "supabase", "functions", fn.slug));
  if (!existeNoRepo) difs.push(`função '${fn.slug}' não existe no repo`);

  if (difs.length) divergentes++;
  linhas.push({
    slug: fn.slug,
    veredito: difs.length ? "DIVERGENTE" : "ok",
    detalhe: difs.join(" · "),
    verifyJwt: fn.verify_jwt,
  });
}

// funções que existem no repo mas não estão deployadas
const slugsProd = new Set(funcoes.map((f) => f.slug));
const dirFuncoes = join(RAIZ, "supabase", "functions");
if (!slugFiltro && existsSync(dirFuncoes)) {
  const { readdirSync, statSync } = await import("node:fs");
  for (const nome of readdirSync(dirFuncoes)) {
    if (nome.startsWith("_")) continue;
    if (!statSync(join(dirFuncoes, nome)).isDirectory()) continue;
    if (!slugsProd.has(nome)) {
      linhas.push({ slug: nome, veredito: "DIVERGENTE", detalhe: "existe no repo, não deployada" });
      divergentes++;
    }
  }
}

console.log(`\nDrift repo × produção — projeto ${PROJECT_REF}\n`);
for (const l of linhas) {
  const marca = l.veredito === "ok" ? "  ok  " : "DIVERGE";
  const jwt = l.verifyJwt === undefined ? "" : ` [verify_jwt=${l.verifyJwt}]`;
  console.log(`${marca} | ${l.slug}${jwt}`);
  if (l.detalhe) console.log(`        ${l.detalhe}`);
}
console.log(
  divergentes
    ? `\n${divergentes} divergência(s). Capture a produção para o repo ANTES de qualquer deploy (RULES.md §1).`
    : "\nRepo e produção batem em todas as funções.",
);
process.exit(divergentes ? 1 : 0);
