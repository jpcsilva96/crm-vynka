# crm-vynka — CRM comercial

CRM comercial: funil de negociações (lista e Kanban), qualificação BANT, tarefas e automações,
contatos e empresas, comentários com menção, anexos, alertas, lixeira e perfis de acesso.

Nasceu em 14/10/2026 como cópia enxuta de outro CRM, **sem o histórico do git** e **sem ligação com
o banco de origem**. Saíram: atendimento WhatsApp, API pública, integração com ERP, propostas,
pedidos, catálogo de produtos, regras do pipeline e tags.

**Leia `RULES.md` antes de mexer em qualquer coisa que chegue a produção.** Este arquivo diz como
trabalhar; o `RULES.md` diz o que não fazer e por quê.

## Arquitetura

| Camada | Onde vive | Como chega em produção |
|---|---|---|
| Frontend (`src/`) | React 18 + TS + Vite + Tailwind/shadcn; estado em Zustand chamando o Supabase direto | Lovable, sincronizado com `github.com/jpcsilva96/crm-vynka` |
| Backend (`supabase/functions/`, migrations) | Supabase `hmrtddtbymqmovjfchiw` (região us-west-2) | CLI, deploy nomeado por script |

O frontend lê o backend **só do `.env`** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`,
`VITE_SUPABASE_PUBLISHABLE_KEY`). Não fixe URL nem chave em código: na origem, um bloco fixo no
`vite.config.ts` tinha precedência sobre o `.env` e fazia o `npm run dev` falar com a produção.

Deploy e SQL feitos por CLI ou dashboard **não voltam sozinhos para o git**. Todo drift entre repo e
produção nasce do lado do Supabase.

O Lovable **não reescreve histórico**: nada de force push, rebase ou amend em commit já enviado
(ver `AGENTS.md`). O projeto está registrado no Lovable com o modelo TanStack Start, mas o app é
Vite + React Router; se um commit do Lovable trouxer `src/routes/` ou `src/router.tsx`, pare.

## Antes de qualquer deploy ou migration

Os segredos ficam no `.env.local` (fora do git): `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_PASSWORD`, `SUPABASE_POOLER_HOST`. Carregue-os no terminal antes:

```bash
set -a; . ./.env.local; set +a
node scripts/check-drift.mjs                 # o repo bate com as funções no ar?
node scripts/deploy-function.mjs <slug>      # deploy nomeado
node scripts/ensaio-banco.mjs                # migrations pendentes + comportamento, sempre em ROLLBACK
npx supabase@2.121.0 db push -p "$SUPABASE_DB_PASSWORD"   # só depois do ensaio passar
```

Os scripts recusam rodar sem `SUPABASE_PROJECT_REF`: não há projeto padrão, de propósito.
Se `check-drift` acusar divergência, **capture a produção para o repo antes** (RULES.md §1).

## Nunca faça

- `supabase functions deploy` **sem nome de função** — deploya todas, na direção repo → produção.
  Há guarda automática (`scripts/guard-supabase-command.mjs`), mas ela só cobre sessões de agente.
- `supabase db reset` contra o projeto remoto.
- Alterar schema pelo dashboard sem criar a migration correspondente.
- Commitar dado real de cliente (nome, documento, telefone, e-mail) — inclusive em fixture de teste.
- Embutir token em script versionado.

## Onde as coisas estão

- `supabase/functions/` — `create-user`, `update-user`, `delete-user` (usuários, via service role
  com checagem de permissão) e `upload-anexo` + `storage-signed-url` (anexos da negociação no bucket
  privado `anexos`: o banco guarda o caminho, o link é assinado na hora de abrir).
- `supabase/functions/_shared/` — código compartilhado entre funções. **Mudar aqui afeta várias.**
- `supabase/migrations/` — começa pela migration base (`20261014120000_base_crm_vynka.sql`), o schema
  inteiro num arquivo. Toda mudança depois dela é uma migration nova, ensaiada antes com
  `scripts/ensaio-banco.mjs`.
- `supabase/config.toml` — declara o `verify_jwt` de cada função. É contrato de deploy, não
  documentação (RULES.md §11). Toda função nova ganha o seu bloco.
- `scripts/` — ferramental de drift, deploy e a guarda de comandos do Supabase.
- `src/test/` — vitest. Fixtures anonimizadas. `baseMigration.ts` lê a migration base para os
  contratos de schema.

## Testes

`npm run test` (vitest) · `npm run build` · `npm run lint` (tem baseline de erros pré-existentes;
compare antes/depois em vez de exigir zero).

**Typecheck: `npx tsc -p tsconfig.app.json --noEmit`.** Não use `npx tsc --noEmit` na raiz: o
`tsconfig.json` tem `"files": []` com project references, então ele **não checa nada e sai 0
sempre**. `npm run build` também não substitui: o esbuild remove os tipos sem verificá-los.

Os testes `*-contract.test.ts` são **textuais**: leem arquivos-fonte e exigem literais neles. Se você
renomear ou mover uma função, eles quebram — e isso é intencional.

## Aprendizados que custaram caro (o resumo; o detalhe está no RULES.md)

- **Produção pode estar mais correta que o repo.** Verifique a direção do drift antes de deployar.
- **Semântica de terceiro se lê na documentação dele**, não se deduz do código.
- **Teste tem de morder.** Check novo nasce com mutante; teste o oráculo também.
- **Rollback se valida executando.** Sem ambiente descartável, aplique dentro de uma transação e dê
  `ROLLBACK` — exercendo **o comando que o cliente emite**, não o equivalente lógico.
- **Em RLS, escrita depende de leitura.** O que a policy de `SELECT` esconde, o `UPDATE` não alcança
  (0 linhas, em silêncio), e `INSERT ... ON CONFLICT` — que o `.upsert()` do supabase-js sempre
  acrescenta — também exige passar pelo `SELECT`.
- **Fase sombra.** Mudança de risco se valida em produção com outro nome antes de promover.
- **Experimento precisa de braço positivo**, senão a conclusão não se sustenta.

## Como trabalhar com o operador

Desafie a premissa antes de executar. Ofereça forks com recomendação, não só opções. Meça antes de
afirmar — e diga claramente o que foi medido, o que foi inferido e o que não foi verificado.
Português do Brasil, sem hype: mecanismo ou número.
