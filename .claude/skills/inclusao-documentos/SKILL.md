---
name: inclusao-documentos
description: Use ao inserir novos documentos no banco do Site do Barral — Document (boa prática, orientação de procedimento, parecer, ON, enunciado, DECOR) ou LegislativeAct (lei, decreto, IN, portaria, MP, resolução, ordem de serviço). Obrigatório em qualquer inclusão em lote ou individual. Cobre validação prévia de URLs (nunca inserir URL não validada), campos obrigatórios, inserção via PrismaNeon, indexação de embeddings, invalidação de cache e verificação pós-deploy. Gatilhos: "inserir documentos", "incluir no banco", "importar pareceres/ONs/enunciados", "adicionar ato normativo", "novos documentos no acervo".
---

# Inclusão de Novos Documentos

**REGRA: este workflow DEVE ser seguido toda vez que novos documentos forem adicionados ao banco do Site do Barral.** Nenhuma etapa é opcional.

## Pré-requisitos

- Projeto: `/Users/danba/Site do Barral/sitedobarral/`
- Scripts standalone usam adapter PrismaNeon + dotenv (`.env.local`) — `PrismaClient` sem adapter **não funciona**
- Categorias válidas (`Document`): `boa_pratica`, `orientacao_procedimento`, `pareceres`, `orientacao-normativa`, `enunciados`, `decor`
- Tipos válidos (`LegislativeAct`): `decreto`, `portaria`, `in`, `ordem-servico`, `lei`, `medida-provisoria`, `resolucao`

## Etapa 1 — Coleta e validação de URLs (ANTES de inserir)

1. Listar todas as URLs que serão inseridas.
2. Para CADA URL, fazer requisição HTTP HEAD/GET e classificar:
   - `200` → OK
   - `404` → URL quebrada, **não inserir com essa URL**
   - `403`/`401` → requer login (ex.: Sapiens AGU), **não inserir com essa URL**
   - Redirect para página de login → **não inserir com essa URL**
   - Timeout → tentar novamente; se persistir, **não inserir com essa URL**
3. Para URLs de PDF, verificar que o `Content-Type` contém `application/pdf`.
4. Se a URL for inválida: buscar alternativa (`gov.br`, `planalto.gov.br`, `in.gov.br`) ou inserir sem URL (`url: ''`, `type: 'text'`).
5. **NUNCA inserir documento com URL não validada.**

## Etapa 2 — Preparação dos dados

1. Verificar se o documento já existe no banco (buscar por título ou `fullNumber`).
2. Campos obrigatórios de `Document`: `title`, `category`, `isPublic: true`, `reviewed: true`, `isCommon: true`.
3. Campos obrigatórios de `LegislativeAct`: `fullNumber` (unique), `type`, `number`, `year`, `title`, `issuer`, `hierarchyLevel`.
4. Campos JSON (`themes`, `leiArticles`, `tags`) devem ser gravados com `JSON.stringify(array)`.
5. Datas em formato ISO: `new Date('YYYY-MM-DD')`.

## Etapa 3 — Inserção no banco

1. Usar script com adapter PrismaNeon.
2. Preferir `createMany` com `skipDuplicates: true` quando possível.
3. Logar cada inserção bem-sucedida.
4. Tratar erros individualmente — um erro não deve derrubar o lote inteiro.

## Etapa 4 — Indexação de embeddings

1. `Document`: `npx tsx scripts/migrate-to-embeddings.ts --category <category>`
2. `LegislativeAct`: `npx tsx scripts/index-legislative-acts.ts`
3. Conferir que o status final ficou `completed`, não `failed`.

## Etapa 5 — Invalidação de cache

1. O cache Redis tem TTL de 2 horas para atos legislativos.
2. Para invalidação imediata: chamar a API com `?_revalidate=CRON_SECRET`.
3. Ou aguardar a expiração natural do TTL.

## Etapa 6 — Deploy (se houve mudança de código)

1. Commit e push para `main`.
2. Monitorar o deploy na Vercel.
3. Aguardar status `READY`.

## Etapa 7 — Verificação pós-deploy

1. Acessar a API de produção e confirmar que os novos documentos aparecem.
2. Testar no navegador pelo menos 3 URLs aleatórias dos novos documentos.
3. Verificar que a busca por IA retorna os novos documentos.
4. Reportar ao usuário: quantidade inserida, URLs OK, URLs com problema.

## Erros comuns a evitar

- **URLs Sapiens AGU** (`sapiens.agu.gov.br`): sempre exigem login → não usar.
- **URLs gov.br desatualizadas**: páginas mudam de endereço → validar antes.
- **PDFs em CDN temporário**: URLs expiram → preferir endereços permanentes.
- **Esquecer os embeddings**: documento sem embedding não aparece na busca por IA.
- **Esquecer o cache**: dados novos podem levar 2h para aparecer se não houver invalidação.
- **`PrismaClient` sem adapter**: scripts standalone PRECISAM do adapter PrismaNeon.

## Regra relacionada

**NUNCA excluir documentos do banco** a não ser que o usuário solicite explicitamente.
