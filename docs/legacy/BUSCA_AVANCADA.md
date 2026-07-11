# 🔍 Sistema de Busca Avançada - Área Restrita

## ✅ Fase 1: Busca em Metadados (IMPLEMENTADO)

### Funcionalidades Implementadas

#### 1. **Barra de Busca Fixa**
- **Localização**: Topo da área restrita, sempre visível
- **Debounce**: 300ms para evitar buscas excessivas
- **Campos pesquisados**:
  - Título do documento
  - Descrição
  - Tags
  - Categoria

#### 2. **Toggle de Escopo**
- **Curso Atual**: Busca apenas no curso selecionado
- **Todos os Cursos**: Busca em todos os cursos matriculados
- Configurável via toggle na barra de busca

#### 3. **Filtros Avançados (Drawer Lateral)**
Acessível via botão "Filtros" na barra de busca:

**Filtros disponíveis:**
- ✅ **Por Curso** (checkbox múltipla)
- ✅ **Por Categoria** (10 categorias: acórdão, parecer, artigo, etc.)
- ✅ **Por Tipo de Arquivo** (PDF, DOC, Link, Vídeo)
- ✅ **Por Data**:
  - Todos os períodos
  - Últimos 7 dias
  - Últimos 30 dias
  - Últimos 90 dias
- ✅ **Apenas Favoritos** (toggle)
- ✅ **Ordenação**:
  - Mais Relevantes (padrão)
  - Mais Recentes
  - Mais Antigos
  - A → Z
  - Z → A

#### 4. **Recursos Visuais**
- **Contador de resultados** em tempo real
- **Badge** com quantidade de filtros ativos
- **Estado vazio** quando não há resultados
- **Normalização de texto** (remove acentos, case-insensitive)
- **Score de relevância** baseado em matches no título, descrição e tags

---

## 🚀 Fase 2: Full-Text Search (PLANEJAMENTO)

### Objetivo
Permitir busca **dentro do conteúdo dos documentos PDF**, não apenas nos metadados.

### Opções de Implementação

#### **Opção A: PostgreSQL Full-Text Search** ⭐ RECOMENDADO

**Vantagens:**
- ✅ Sem custo adicional (usa banco existente)
- ✅ Muito performático para até 100k documentos
- ✅ Suporte nativo a português (dicionário pt_BR)
- ✅ Fácil integração com Prisma

**Implementação:**

1. **Adicionar campo `content` na tabela Document**
```prisma
model Document {
  id          String    @id @default(cuid())
  title       String
  description String?
  content     String?   @db.Text  // Texto extraído do PDF
  contentTSVector Unsupported("tsvector")?  // Índice full-text
  // ... outros campos

  @@index([contentTSVector], type: Gin)
}
```

2. **Extrair texto dos PDFs no upload**
```typescript
import pdf from 'pdf-parse';

async function extractPDFContent(file: Buffer): Promise<string> {
  const data = await pdf(file);
  return data.text;
}
```

3. **Criar trigger para atualizar tsvector**
```sql
CREATE TRIGGER document_content_search_update
BEFORE INSERT OR UPDATE ON "Document"
FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(
  "contentTSVector",
  'pg_catalog.portuguese',
  'title',
  'description',
  'content'
);
```

4. **Buscar usando Prisma**
```typescript
const results = await prisma.$queryRaw`
  SELECT *
  FROM "Document"
  WHERE "contentTSVector" @@ to_tsquery('portuguese', ${searchTerms})
  ORDER BY ts_rank("contentTSVector", to_tsquery('portuguese', ${searchTerms})) DESC
  LIMIT 50
`;
```

**Estimativa de tempo:** 8-12 horas de desenvolvimento

---

#### **Opção B: Algolia** 💰

**Vantagens:**
- ✅ Extremamente rápido (< 20ms)
- ✅ Typo-tolerance (corrige erros de digitação)
- ✅ Highlights automáticos
- ✅ Dashboard de analytics

**Desvantagens:**
- ❌ Custo adicional ($1/10k buscas)
- ❌ Dependência externa
- ❌ Precisa sincronizar dados

