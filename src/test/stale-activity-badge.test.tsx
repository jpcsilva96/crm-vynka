import { readFileSync } from "node:fs";
import path from "node:path";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DealListNameLine } from "@/components/pipeline/DealListNameLine";
import { STALE_ACTIVITY_LABEL, staleBadgeFits } from "@/lib/staleActivityBadge";

/**
 * Selo "Sem atividade" na lista do Pipeline (23/09/2026, pedido do operador): nunca desce para a
 * linha de baixo e não abrevia nada. Se o texto por extenso não cabe ao lado do nome, fica só o
 * triângulo, com o texto no balão e no leitor de tela.
 */
describe("regra de caber", () => {
  it("cabe exatamente no limite; 1px a mais não cabe", () => {
    expect(staleBadgeFits({ available: 300, fullWidth: 200, trailingWidth: 92, gap: 8 })).toBe(true);
    expect(staleBadgeFits({ available: 300, fullWidth: 201, trailingWidth: 92, gap: 8 })).toBe(false);
  });

  it("o selo de tarefas conta, com o espaço entre eles, mesmo vazio", () => {
    expect(staleBadgeFits({ available: 205, fullWidth: 200, trailingWidth: null, gap: 8 })).toBe(true);
    expect(staleBadgeFits({ available: 205, fullWidth: 200, trailingWidth: 0, gap: 8 })).toBe(false);
  });
});

describe("linha do nome", () => {
  afterEach(() => vi.restoreAllMocks());

  // O jsdom não calcula layout: a largura disponível e a da régua invisível são simuladas.
  const fakeLayout = (available: number, fullWidth: number) => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.dataset.testid === "deal-list-name-line" ? available : 0;
    });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("w-max") ? fullWidth : 0;
    });
  };

  const renderLine = (hasStaleActivity = true) =>
    render(
      <TooltipProvider>
        <DealListNameLine name="Negociação de teste" hasStaleActivity={hasStaleActivity} trailing={<span>selo</span>} />
      </TooltipProvider>,
    );

  it("com espaço, mostra o texto por extenso", () => {
    fakeLayout(600, 300);
    renderLine();
    const badge = screen.getByTestId("stale-activity-badge");
    expect(badge.dataset.compact).toBe("false");
    expect(badge).toHaveTextContent(STALE_ACTIVITY_LABEL);
  });

  it("sem espaço, vira só o triângulo, com o texto no leitor de tela", () => {
    fakeLayout(250, 300);
    renderLine();
    const badge = screen.getByTestId("stale-activity-badge");
    expect(badge.dataset.compact).toBe("true");
    expect(badge.textContent).toBe("");
    expect(badge).toHaveAccessibleName(STALE_ACTIVITY_LABEL);
  });

  it("a linha nunca quebra e o nome sai inteiro", () => {
    fakeLayout(250, 300);
    renderLine();
    const line = screen.getByTestId("deal-list-name-line");
    expect(line.className).toMatch(/\bflex-nowrap\b/);
    expect(line.className).not.toMatch(/\bflex-wrap\b/);
    expect(screen.getByTestId("stale-activity-badge").className).toMatch(/\bshrink-0\b/);
    const name = screen.getAllByText("Negociação de teste")[0];
    expect(name.className).not.toMatch(/truncate|line-clamp|text-ellipsis/);
  });

  it("sem atividade parada, sem selo e sem régua", () => {
    fakeLayout(250, 300);
    renderLine(false);
    expect(screen.queryByTestId("stale-activity-badge")).toBeNull();
    expect(screen.getAllByText("Negociação de teste")).toHaveLength(1);
  });

  it("volta ao texto por extenso quando a coluna alarga, e ao triângulo quando estreita", () => {
    // Só dispara para quem observa a linha: é a largura dela que muda quando a coluna muda.
    const watchers: { cb: ResizeObserverCallback; targets: Element[] }[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        private watcher: { cb: ResizeObserverCallback; targets: Element[] };
        constructor(cb: ResizeObserverCallback) {
          this.watcher = { cb, targets: [] };
          watchers.push(this.watcher);
        }
        observe(el: Element) {
          this.watcher.targets.push(el);
        }
        disconnect() {
          this.watcher.targets = [];
        }
      },
    );
    let available = 250;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.dataset.testid === "deal-list-name-line" ? available : 0;
    });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("w-max") ? 300 : 0;
    });
    const resize = (width: number) => {
      available = width;
      const line = screen.getByTestId("deal-list-name-line");
      act(() => watchers.filter((w) => w.targets.includes(line)).forEach((w) => w.cb([], {} as ResizeObserver)));
    };

    renderLine();
    expect(screen.getByTestId("stale-activity-badge").dataset.compact).toBe("true");
    resize(600);
    expect(screen.getByTestId("stale-activity-badge").dataset.compact).toBe("false");
    resize(250);
    expect(screen.getByTestId("stale-activity-badge").dataset.compact).toBe("true");
    vi.unstubAllGlobals();
  });

  it("legível no tema escuro", () => {
    fakeLayout(600, 300);
    renderLine();
    expect(screen.getByTestId("stale-activity-badge").className).toMatch(/text-amber-700.*dark:text-amber-300/);
  });
});

describe("contrato no Pipeline", () => {
  const source = readFileSync(path.resolve(__dirname, "../pages/Pipeline.tsx"), "utf8");

  it("a lista usa a linha do nome, não o selo por extenso solto", () => {
    expect(source).toContain("<DealListNameLine");
    expect(source).not.toContain("Sem atividade há 7+ dias");
  });
});
