import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardRuleInfo } from "@/components/pipeline/DashboardRuleInfo";
import { DASHBOARD_RULES } from "@/lib/dashboardRules";

/**
 * Teste de render: o contrato textual prova que o `ruleId` está escrito na tela, mas não prova
 * que o leitor CONSEGUE ler a regra. Este aqui clica no "i" e exige o texto visível.
 */
describe("o i abre e mostra a regra", () => {
  it("fica fechado até alguém clicar", () => {
    render(<DashboardRuleInfo ruleId="average-ticket" />);
    expect(screen.queryByText(DASHBOARD_RULES["average-ticket"].paragraphs[0])).not.toBeInTheDocument();
  });

  it("no clique, mostra o título e TODOS os parágrafos da regra", () => {
    const rule = DASHBOARD_RULES["forecast-revenue"];
    render(<DashboardRuleInfo ruleId="forecast-revenue" />);

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText(rule.title)).toBeInTheDocument();
    // quatro parágrafos: se um sumir do render, a ressalva some com ele
    expect(rule.paragraphs).toHaveLength(4);
    for (const paragraph of rule.paragraphs) {
      expect(screen.getByText(paragraph)).toBeInTheDocument();
    }
  });

  it("o botão diz a quem usa leitor de tela qual número ele explica", () => {
    render(<DashboardRuleInfo ruleId="conversion-rate" />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/Taxa de Conversão/);
  });
});