**Implementação:**
```typescript
import algoliasearch from 'algoliasearch';

const client = algoliasearch('APP_ID', 'API_KEY');
const index = client.initIndex('documents');

// Indexar documento
await index.saveObject({
  objectID: doc.id,
  title: doc.title,
  content: extractedText,
  category: doc.category,
  courseId: doc.courseId,
});

// Buscar
const { hits } = await index.search(query, {
  filters: `courseId:${courseId}`,
  attributesToRetrieve: ['title', 'description', 'content'],
  attributesToHighlight: ['title', 'content'],
});
```

**Custo estimado:** $10-50/mês dependendo do volume

---

#### **Opção C: Meilisearch** 🆓 OPEN SOURCE

**Vantagens:**
- ✅ Gratuito e open-source
- ✅ Muito rápido (similar ao Algolia)
- ✅ Self-hosted ou cloud
- ✅ Suporte a português

**Desvantagens:**
- ❌ Requer servidor adicional
- ❌ Mais complexo de configurar

**Implementação:**
```typescript
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({
  host: 'http://127.0.0.1:7700',
  apiKey: 'masterKey',
});

const index = client.index('documents');

// Indexar
await index.addDocuments([
  {
    id: doc.id,
    title: doc.title,
    content: extractedText,
    courseId: doc.courseId,
  },
]);

// Buscar
const results = await index.search(query, {
  filter: `courseId = ${courseId}`,
  limit: 20,
});
```

**Custo:** Grátis (requer servidor)

---

### Comparação das Opções

| Critério | PostgreSQL FTS | Algolia | Meilisearch |
|----------|---------------|---------|-------------|
| **Custo** | Grátis | $$ | Grátis (+ servidor) |
| **Performance** | Muito boa | Excelente | Excelente |
| **Complexidade** | Média | Baixa | Alta |
| **Manutenção** | Baixa | Nenhuma | Média |
| **Português** | ✅ Nativo | ✅ Sim | ✅ Sim |
| **Tempo para implementar** | 8-12h | 4-6h | 12-16h |

---

### Recomendação Final

**Para este projeto, recomendo PostgreSQL Full-Text Search porque:**

1. ✅ Sem custo adicional
2. ✅ Performance excelente para o volume esperado (< 10k documentos)
3. ✅ Já estamos usando PostgreSQL
4. ✅ Suporte nativo a português
5. ✅ Fácil manutenção

**Migração para Algolia/Meilisearch** só se justifica se:
- Volume de documentos > 100k
- Necessidade de buscas < 50ms
- Orçamento disponível para serviços externos

---

## 📝 Checklist para Implementar Fase 2

### Preparação
- [ ] Fazer backup completo do banco de dados
- [ ] Testar extração de texto de PDFs diversos
- [ ] Definir estratégia de re-indexação de docs existentes

### Desenvolvimento
- [ ] Adicionar campo `content` no schema Prisma
- [ ] Criar migration para adicionar campo
- [ ] Implementar extração de texto no upload de PDFs
- [ ] Criar trigger PostgreSQL para tsvector
- [ ] Modificar API `/api/documents/search` para usar full-text
- [ ] Atualizar utilitários de busca (`lib/search-utils.ts`)
- [ ] Testar performance com volume realista

### UI/UX
- [ ] Adicionar indicador "🔍 Buscando no conteúdo..."
- [ ] Implementar highlight de termos nos resultados
- [ ] Mostrar snippet do texto onde foi encontrado
- [ ] Adicionar paginação se necessário

### Testes
- [ ] Testar busca em português com acentos
- [ ] Testar busca de termos jurídicos comuns
- [ ] Testar performance com 1k+ documentos
- [ ] Testar em PDFs de diferentes tamanhos

### Documentação
- [ ] Atualizar README com instruções de busca
- [ ] Documentar processo de re-indexação
- [ ] Criar guia de troubleshooting

---

## 🔧 Bibliotecas Necessárias (Fase 2)

```bash
npm install pdf-parse
npm install --save-dev @types/pdf-parse
```

---

## 📊 Métricas e Monitoring (Fase 2)

Considerar adicionar:
- Tempo médio de busca
- Termos mais buscados
- Taxa de "zero results"
- Documentos mais acessados via busca

---

## 🎓 Recursos de Aprendizado

- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Prisma Raw Queries](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access)
- [pdf-parse](https://www.npmjs.com/package/pdf-parse)
- [Algolia Documentation](https://www.algolia.com/doc/)
- [Meilisearch](https://www.meilisearch.com/docs)

---

**Última atualização:** 2025-01-25
**Status:** Fase 1 implementada ✅ | Fase 2 planejada 📋
