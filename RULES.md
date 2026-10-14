# RULES — regras de operação do crm-vynka

Regras numeradas e citáveis para quem trabalha neste projeto (humano ou agente). Cada uma carrega
**o porquê** — regra sem causa vira folclore e é a primeira a ser ignorada quando dá pressa.

Elas vêm do CRM de onde este projeto foi copiado, onde cada uma custou um incidente ou um quase
incidente. Valem aqui porque a arquitetura é a mesma.

---

## §1 — O repositório é a fonte da verdade. Quando não for, a captura vai da produção para o repo.

Antes de mudar qualquer coisa, saiba de que lado está o código mais novo. Se a produção estiver à
frente, **capture-a para o repo primeiro** e só então trabalhe.

Ferramenta: `node scripts/check-drift.mjs` (exige `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF`).
Ele baixa o bundle de cada função deployada, recupera o TypeScript original pelos sourcemaps e
compara com o repo.

**Por quê:** deploy por CLI e SQL no dashboard são mão única — nada volta sozinho para o git. Na
origem, uma função ficou semanas à frente do repo com trabalho nunca commitado; um deploy a partir
do repo teria apagado tudo de uma vez.

## §2 — Deploy é sempre nomeado, e sempre pelo script.

```
SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=<ref> node scripts/deploy-function.mjs <slug>
```

**Nunca** rode `supabase functions deploy` sem nome: ele deploya **todas** as funções, na direção
repo → produção. A guarda automática (`scripts/guard-supabase-command.mjs`, ligada como hook do
Claude Code) bloqueia esse comando e o `db reset` remoto — mas ela só cobre sessões de agente.
Fora delas, a regra é humana.

O script recusa deploy quando a produção está à frente. Se a divergência for esperada (o repo é que
avançou), repita com `--force "motivo"` — o motivo fica no log.

## §3 — Mudança de banco vira migration. Dashboard só para leitura.

SQL no dashboard serve para diagnóstico e consulta. Qualquer alteração de schema (tabela, índice,
policy, função, trigger) nasce como arquivo em `supabase/migrations/`.

**Por quê:** na origem, tabelas centrais (organizações, workspaces, perfis, papéis) foram criadas
fora de migration. Ninguém conseguia recriar o banco pelo repo — e este projeto precisou reconstruir
o schema delas a partir dos tipos gerados e do código.

## §4 — Nada vai para produção sem estar commitado. Se a urgência obrigou, o commit sai no mesmo dia.

O código que roda tem de existir no git. Sem isso, ninguém sabe o que está no ar, e o próximo deploy
vira aposta.

## §5 — Mudança de risco em produção passa por fase sombra.

Quando a mudança pode corromper ou apagar dado, deploye primeiro com **outro nome**
(`<funcao>-v2`), execute de forma controlada, verifique o resultado com SQL, e só então promova ao
nome canônico.

Antes do write, três coisas prontas: **snapshot** do estado, **script de rollback escrito e testado**
(ver §6), e o critério objetivo do que se espera medir.

## §6 — Rollback se valida executando, não lendo.

Rode o rollback contra um Postgres descartável com o mesmo schema antes de precisar dele. Sem
ambiente descartável, o substituto aceitável é **abrir transação no próprio banco, aplicar, exercer
e dar `ROLLBACK`** — precedido do braço de controle que prova que a transação reverte mesmo naquele
caminho (§12).

**Por quê:** na origem, o ensaio de um rollback pegou acentos destruídos por double-encoding no
snapshot e valores numéricos sem aspas numa coluna TEXT — ambos invisíveis na leitura do script.

Corolário: **o ensaio tem de exercer o comando que o CLIENTE emite, não o equivalente lógico.** Um
ensaio com `INSERT` puro deu 7/7; em produção o primeiro teste real deu 403, porque o `.upsert()` do
supabase-js acrescenta `ON CONFLICT` por conta própria, e isso muda quais policies são exigidas (§13).

## §7 — Teste tem de morder. Check novo nasce com mutante.

Depois de escrever um teste, quebre o código de propósito e confirme que ele falha. Se passar, o
teste não vale nada.

**Por quê:** na origem, uma suíte inteira passava com um mutante que desativaria todos os registros
a cada sincronização, com o CI verde. A maioria dos campos gravados não tinha asserção nenhuma.

