/**
 * Recupera o código-fonte ORIGINAL de uma Edge Function que está deployada.
 *
 * O bundle que a Management API devolve é um ESZIP com o código já transpilado —
 * comparar contra o repo nesse formato produz ruído (tipos removidos, formatação de
 * bundler). Mas cada módulo transpilado carrega um sourcemap inline em base64, e o
 * sourcemap traz `sourcesContent`: o TypeScript original, byte a byte. É de lá que
 * este módulo lê.
 *
 * Sem token não há leitura: exige SUPABASE_ACCESS_TOKEN no ambiente (nunca hardcoded).
 */

const API = "https://api.supabase.com/v1";

export function requireToken() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN não definido. Exporte o token da Management API antes de rodar " +
        "(ele nunca deve ficar hardcoded em script versionado).",
    );
  }
  return token;
}

async function api(path, token, { raw = false } = {}) {
  const resp = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`${path} -> HTTP ${resp.status}: ${await resp.text()}`);
  return raw ? Buffer.from(await resp.arrayBuffer()) : resp.json();
}

export async function listFunctions(projectRef, token) {
  return api(`/projects/${projectRef}/functions`, token);
}

/**
 * Devolve { "functions/upload-anexo/index.ts": "<fonte original>", ... } para a função pedida.
 * As chaves vêm do campo `sources` do sourcemap, normalizadas para caminho relativo.
 */
export async function fetchDeployedSources(projectRef, slug, token) {
  const bundle = await api(`/projects/${projectRef}/functions/${slug}/body`, token, { raw: true });
  const texto = bundle.toString("utf8");

  // Os sourcemaps ficam no ESZIP como JSON puro (não base64, não comentário
  // `sourceMappingURL`). Localiza cada um pelo cabeçalho e delimita por balanceamento
  // de chaves, ignorando chaves dentro de string.
  const sources = {};
  const marcador = '{"version":3,"sources":[';
  for (let inicio = texto.indexOf(marcador); inicio !== -1; inicio = texto.indexOf(marcador, inicio + 1)) {
    const fim = acharFimDoObjeto(texto, inicio);
    if (fim === -1) continue;

    let mapa;
    try {
      mapa = JSON.parse(texto.slice(inicio, fim + 1));
    } catch {
      continue; // um sourcemap truncado não invalida os demais
    }
    if (!Array.isArray(mapa.sources) || !Array.isArray(mapa.sourcesContent)) continue;

    mapa.sources.forEach((origem, i) => {
      // dependências remotas não são nosso código
      if (/deno\.land|esm\.sh|jsr[:.]/.test(origem)) return;
      const conteudo = mapa.sourcesContent[i];
      if (typeof conteudo !== "string" || !conteudo) return;
      sources[normalizarCaminho(origem, slug)] = conteudo;
    });
  }

  if (Object.keys(sources).length === 0) {
    throw new Error(
      `Nenhum sourcemap com sourcesContent encontrado em '${slug}'. ` +
        "A função pode ter sido deployada por um caminho que não gera sourcemap — " +
        "compare manualmente antes de concluir que está idêntica.",
    );
  }
  return sources;
}

/** Índice da chave que fecha o objeto iniciado em `inicio`, ou -1. */
function acharFimDoObjeto(texto, inicio) {
  let profundidade = 0;
  let dentroDeString = false;
  let escapado = false;

  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (dentroDeString) {
      if (escapado) escapado = false;
      else if (c === "\\") escapado = true;
      else if (c === '"') dentroDeString = false;
      continue;
    }
    if (c === '"') dentroDeString = true;
    else if (c === "{") profundidade++;
    else if (c === "}" && --profundidade === 0) return i;
  }
  return -1;
}

/**
 * Normaliza o caminho do sourcemap para o layout do repo (`functions/<slug>/index.ts`).
 *
 * O prefixo varia conforme a época e a forma do deploy — vimos `functions/<slug>/index.ts`,
 * `<slug>/index.ts`, `source/index.ts` e `index.ts` cru no mesmo projeto. Tudo que não é
 * `_shared` pertence à função sendo lida.
 */
function normalizarCaminho(origem, slug) {
  const limpo = String(origem).replace(/\\/g, "/").replace(/^file:\/\/\//, "");

  const iFunctions = limpo.lastIndexOf("functions/");
  if (iFunctions >= 0) return limpo.slice(iFunctions);

  const iShared = limpo.lastIndexOf("_shared/");
  if (iShared >= 0) return `functions/${limpo.slice(iShared)}`;

  // resto: relativo à própria função (`<slug>/index.ts`, `source/index.ts`, `index.ts`)
  const arquivo = limpo.replace(new RegExp(`^(${slug}|source)/`), "");
  return `functions/${slug}/${arquivo}`;
}

/**
 * Normalização para comparação semântica: o deployado perdeu os tipos TypeScript na
 * transpilação, então diferença de espaço em branco é ruído, não sinal.
 */
export function normalizarParaComparar(codigo) {
  return String(codigo)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
