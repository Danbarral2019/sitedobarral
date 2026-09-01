# Checklist de implantação e rollback

## Identificação da mudança

- responsável: `[preencher]`;
- aprovador: `[preencher]`;
- branch e commit: `[preencher]`;
- URL e identificador do preview: `[preencher]`;
- deployment de produção: `[preencher]`;
- início e término em UTC: `[preencher]`;
- ponto de recuperação do banco, quando aplicável: `[preencher]`.

Não registrar connection strings, tokens, cookies, dados pessoais ou conteúdo privado.

## Antes do preview

- [ ] O diff contém somente arquivos previstos para a onda de implantação.
- [ ] `NEXT_PUBLIC_BASE_URL` usa `https://profdanielbarral.com` em produção.
- [ ] Segredos estão configurados no ambiente correto e não aparecem no repositório.
- [ ] `TEST_DATABASE_URL` aponta para banco sintético isolado, nunca para produção.
- [ ] O ambiente de preview não compartilha credenciais de escrita da produção.
- [ ] As exceções em `docs/security/dependency-exceptions.md` foram revistas.
- [ ] Alterações de schema seguem `docs/database/migration-runbook.md` em janela própria.
- [ ] Pagamentos, e-mail e IA usam sandbox, mocks ou permanecem desabilitados.

## Gate técnico

Executar em instalação limpa e registrar código de saída e contagens:

```bash
npm ci
npx prisma generate
npm run lint
npx tsc --noEmit --incremental false
npm run test:run
npm run test:coverage
npm run build
npm run test:e2e:smoke
```

Qualquer código diferente de zero impede a publicação. O smoke local depende de PostgreSQL com pgvector; quando o serviço não existe na máquina, o gate deve ser concluído no CI antes de promover o deployment.

## Invariantes de segurança

- [ ] Visitante recebe 401 em todas as rotas `/api/admin/**`.
- [ ] Usuário autenticado sem papel administrativo recebe 403 nas mesmas rotas.
- [ ] Matrícula expirada não acessa aula, módulo, progresso nem download.
- [ ] Documento comum restrito é baixável somente por usuário com acesso ativo.
- [ ] Redis ausente bloqueia IA e autenticação sensível antes de provedor pago.
- [ ] Cron sem `CRON_SECRET` retorna erro de configuração.
- [ ] Chat público não recebe resumo de documento privado.
- [ ] Upload de planilha administrativa respeita tipo, 5 MiB, 25 abas e 100.000 células.

## Desempenho

Baseline da auditoria anterior à paginação:

- JavaScript compartilhado: 185 kB;
- `/glossario`: 433 kB de First Load JS;
- carga inicial do glossário: 95 termos.

Critérios de liberação:

- [ ] `/glossario` abaixo de 300 kB de First Load JS.
- [ ] Nenhuma rota pública nova acima de 300 kB.
- [ ] O glossário solicita no máximo 30 termos por página.
- [ ] Busca, letra e categoria reiniciam a paginação.
- [ ] O botão `Carregar mais` acrescenta resultados sem duplicação.
- [ ] Desktop e viewport móvel de 390 px passam no smoke.

Build local de 1º de setembro de 2026:

- JavaScript compartilhado: 185 kB;
- `/glossario`: 191 kB de First Load JS;
- redução do First Load JS do glossário: 242 kB, aproximadamente 56%;
- carga inicial: 30 termos, com continuação explícita por botão.

## Preview e observação

- [ ] Executar smoke público, autorização administrativa, expiração de curso e download com dados sintéticos.
- [ ] Confirmar 401, 403 e 429 esperados nos logs.
- [ ] Observar erros, latência e consumo de IA por pelo menos 30 minutos.
- [ ] Não usar contas, documentos, pagamentos ou mensagens reais.
- [ ] Preservar logs se houver regressão.

## Ondas de implantação

1. Onda A: guardas administrativas, acesso a cursos e downloads, atualização do framework e isolamento de planilhas.
2. Onda B: falha fechada de infraestrutura, validações públicas, URL canônica, CI e testes de navegador.
3. Banco: baseline e `prisma migrate deploy` em janela exclusiva, depois de backup, ensaio e aprovação própria.
4. Desempenho e documentação: glossário paginado somente depois da estabilidade dos fluxos críticos.

Cada onda deve ter deployment e decisão de promoção próprios. Não agrupar a primeira aplicação do baseline com uma mudança funcional.

## Verificação após produção

- [ ] Homepage, login, base de conhecimento, jurisprudência e glossário respondem.
- [ ] Canonical e metadados usam o domínio oficial.
- [ ] Rotas administrativas preservam 401 e 403.
- [ ] Downloads permitidos e negados correspondem às matrículas sintéticas de verificação.
- [ ] `npx prisma migrate status` não mostra migração pendente, quando houver janela de banco.
- [ ] Logs não mostram aumento inesperado de 401, 403, 429, 5xx ou chamadas pagas.
- [ ] Métricas de bundle e contagens de testes foram registradas.

## Critérios de rollback

Reverter ao deployment anterior se houver aumento inesperado de negações, falha de autenticação, acesso indevido, download incorreto, erro persistente, regressão de desempenho ou custo externo não previsto.

Para alteração de banco, interromper a implantação e seguir a seção de recuperação do runbook de migrações. Não editar manualmente `_prisma_migrations` nem tabelas de negócio. Reabrir tráfego somente depois de restaurar o estado aprovado e repetir status, contagens e smokes.

## Registro final

- resultado: `[liberado | não publicado | revertido]`;
- commits e deployments por onda: `[preencher]`;
- comandos e códigos de saída: `[preencher]`;
- testes aprovados, ignorados e falhos: `[preencher]`;
- cobertura: `[preencher]`;
- vulnerabilidades remanescentes: `[preencher]`;
- métricas de bundle: `[preencher]`;
- resultado dos smokes: `[preencher]`;
- observações e rollback: `[preencher]`.
