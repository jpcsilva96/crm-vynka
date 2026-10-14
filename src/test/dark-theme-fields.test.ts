import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Campos de edição no tema escuro (23/09/2026). O jsdom não aplica Tailwind nem desenha controle
 * nativo, então o teste é textual e a medição de cor foi feita no app (fundo do campo
 * rgb(28,21,40), texto rgb(242,242,242), color-scheme "dark").
 */
const read = (file: string) => readFileSync(path.resolve(__dirname, "..", file), "utf8");

describe("campos de edição seguem o tema", () => {
  it("InlineEditField não fixa fundo branco (o texto claro do tema escuro sumia nele)", () => {
    const source = read("components/pipeline/InlineEditField.tsx");
    expect(source).not.toContain("bg-white");
    // input, textarea e select de edição
    expect(source.match(/bg-background text-foreground placeholder:text-muted-foreground/g)).toHaveLength(3);
  });

  it("o tema escuro declara color-scheme, para a lista do <select> e o calendário não virem brancos", () => {
    const css = read("index.css").replace(/\r\n/g, "\n");
    expect(css).toMatch(/\.dark \{\n\s*color-scheme: dark;/);
    expect(css).toMatch(/:root \{\n\s*color-scheme: light;/);
    expect(css).toMatch(/select option \{\n\s*@apply bg-popover text-popover-foreground;/);
  });
});
