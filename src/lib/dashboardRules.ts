// Texto das regras do Dashboard do Pipeline, exibidas no "i" de cada card e gráfico.
//
// Este arquivo é a FONTE ÚNICA desses textos e existe separado da tela por dois motivos:
// o cliente lê e revisa este conteúdo, e cada texto descreve a regra COMO ELA É HOJE —
// não como gostaríamos que fosse. Quando o cálculo mudar, o texto muda junto, aqui.
//
// Toda ressalva escrita abaixo foi lida no cálculo em `PipelineDashboard.tsx`, não suposta.

export type DashboardRuleId =
  | "period-filter"
  | "pipeline-value"
  | "won-value"
  | "lost-value"
  | "total-deals"
  | "conversion-rate"
  | "conversion-value"
  | "average-ticket"
  | "average-closing-time"
  | "forecast-revenue"
  | "stage-volume"
  | "deals-evolution"
  | "outcome-split"
  | "loss-reasons";

export interface DashboardRule {
  /** Título do popover. Repete o rótulo do card para o leitor não perder a referência. */
  title: string;
  /** Um parágrafo por ideia: o que soma, de onde vem a data, o que fica de fora. */
  paragraphs: string[];
}

export const DASHBOARD_RULES: Record<DashboardRuleId, DashboardRule> = {
  "period-filter": {
    title: "Como o período filtra",
    paragraphs: [
      "O período usa datas diferentes conforme a situação da negociação: a que está aberta entra pela previsão de fechamento e, quando ela não está preenchida, pela data de criação; a ganha e a perdida entram pela data da última alteração.",
      "Responsável e pipeline filtram todos os números desta tela junto com o período. Além disso, cada pessoa só enxerga as negociações que o seu perfil permite ver, então dois usuários podem ver totais diferentes com os mesmos filtros.",
    ],
  },

  "pipeline-value": {
    title: "Valor Total do Pipeline",
    paragraphs: [
      "Soma o valor das negociações abertas — as que não estão marcadas como ganhas nem como perdidas — dentro dos filtros aplicados. A linha de baixo conta essas mesmas negociações.",
      "Negociação sem valor preenchido entra na contagem e soma zero ao valor.",
    ],
  },

  "won-value": {
    title: "Valor Total Ganho",
    paragraphs: [
      "Soma o valor das negociações ganhas no período filtrado. Vale como ganha tanto a que recebeu o desfecho “ganho” quanto a que está na etapa Ganho.",
    ],
  },

  "lost-value": {
    title: "Valor Total Perdido",
    paragraphs: [
      "Soma o valor das negociações perdidas no período filtrado. Vale como perdida tanto a que recebeu o desfecho “perdido” quanto a que está na etapa Perdido.",
    ],
  },

  "total-deals": {
    title: "Total de Negociações",
    paragraphs: [
      "Conta todas as negociações que passaram pelos filtros, somando abertas, ganhas e perdidas. É a base usada como denominador das duas taxas de conversão.",
    ],
  },

  "conversion-rate": {
    title: "Taxa de Conversão",
    paragraphs: [
      "Divide a quantidade de negociações ganhas pelo total de negociações do período.",
      "As negociações ainda abertas entram no total. Por isso a taxa tende a subir conforme elas se fecham, e um período com muita negociação em andamento mostra uma taxa menor do que o resultado final daquele período.",
    ],
  },

  "conversion-value": {
    title: "Taxa de Conversão (R$)",
    paragraphs: [
      "Divide o valor das negociações ganhas pelo valor de todas as negociações do período — a mesma conta da taxa de conversão, só que em reais em vez de quantidade.",
      "Como na outra taxa, o valor das negociações abertas entra no total e puxa o percentual para baixo enquanto elas não fecham.",
    ],
  },

  "average-ticket": {
    title: "Ticket Médio",
    paragraphs: [
      "Divide o valor total ganho pela quantidade de negociações ganhas no período. Abertas e perdidas não entram na conta.",
      "Sem nenhuma negociação ganha no período, mostra zero.",
    ],
  },

  "average-closing-time": {
    title: "Tempo Médio de Fechamento",
    paragraphs: [
      "Média, em dias, entre a criação da negociação e o seu fechamento, considerando apenas as negociações ganhas do período.",
      "O CRM não guarda a data em que a negociação foi ganha, então a data da última alteração é usada no lugar. Editar hoje uma negociação ganha há meses aumenta essa média.",
    ],
  },

  "forecast-revenue": {
    title: "Receita Prevista",
    paragraphs: [
      "Soma, das negociações abertas, o valor de cada uma multiplicado pela probabilidade da etapa em que ela está. Uma negociação de R$ 10.000 numa etapa de 60% contribui com R$ 6.000.",
      "Entram só as negociações cujo fechamento é esperado dentro do período: vale a previsão de fechamento preenchida e, quando ela falta, a data de criação somada ao tempo médio de fechamento.",
      "Sem nenhuma negociação ganha no período não há tempo médio para estimar, e as negociações sem previsão de fechamento ficam de fora da soma.",
      "A probabilidade é sempre a cadastrada na etapa e lida no pipeline da própria negociação, inclusive com “Todos os Pipelines” selecionado. Negociação cuja etapa não existe mais no pipeline dela entra com 0% e não soma nada.",
    ],
  },

  "stage-volume": {
    title: "Volume de Oportunidade por Etapa (R$)",
    paragraphs: [
      "Para cada etapa do pipeline, mostra quantas negociações estão nela (linha) e quanto elas somam em valor (área). O percentual ao lado do nome da etapa é a probabilidade cadastrada nela, a mesma usada na Receita Prevista.",
      "Ganhas e perdidas não aparecem aqui, porque já saíram das etapas do funil.",
      "O gráfico exige um pipeline escolhido no filtro: com “Todos os Pipelines” ele não é desenhado. Etapas de funis diferentes não são comparáveis — “leads” é “Novos Leads” no Pipeline Comercial e “Opt-in” na Nutrição —, e somá-las numa barra só não diria nada.",
    ],
  },

  "deals-evolution": {
    title: "Evolução das Negociações",
    paragraphs: [
      "Divide o período em faixas de tempo — um ponto por dia até 31 dias, e blocos maiores acima disso — e conta em cada faixa quantas negociações foram criadas, ganhas e perdidas.",
      "“Criadas” usa a data de criação. “Ganhas” e “Perdidas” usam a data da última alteração, porque não há data de fechamento gravada.",
      "Uma negociação aberta pode entrar no período pela previsão de fechamento e ter sido criada antes dele: nesse caso ela conta nos cards, mas não aparece na linha “Criadas”.",
    ],
  },

  "outcome-split": {
    title: "Ganhos x Perdidos",
    paragraphs: [
      "Reparte as negociações do período em três fatias — ganhas, perdidas e em andamento — pela quantidade, não pelo valor.",
      "As três fatias somam exatamente o card Total de Negociações.",
    ],
  },

  "loss-reasons": {
    title: "Motivos de Perda",
    paragraphs: [
      "Agrupa as negociações perdidas do período pelo motivo declarado no fechamento e mostra os seis motivos mais frequentes, do maior para o menor.",
      "Perda registrada sem motivo preenchido é contada como “Outros”. Sem nenhuma perda no período, o gráfico aparece vazio.",
    ],
  },
};

export const getDashboardRule = (id: DashboardRuleId): DashboardRule => DASHBOARD_RULES[id];
