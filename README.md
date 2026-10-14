# crm-vynka

CRM comercial: funil de negociações em lista e Kanban, qualificação BANT, tarefas e automações,
contatos e empresas, comentários com menção, anexos, alertas, lixeira e perfis de acesso.

Editor no Lovable: [crm-vynka](https://lovable.dev/projects/ade36c80-59e6-4f71-b1d6-01423a084878).
Commits na `main` sincronizam com o editor, e vice-versa. **Não reescreva o histórico já enviado**
(force push, rebase, amend): ver `AGENTS.md`.

## Desenvolvimento local

```sh
npm ci
npm run dev
```

O backend vem só do `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`,
`VITE_SUPABASE_PUBLISHABLE_KEY`). Antes de mexer em banco, funções ou deploy, leia `CLAUDE.md` e
`RULES.md`.
