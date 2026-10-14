#!/usr/bin/env node
/**
 * Única forma sancionada de deployar uma Edge Function deste projeto (RULES.md §2).
 *
 * O que ele impede, e por que existe:
 *  - deploy sem nome (o CLI deployaria TODAS na direção repo -> produção);
 *  - deploy que REGRIDE produção: se o código no ar diverge do repo, ele para e mostra,
 *    porque já aconteceu de a produção estar 17 dias à frente sem ninguém saber;
 *  - deploy que tranca um endpoint público: confere o `verify_jwt` depois e avisa se mudou
 *    (medido em 19/08: o CLI sobrescreve para `true` quando o config.toml não declara).
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=... node scripts/deploy-function.mjs <slug> [--force "motivo"]
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listFunctions, requireToken } from "./lib/deployed-source.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Sem valor padrão de propósito: um ref fixo aqui já apontou cópias deste código para a produção
// de outro cliente. Quem roda declara o projeto.
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
if (!PROJECT_REF) {
  console.error("Defina SUPABASE_PROJECT_REF com o ref do projeto Supabase do crm-vynka.");
  process.exit(1);
}

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("-"));
const iForce = args.indexOf("--force");
const motivoForce = iForce >= 0 ? args[iForce + 1] : null;

if (!slug) {
  console.error("Falta o nome da função.\n  node scripts/deploy-function.mjs <slug> [--force \"motivo\"]");
  process.exit(1);
}
if (!existsSync(join(RAIZ, "supabase", "functions", slug))) {
  console.error(`Função '${slug}' não existe em supabase/functions/.`);
  process.exit(1);
}
if (iForce >= 0 && !motivoForce) {
  console.error("--force exige um motivo escrito. Ele vai para o log do deploy.");
  process.exit(1);
}

const token = requireToken();

// ---- 1. drift antes de qualquer escrita -----------------------------------------------
// Se a produção estiver à frente, deployar o repo REGRIDE comportamento. Só passa com
// --force e um motivo escrito.
console.log(`\n[1/4] Comparando '${slug}' com o que está em produção...`);

// Função que ainda não existe lá não tem comportamento a regredir: comparar não faz sentido, e o
// check-drift sai com erro nesse caso. Sem esta distinção, TODA primeira publicação exigia --force,
// o que gasta a exceção que deveria ser rara e treina a mão a forçar. (10/09/2026, deploy da
// storage-signed-url.)
const funcoesEmProducao = await listFunctions(PROJECT_REF, token);
const jaExisteEmProducao = funcoesEmProducao.some((funcao) => funcao.slug === slug);

let divergente = false;
if (!jaExisteEmProducao) {
  console.log(`Primeira publicação: não há função com o slug '${slug}' em produção, nada a regredir.`);
} else {
  try {
    const saida = execFileSync(
      process.execPath,
      [join(RAIZ, "scripts", "check-drift.mjs"), "--slug", slug],
      { cwd: RAIZ, encoding: "utf8", env: process.env },
    );
    console.log(String(saida).trim());
  } catch (erro) {
    divergente = true;
    console.log(String(erro.stdout ?? "").trim());
    if (erro.stderr) console.error(String(erro.stderr).trim());
  }
}

if (divergente && !motivoForce) {
  console.error(
    "\nBLOQUEADO: o código no ar diverge do repo.\n" +
      "Se a produção estiver à frente, este deploy apaga comportamento que ninguém commitou.\n" +
      "Capture a produção para o repo primeiro (RULES.md §1). Se a divergência for esperada\n" +
      "(o repo é que está à frente), repita com: --force \"motivo\".",
  );
  process.exit(1);
}

// ---- 2. estado atual (para comparar depois) --------------------------------------------
const antes = funcoesEmProducao.find((f) => f.slug === slug);
console.log(
  `\n[2/4] Estado atual em produção: ${antes ? `versão ${antes.version}, verify_jwt=${antes.verify_jwt}` : "função ainda não existe"}`,
);

// ---- 3. deploy ---------------------------------------------------------------------------
console.log(`\n[3/4] Deployando '${slug}' (nomeado, --use-api)...`);
try {
  // CLI pelo npx, com versão fixa: não depende de instalação global nem muda de versão sozinho.
  execFileSync(
    "npx",
    ["--yes", "supabase@2.121.0", "functions", "deploy", slug, "--use-api", "--project-ref", PROJECT_REF],
    { cwd: RAIZ, encoding: "utf8", stdio: "inherit", shell: true },
  );
} catch {
  console.error("\nDeploy falhou. Produção permanece na versão anterior.");
  process.exit(1);
}

// ---- 4. verificação pós-deploy -----------------------------------------------------------
await new Promise((r) => setTimeout(r, 3000));
const depois = (await listFunctions(PROJECT_REF, token)).find((f) => f.slug === slug);
console.log(`\n[4/4] Depois: versão ${depois?.version}, verify_jwt=${depois?.verify_jwt}`);

if (antes && depois && antes.verify_jwt !== depois.verify_jwt) {
  console.error(
    `\nATENÇÃO: verify_jwt mudou de ${antes.verify_jwt} para ${depois.verify_jwt}.\n` +
      "Se esta função é consumida por integração externa, ela pode ter sido trancada agora.\n" +
      "Declare o valor correto em supabase/config.toml e deploye de novo.",
  );
  process.exit(1);
}
if (motivoForce) console.log(`\nDeploy forçado. Motivo registrado: ${motivoForce}`);
console.log("\nDeploy concluído e verificado.");
