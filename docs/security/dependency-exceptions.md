# Exceções temporárias de dependências

Baseline revisto em 1º de setembro de 2026. O gate final manteve `next@15.5.25`, atualizou `vitest` e `@vitest/coverage-v8` para `4.1.11` e atualizou `tailwindcss` e `@tailwindcss/postcss` para `4.3.3`. Essas atualizações retiraram as três vulnerabilidades críticas que apareciam somente na toolchain de desenvolvimento.

Comandos executados:

```text
npm install next@15.5.25 --save-exact
npm install --save-dev --save-exact vitest@4.1.11 @vitest/coverage-v8@4.1.11
npm install --save-dev --save-exact tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3
npm audit --omit=dev
npm audit
npm ls --omit=dev @babel/core @hono/node-server @opentelemetry/core @protobufjs/utf8 brace-expansion deepmerge-ts dompurify fast-uri fast-xml-builder form-data hono js-yaml lodash.pick nanoid nth-check postcss protobufjs qs sharp valibot ws xlsx
```

O audit de produção reportou 33 vulnerabilidades: 1 baixa, 13 moderadas e 19 altas, sem vulnerabilidade crítica. O audit completo reportou 34 vulnerabilidades: 1 baixa, 13 moderadas e 20 altas, também sem vulnerabilidade crítica. Não foi executado `npm audit fix` nem `npm audit fix --force`, porque o primeiro alteraria várias famílias simultaneamente e o segundo migraria Next.js e Cheerio com mudanças incompatíveis. As exceções abaixo não representam aceitação definitiva do risco.

| Dependência ou cadeia | Severidade observada | Superfície usada | Mitigação e risco residual | Revisão |
|---|---:|---|---|---:|
| `xlsx@0.18.5` | alta, sem correção publicada no registro npm | Seis uploads administrativos e scripts locais de conversão/importação | As APIs exigem administrador e agora validam extensão e MIME, limitam o arquivo a 5 MiB e rejeitam workbooks com mais de 25 abas ou 100.000 células antes de iterar dados. Scripts locais não são endpoints HTTP. Permanece risco no parser durante `xlsx.read`; substituição por `exceljs` depende de fixtures de equivalência, inclusive `.xls`. Advisories: [prototype pollution](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) e [ReDoS](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9). | 30/09/2026 |
| `next@15.5.25` → `postcss`, `nanoid`, `sharp` | alta | Build, CSS e otimização de imagens do Next.js | Os advisories próprios corrigíveis na linha 15.5 deixaram o audit. A correção sugerida para a cadeia remanescente instala Next.js 16.3.4 e, por isso, exige uma migração separada com build e regressão visual. Até lá, não aceitar CSS ou source maps por upload e manter limites nos fluxos de imagem. | 30/09/2026 |
| `@sentry/nextjs@10.50.0` → `@babel/core`, OpenTelemetry, `brace-expansion`, `fast-uri` | baixa, moderada e alta | Instrumentação, traces e plugin de build | Não há uso direto dessas transitivas pela aplicação. Entradas de glob e configuração do plugin são definidas no repositório, não por requisição. Atualizar Sentry e validar geração de sourcemaps em mudança isolada. | 30/09/2026 |
| `prisma@7.8.0` → `@prisma/dev`, Hono, `@hono/node-server`, `deepmerge-ts`, `valibot`, `fast-uri` | moderada e alta | Geração do client e comandos de banco no build ou manutenção | Os pacotes afetados pertencem à CLI/toolchain; handlers usam `@prisma/client`. Não expor Prisma CLI nem servidor de desenvolvimento em produção. Avaliar mover `prisma` para `devDependencies` somente após confirmar o `postinstall` e o build da Vercel. | 30/09/2026 |
| `@google/genai@1.44.0` → `protobufjs`, `@protobufjs/utf8`, `ws`, `brace-expansion` | moderada e alta | Geração por IA, embeddings e autenticação do SDK | A aplicação não compila schemas protobuf fornecidos pelo usuário. Permanecem riscos de negação de serviço nas transitivas; limites de entrada, quota fechada e atualização do SDK devem ser validados antes de ampliar endpoints públicos de IA. | 30/09/2026 |
| `@aws-sdk/client-s3@3.995.0` → `fast-xml-builder` | alta | Operações server-side no armazenamento R2/S3 | Comandos e nomes de atributos XML são definidos pelo código; respostas provêm do provedor configurado. Atualizar a família AWS SDK em lote e repetir testes de upload, URL assinada e exclusão. | 30/09/2026 |
| `@mailchimp/mailchimp_marketing@3.0.80` e `cohere-ai@8.0.0` → `form-data`, `qs` | moderada e alta | Chamadas server-side de newsletter e reranking | Nomes de campos multipart e parâmetros são definidos pela aplicação. Não encaminhar nomes de campos ou filenames arbitrários do usuário para esses SDKs. Atualizar cada SDK separadamente e testar as integrações com mocks, sem envio real. | 30/09/2026 |
| `cheerio@0.22.0` → `lodash.pick`, `css-select`, `nth-check` | alta | Scrapers de DOU, legislação e tribunais, além de scripts locais | Há exposição real a HTML externo, embora as fontes sejam determinadas pelo código e não exista upload público genérico de HTML identificado. A mitigação é parcial; manter fontes permitidas, timeout e limite de resposta, e preparar migração testada para Cheerio 1.2.0. | 15/09/2026 |
| `gray-matter@4.0.3` → `js-yaml` | alta | Parser de conteúdo Obsidian e scripts de importação | Uso restrito a arquivos locais controlados pelo projeto. Não processar frontmatter enviado por usuário até a atualização do parser YAML. | 30/09/2026 |
| `jspdf@4.2.1` → `dompurify` | moderada | Geração de PDF server-side e rota de exportação | Não há import direto de DOMPurify nem uso explícito dos modos `IN_PLACE`, hooks ou `CUSTOM_ELEMENT_HANDLING` afetados. Atualizar jsPDF separadamente e comparar PDFs gerados. | 30/09/2026 |
| `docx@9.5.1` → `nanoid` | alta | Script local de exportação Word | A aplicação não chama os geradores customizados vulneráveis e o uso identificado está fora de endpoint HTTP. Atualizar `docx` e conferir o arquivo exportado antes de remover a exceção. | 30/09/2026 |

## Critério para remoção

Uma exceção somente pode ser removida depois que `npm audit --omit=dev` deixar de apontar a cadeia correspondente e os testes da superfície afetada passarem. A substituição de `xlsx` exige fixtures representativas de todos os formatos efetivamente aceitos, comparação de leitura e escrita e retirada do pacote da árvore da aplicação web.
