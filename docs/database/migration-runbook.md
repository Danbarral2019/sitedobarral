# Runbook de baseline e migrações do banco

## Finalidade

Este procedimento substitui a sincronização implícita por `prisma db push` por migrações versionadas com `prisma migrate deploy`. O baseline canônico é `prisma/migrations/0_init/migration.sql` e representa o estado integral de `prisma/schema.prisma` em PostgreSQL, incluindo a extensão `vector`.

O procedimento não autoriza alterações no banco de produção. A marcação do baseline em produção exige aprovação expressa, separada e posterior, além da comprovação do ponto de recuperação. A execução de testes E2E contra produção é proibida.

## Responsabilidades e registros

Antes da execução, preencher e conservar no registro da mudança:

- responsável técnico: `[preencher]`;
- aprovador da mudança: `[preencher]`;
- data e hora em UTC: `[preencher]`;
- commit e imagem de implantação: `[preencher]`;
- projeto, identificador da branch e hostname do endpoint Neon: `[preencher]`;
- mecanismo e identificador do ponto de recuperação: `[preencher]`;
- resultado de cada comando, sem credenciais nem connection strings: `[preencher]`.

Nunca copiar a `DATABASE_URL` para logs, documentos, tickets ou saída de terminal. Registre somente o hostname do endpoint e o identificador da branch.

## Pré-condições

1. Congelar alterações em `prisma/schema.prisma` e em `prisma/migrations/` durante a execução.
2. Confirmar que a branch Git e o commit são os aprovados.
3. Criar, no Neon Console, uma branch de homologação derivada da produção. A branch deve ter endpoint e credenciais próprios.
4. Criar e registrar um ponto de recuperação anterior à intervenção. Usar uma branch de recuperação com nome datado ou o mecanismo de restauração disponível no plano contratado. Confirmar a possibilidade de recuperação antes de continuar.
5. Disponibilizar a URL da branch de homologação apenas em `TEST_DATABASE_URL`. Não reutilizar a URL de produção.
6. Confirmar que o endpoint esperado aparece no hostname da conexão, sem imprimir a URL completa.
7. Confirmar que não há implantação concorrente nem rotina administrativa alterando o esquema.

