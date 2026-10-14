import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// Fim de linha normalizado na leitura: no Windows o git entrega config.toml com CRLF, e as
// asserções abaixo casam blocos de várias linhas escritos com quebra simples.
const ler = (caminho: string) =>
  readFileSync(resolve(root, caminho), "utf8").split("\r\n").join("\n");

const funcaoAssinatura = ler("supabase/functions/storage-signed-url/index.ts");
const funcaoUpload = ler("supabase/functions/upload-anexo/index.ts");
const dealNotes = ler("src/lib/dealNotes.ts");
const config = ler("supabase/config.toml");

/**
 * Contrato dos anexos, no estilo de `security-contract.test.ts`: textual, lendo o fonte.
 *
 * É um teste que NÃO executa a Edge Function (ela roda em Deno, fora do vitest) — protege contra
 * regressão de desenho, não contra erro de execução. O que ele guarda é o que custou caro descobrir:
 * a URL do arquivo nunca é gravada, e ter acesso a um workspace não pode virar acesso ao do vizinho.
 */

describe("contrato do anexo", () => {
  it("o cliente guarda o caminho do arquivo, nunca a URL assinada", () => {
    // o caminho vem da função de upload, não é construído aqui
    expect(dealNotes).toContain("path: data.path");
    // o formato sintético que quebrou os 49 anexos não pode voltar
    expect(dealNotes).not.toContain("`${dealId}:${file.name}:${Date.now()}`");
    // e a URL não é devolvida no anexo novo
    expect(dealNotes).not.toContain("url: data.url");
  });

  it("o link é pedido sob demanda à função de assinatura", () => {
    expect(dealNotes).toContain("getAttachmentSignedUrl");
    expect(dealNotes).toContain("storage-signed-url");
    expect(dealNotes).toContain("Authorization: `Bearer ${session.access_token}`");
  });

  it("a função só assina caminho de dentro do workspace de quem pediu", () => {
    expect(funcaoAssinatura).toContain("const prefixoDoWorkspace = `workspaces/${workspaceId}/`");
    expect(funcaoAssinatura).toContain("!path.startsWith(prefixoDoWorkspace)");
    expect(funcaoAssinatura).toContain('path.includes("..")');
    // a checagem de caminho vem ANTES de qualquer acesso ao storage
    expect(funcaoAssinatura.indexOf("prefixoDoWorkspace")).toBeLessThan(
      funcaoAssinatura.indexOf("createSignedUrl"),
    );
  });

  it("a função exige usuário autenticado com acesso ao workspace", () => {
    // a CHAMADA, não só o import: trocar isto por um cliente de serviço puro assinaria para qualquer um
    const chamada = "await requireWorkspaceUpload(req, workspaceId)";
    expect(funcaoAssinatura).toContain(chamada);
    expect(funcaoAssinatura.indexOf(chamada)).toBeLessThan(funcaoAssinatura.indexOf("createSignedUrl"));
    // e o service client nunca é criado direto aqui, sem passar pela validação
    expect(funcaoAssinatura).not.toContain("createServiceClient()");
    // e o gateway também exige JWT (RULES §11: o bloco no config é contrato de deploy)
    expect(config).toContain("[functions.storage-signed-url]\nverify_jwt = true");
  });

  it("a função só assina leitura: não envia, não apaga, não lista o bucket", () => {
    expect(funcaoAssinatura).toContain("createSignedUrl");
    expect(funcaoAssinatura).not.toContain(".upload(");
    expect(funcaoAssinatura).not.toContain(".remove(");
    expect(funcaoAssinatura).not.toContain(".list(");
  });

  it("o upload valida o workspace antes de gravar e devolve só o caminho", () => {
    const chamada = "await requireWorkspaceUpload(req, workspaceId)";
    expect(funcaoUpload).toContain(chamada);
    expect(funcaoUpload.indexOf(chamada)).toBeLessThan(funcaoUpload.indexOf(".upload("));
    expect(funcaoUpload).toContain("jsonResponse(200, { path }");
    expect(funcaoUpload).not.toContain("createSignedUrl");
    expect(config).toContain("[functions.upload-anexo]\nverify_jwt = true");
  });

  it("upload e assinatura usam o mesmo bucket", () => {
    expect(funcaoUpload).toContain('const BUCKET = "anexos"');
    expect(funcaoAssinatura).toContain('.from("anexos")');
    expect(dealNotes).toContain("/upload-anexo");
  });
});
