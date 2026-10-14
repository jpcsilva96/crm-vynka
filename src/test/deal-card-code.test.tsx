import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { describe, expect, it, vi } from "vitest";
import { DealCard, DEFAULT_CARD_FIELDS } from "@/components/pipeline/DealCard";
import type { Deal } from "@/lib/dealsStore";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * Código da negociação no card (23/09/2026, pedido do operador): texto discreto no canto superior
 * esquerdo, com o botão de copiar ao lado, sem selo. O selo de tarefas segue como era.
 */
const deal = {
  id: "deal-1",
  dealCode: "VYN-000",
  dealName: "Negociação de teste",
  contactName: "Contato Teste",
  personType: "Fisica",
  stage: "leads",
  value: 0,
  tags: [],
  history: [],
  tasks: [],
  notes: [],
} as unknown as Deal;

const renderCard = (props: Partial<Parameters<typeof DealCard>[0]> = {}) =>
  render(
    <DndContext>
      <SortableContext items={[deal.id]}>
        <DealCard deal={deal} onClick={() => {}} {...props} />
      </SortableContext>
    </DndContext>,
  );

describe("código da negociação no card", () => {
  it("é o primeiro conteúdo do card, antes do nome", () => {
    renderCard();
    const code = screen.getByTestId("deal-card-code");
    const name = screen.getByText("Contato Teste");
    expect(code).toHaveTextContent("VYN-000");
    expect(code.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("é só texto, sem selo (sem borda, fundo ou pílula)", () => {
    renderCard();
    const code = screen.getByTestId("deal-card-code");
    expect(code.className).not.toMatch(/rounded-full|(^| )border( |$)|bg-/);
    expect(code.className).toContain("text-muted-foreground");
    // sem o ícone de documento que o selo tinha
    expect(code.querySelector("svg.lucide-file-text")).toBeNull();
  });

  it("tem o botão de copiar logo depois do código", () => {
    renderCard();
    const code = screen.getByTestId("deal-card-code");
    expect(within(code).getByRole("button", { name: "Copiar ID da negociação" })).toBeInTheDocument();
  });

  it("some quando o campo está desligado nas preferências do card", () => {
    renderCard({ visibleFields: { ...DEFAULT_CARD_FIELDS, dealCode: false } });
    expect(screen.queryByTestId("deal-card-code")).toBeNull();
  });
});

// Coluna ID da visão em lista, igual ao card (23/09/2026). Pipeline.tsx é grande demais para render
// isolado; o contrato lê a célula. O clique em copiar não abre a negociação: medido no app.
describe("coluna ID da lista segue o card", () => {
  const source = readFileSync(path.resolve(__dirname, "../pages/Pipeline.tsx"), "utf8").replace(/\r\n/g, "\n");
  const start = source.indexOf('data-testid="deal-list-code"');
  const cell = source.slice(start, source.indexOf("</TableCell>", start));

  it("é texto simples com o botão de copiar do card", () => {
    expect(start).toBeGreaterThan(-1);
    expect(cell).toContain("text-muted-foreground");
    expect(cell).toContain('<CardCopyButton value={deal.dealCode} label="ID da negociação" />');
  });

  it("sem selo nem ícone", () => {
    expect(cell).not.toMatch(/rounded-full|bg-slate|<FileText/);
  });
});

// Detalhes da negociação (23/09/2026): o código sai da pílula do título e vira o campo ID, acima
// do Nome, no painel lateral. DealView.tsx é grande demais para render isolado; o contrato lê o fonte.
describe("detalhes da negociação seguem o card", () => {
  const source = readFileSync(path.resolve(__dirname, "../components/pipeline/DealView.tsx"), "utf8").replace(/\r\n/g, "\n");
  const start = source.indexOf('data-testid="deal-detail-code"');
  const field = source.slice(start, source.indexOf("</div>", start));
  const h1Start = source.indexOf("<h1 ");
  const title = source.slice(h1Start, source.indexOf("</h1>", h1Start));

  it("o campo ID é texto simples com o botão de copiar do card", () => {
    expect(start).toBeGreaterThan(-1);
    expect(field).toContain('<CardCopyButton value={deal.dealCode} label="ID da negociação" />');
    expect(field).not.toMatch(/rounded-full|bg-slate|<FileText/);
  });

  it("fica acima do Nome, dentro da seção Negociação", () => {
    const section = source.indexOf('AccordionItem value="negociacao"');
    const nome = source.indexOf(">Nome</Label>", section);
    expect(section).toBeGreaterThan(-1);
    expect(start).toBeGreaterThan(section);
    expect(start).toBeLessThan(nome);
  });

  it("o título não tem mais o código", () => {
    expect(h1Start).toBeGreaterThan(-1);
    expect(title).not.toContain("deal.dealCode");
  });
});