Referências operacionais do provedor: [branches e isolamento no Neon](https://neon.com/docs/get-started-with-neon/workflow-primer) e [extensão pgvector no Neon](https://neon.com/docs/ai/ai-concepts).

## Inspeção somente leitura

Na branch de homologação, executar as consultas abaixo em um cliente SQL seguro. Elas não alteram dados nem esquema.

```sql
SELECT current_database(), current_user, version();

SELECT extname, extversion
FROM pg_extension
WHERE extname = 'vector';

SELECT COUNT(*) AS tabelas_publicas
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

SELECT COUNT(*) AS indices_publicos
FROM pg_indexes
WHERE schemaname = 'public';

SELECT COUNT(*) AS chaves_estrangeiras
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
  AND constraint_type = 'FOREIGN KEY';

SELECT to_regclass('public._prisma_migrations') AS tabela_de_migracoes;
```

Se `public._prisma_migrations` existir, inspecionar o histórico antes de qualquer marcação:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at, logs
FROM public._prisma_migrations
ORDER BY started_at;
```

Se houver nomes de migração anteriores a `0_init`, interromper o procedimento. Não apagar nem editar registros de `public._prisma_migrations` manualmente.

Registrar também contagens de referência, sem exportar conteúdo pessoal:

```sql
SELECT 'User' AS tabela, COUNT(*) AS linhas FROM public."User"
UNION ALL
SELECT 'Document', COUNT(*) FROM public."Document"
UNION ALL
SELECT 'Enrollment', COUNT(*) FROM public."Enrollment"
UNION ALL
SELECT 'LegislativeAct', COUNT(*) FROM public."LegislativeAct"
UNION ALL
SELECT 'TribunalDecision', COUNT(*) FROM public."TribunalDecision";
```

Se a extensão `vector` não existir, interromper a marcação e confirmar a causa. O baseline declara `CREATE EXTENSION IF NOT EXISTS "vector"`, mas uma base já existente deve ser compatível antes da implantação.

## Ensaio na homologação

No terminal, partir de uma sessão em que `TEST_DATABASE_URL` aponte exclusivamente para a branch de homologação. A atribuição abaixo deve ocorrer sem exibir o valor:

```powershell
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npx prisma validate
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Interpretar o segundo comando assim:

- código `0`: nenhum desvio entre a branch e o schema, prosseguir;
- código `2`: há diferenças, interromper e revisar o SQL de diff;
- código `1`: ocorreu erro, interromper e diagnosticar.

Não usar `prisma db push`, `prisma migrate reset` ou `prisma migrate dev` em banco remoto.

Se a inspeção confirmou que o esquema já corresponde ao baseline e que não existe histórico conflitante, marcar somente a homologação:

```powershell
npx prisma migrate resolve --applied 0_init
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate status
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

A marcação `resolve --applied` registra o baseline como já existente. Ela não cria as 74 tabelas do baseline. Qualquer diferença estrutural anterior à marcação exige investigação e correção específica.

Depois do ensaio, repetir as consultas somente leitura e comparar as contagens registradas. Executar os testes de acesso administrativo, expiração de curso e download de documento apenas na branch de homologação por meio de `TEST_DATABASE_URL`.

## Implantação em produção

Esta etapa somente pode começar após nova aprovação expressa. A autorização para build de leitura não abrange `migrate resolve`, `migrate deploy`, criação de extensão ou qualquer outra escrita.

1. Confirmar o ponto de recuperação e testar o procedimento de restauração na homologação.
2. Confirmar que `NEXT_PUBLIC_BASE_URL` está definido como `https://profdanielbarral.com` no ambiente de produção.
3. Repetir a inspeção somente leitura na produção e registrar os resultados.
4. Executar o `migrate diff` e exigir código `0` antes da marcação do baseline.
5. Confirmar novamente que não há histórico conflitante em `public._prisma_migrations`.
6. Com a aprovação registrada, executar `npx prisma migrate resolve --applied 0_init` uma única vez.
7. Executar `npx prisma migrate status` e exigir ausência de migrações pendentes.
8. Implantar o commit aprovado. O build executará `prisma generate`, `prisma migrate deploy` e `next build` nessa ordem.
9. Repetir `migrate status`, o diff e as consultas somente leitura.
10. Verificar autenticação, páginas públicas, rotas administrativas e logs antes de encerrar a mudança.

## Critérios de interrupção

Interromper sem tentar corrigir diretamente a produção se ocorrer qualquer uma destas condições:

- endpoint ou branch não correspondem ao ambiente declarado;
- ponto de recuperação ausente ou não confirmado;
- `migrate diff` retorna código `1` ou `2`;
- existe histórico de migrações conflitante;
- contagens de referência diminuem inesperadamente;
- extensão `vector` ausente ou indisponível;
- migração pendente não pertence ao commit aprovado;
- erro de permissão, bloqueio, timeout ou SQL inesperado;
- falha funcional após a implantação.

## Recuperação

O Prisma não oferece rollback automático de dados. Em caso de falha:

1. interromper novas implantações e rotinas que escrevam no banco;
2. preservar logs e registrar a hora UTC do incidente;
3. restaurar o ponto anterior por meio da branch ou do mecanismo de recuperação previamente confirmado no Neon;
4. reconfigurar o endpoint apenas pelo procedimento controlado do provedor, quando necessário;
5. reimplantar o último commit conhecido como íntegro;
6. executar `npx prisma migrate status`, as consultas de contagem e os testes de fumaça;
7. reabrir o tráfego somente após comparar os resultados com o registro prévio.

Não editar tabelas de negócio nem `public._prisma_migrations` para simular uma recuperação.

## Encerramento

A mudança somente está concluída quando o status não mostra migrações pendentes, o diff retorna código `0`, as contagens são compatíveis, os testes de fumaça passam e o registro contém aprovações, horários, identificadores e resultados. Credenciais e URLs completas não integram o registro.