Corolário: **teste o oráculo também.** Um simulador que não modela as restrições do banco (índice
único, por exemplo) é, por construção, incapaz de detectar a classe de erro que deveria pegar.

## §8 — Semântica de sistema de terceiro se lê na documentação dele, não se deduz do código.

**Por quê:** na origem, o código tratou por meses os códigos de evento de um ERP com um significado
inventado. A documentação oficial definia outro, e a premissa errada estava dentro de uma lógica que
inativava registros.

## §9 — Dado de cliente não entra no repositório.

Fixtures de teste são anonimizadas, preservando a estrutura (contagens, duplicatas, casos-limite) sem
carregar nome, documento ou contato reais. Snapshots de produção ficam fora do git.

**Por quê:** o histórico do projeto de origem carregava dado de cliente. Por isso este repo começou
sem histórico.

## §10 — Segredo não vive em arquivo versionado nem em pasta de projeto.

Token da Management API vem de variável de ambiente (`SUPABASE_ACCESS_TOKEN`). Nenhum script deste
repo tem credencial embutida, nem projeto padrão.

**Por quê:** `supabase/.temp/` versionado fazia todo clone nascer **linkado à produção**. Ele está no
`.gitignore`. Depois de clonar, rode uma vez `supabase link --project-ref <ref>`.

## §11 — Configuração é código.

`supabase/config.toml` declara o `verify_jwt` de cada função. Não é documentação: é o que o CLI
aplica no deploy.

**Por quê:** medido na origem em três braços: deploy com `--no-verify-jwt` → `false`; redeploy sem
a flag e sem a seção → **`true`** (o CLI sobrescreve); redeploy sem a flag e com a seção → `false`.
Sem o bloco, um único deploy muda o comportamento da função.

## §12 — Experimento precisa de braço positivo.

Antes de afirmar que algo é a causa, mostre o caso em que funciona **e** o caso em que não funciona.
"As duas tentativas falharam igual" não diz nada sobre a variável.

## §13 — Em RLS, escrita depende de leitura: o que o `SELECT` esconde, o `UPDATE` não alcança.

Ao desenhar policy por operação, não trate as operações como independentes. Duas armadilhas, o mesmo
mecanismo — o Postgres precisa **ler** a linha para escrever nela:

- **`UPDATE ... WHERE` passa pela policy de `SELECT`.** Uma policy de UPDATE que autorize mexer numa
  linha que a policy de SELECT esconde não serve para nada: o comando afeta **0 linhas, em silêncio**.
- **`INSERT ... ON CONFLICT` exige que a linha NOVA passe também pela policy de `SELECT`** — nas duas
  formas, `DO NOTHING` e `DO UPDATE`. E isso importa mesmo quando você não escreveu `ON CONFLICT`: o
  `.upsert()` do supabase-js sempre o acrescenta. Para gravar linha que o autor não pode ler, use
  `.insert()` puro e trate `23505` (chave duplicada) como já-feito.

Quando a escrita legítima é em linha de outra pessoa, o caminho não é afrouxar o `SELECT`: é uma
função `SECURITY DEFINER` de escopo estreito, que valide na marra e só saiba fazer aquilo.

**Por quê:** na origem, o alerta de menção em comentário ficou 50 dias sem notificar ninguém,
porque a policy exigia que o alerta fosse do próprio autor — e alerta de menção é para outra pessoa.

## §14 — Valor gravado fora da lista é pista de um campo de escrita não mapeado, não um dado a acomodar.

Quando o banco tem um valor que nenhuma tela oferece, a pergunta não é *como acomodar esse valor* —
é *por onde ele entrou*. Procure o campo de escrita antes de decidir o que fazer com o dado.

**Por quê:** na origem, valores fora das listas de Segmento e Cargo foram tratados como herança e
semeados na lista nova. Eram o rastro de três campos ainda em texto livre. A busca certa não é pelo
que o código oferece; é pelo que o banco recebeu (`SELECT DISTINCT` na coluna).

## §15 — Contrato textual prova o que foi escrito, não o que ficou de fora.

Um teste que lê o fonte e exige literais guarda bem o que você já sabe que existe. Ele **não** acusa
o que você nunca mapeou: passa verde com o buraco aberto e dá a sensação de cobertura que impede a
próxima pergunta.

Corolário: quando um contrato textual passa de primeira num terreno que você acabou de descobrir,
desconfie da lista de alvos antes de comemorar a cobertura.
