# Template de import de aulas revisadas

Esta pasta serve apenas como **exemplo do formato esperado** pelo script `scripts/import-revised-course.ts`.

## Como usar

1. Crie uma pasta nova com o `slug` do curso (ex: `contratacao-direta/`, `planejamento-contratacoes/`).
2. Copie `01-exemplo-de-aula.md` pra dentro dela e renomeie pra cada aula.
3. **Numerar com prefixo** (`01-`, `02-`...) é recomendado pra preservar ordem.
4. Edite o frontmatter YAML e o conteúdo Markdown com a versão revisada.
5. Rode dry-run primeiro:
   ```
   npx dotenv -e .env.local -- tsx scripts/import-revised-course.ts contratacao-direta --dryRun
   ```
6. Se o resumo bater com o esperado, rode sem `--dryRun` pra aplicar.
7. Quando o curso inteiro estiver atualizado, republique:
   ```
   npx dotenv -e .env.local -- tsx scripts/republish-course.ts 10
   ```

## Campos do frontmatter

| Campo | Obrigatório | Descrição |
|---|---|---|
| `courseId` | sim | ID do curso (string), ex: `"10"` |
| `moduleSlug` | sim | Identificador estável do módulo (kebab-case). Não muda mesmo se o título mudar. |
| `moduleTitle` | sim | Título exibido do módulo. Pode mudar; o script usa o título atual pra match. |
| `moduleDescription` | não | Descrição do módulo |
| `moduleDisplayOrder` | não | Ordem do módulo (0-indexed) |
| `lessonSlug` | sim | Slug único da aula dentro do módulo (kebab-case). Chave de identificação no DB. |
| `title` | sim | Título da aula |
| `description` | não | Descrição curta |
| `displayOrder` | não | Ordem da aula no módulo |
| `estimatedMinutes` | não | Tempo estimado em minutos |
| `leiArticles` | não | Array de números de artigos da Lei 14.133 vinculados, ex: `[72, 73, 74]` |
| `aiSummary` | não | Resumo curto. Use `null` ou omita pra zerar conteúdo antigo. |
| `aiKeyPoints` | não | Array de strings com pontos-chave |
| `isPublished` | não | Default `true` |

## Importante

- O **conteúdo Markdown** depois do frontmatter vira `Lesson.content` direto (sem reprocessamento).
- Se um arquivo aponta pra `lessonSlug` que ainda não existe no módulo, o script **cria** a aula nova.
- Se o módulo (por título) ainda não existe, o script **cria** o módulo.
- **NÃO** existe deleção automática. Se você quer remover uma aula antiga, faça via `/admin/lms` ou consulta direta.
