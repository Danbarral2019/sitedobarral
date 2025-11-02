# Sistema de Links DOU (Diário Oficial da União)

## 📋 Visão Geral

O **Sistema DOU** captura e armazena automaticamente os links de publicações oficiais no Diário Oficial da União para documentos AGU (Orientações Normativas, Pareceres, Súmulas, etc.).

**Por que é importante?**
- ✅ Link oficial da publicação legal
- ✅ Data oficial de publicação (validade jurídica)
- ✅ Seção, página e edição do DOU (referência completa)
- ✅ Rastreabilidade e conformidade legal

---

## 🏗️ Arquitetura

### Campos no Banco de Dados

**Tabela:** `Document`

```prisma
model Document {
  // ... outros campos

  // Sistema de Links DOU (Diário Oficial da União)
  douUrl              String?   // URL da publicação no DOU
  douData             DateTime? // Data de publicação no DOU
  douSecao            String?   // Seção do DOU (1, 2, 3)
  douPagina           String?   // Página no DOU
  douEdicao           String?   // Edição/número do DOU

  // Índices
  @@index([douData])           // Ordenar por data DOU
  @@index([douSecao])          // Filtrar por seção
  @@index([category, douData]) // Buscar por categoria + data DOU
}
```

### Interface TypeScript

**Arquivo:** `lib/agu-types.ts`

```typescript
export interface AGUDocument {
  // ... outros campos

  /** Sistema de Links DOU (Diário Oficial da União) */
  douUrl?: string;        // URL da publicação no DOU
  douData?: string;       // Data de publicação (DD/MM/YYYY)
  douSecao?: string;      // Seção do DOU (1, 2, 3)
  douPagina?: string;     // Página no DOU
  douEdicao?: string;     // Edição/número do DOU
}
```

---

## 🔍 Extração Automática de Informações

### Função Principal

**Arquivo:** `lib/agu-modules/helpers.ts`

```typescript
export function extractDOUInfo(douUrlOrText: string): DOUInfo | null
```

### Como Funciona

A função `extractDOUInfo()` extrai automaticamente informações do DOU a partir de:

1. **URL do DOU** direto
2. **Texto contendo** a URL do DOU
3. **Metadados** ao redor da URL (data, seção, página, edição)

### Exemplos de Extração

#### Exemplo 1: URL simples
```typescript
const info = extractDOUInfo('https://www.in.gov.br/web/dou/-/orientacao-normativa-n-50-de-25-de-outubro-de-2024-589384562');

// Resultado:
// {
//   douUrl: 'https://www.in.gov.br/web/dou/-/orientacao-normativa-n-50-de-25-de-outubro-de-2024-589384562',
//   douData: '25/10/2024',
//   douSecao: undefined,
//   douPagina: undefined,
//   douEdicao: undefined
// }
```

#### Exemplo 2: Texto com metadados
```typescript
const texto = `
  Publicado no DOU Seção 1, página 45, edição nº 203 de 25/10/2024
  Link: https://www.in.gov.br/web/dou/-/orientacao-normativa-n-50
`;

const info = extractDOUInfo(texto);

// Resultado:
// {
//   douUrl: 'https://www.in.gov.br/web/dou/-/orientacao-normativa-n-50',
//   douData: '25/10/2024',
//   douSecao: '1',
//   douPagina: '45',
//   douEdicao: '203'
// }
```

#### Exemplo 3: Formatos de data suportados
```typescript
// DD/MM/YYYY ou DD-MM-YYYY
extractDOUInfo('25/10/2024'); // → '25/10/2024'
extractDOUInfo('25-10-2024'); // → '25/10/2024'

// "de DD de MMMM de YYYY"
extractDOUInfo('de 25 de outubro de 2024'); // → '25/10/2024'

// YYYY-MM-DD (ISO)
extractDOUInfo('2024-10-25'); // → '25/10/2024'
```

---

## 📥 Integração com AGU Scraper

### Fluxo Automático

```
1. AGU Scraper extrai documento
   ↓
2. Verifica se há URL do DOU no HTML/texto
   ↓
3. Se encontrar, chama extractDOUInfo()
   ↓
4. Preenche campos douUrl, douData, etc.
   ↓
5. Salva no banco de dados
```

### Implementação nos Módulos AGU

Os módulos AGU devem extrair o link DOU durante o scraping:

```typescript
// No scraper de Orientações Normativas
import { extractDOUInfo, isDOUUrl } from './helpers';

function extractOrientacaoNormativa(html: string): AGUDocument {
  // ... extrair dados básicos

  // Procurar link do DOU no HTML
  const douInfo = extractDOUInfo(html);

  return {
    // ... outros campos
    douUrl: douInfo?.douUrl,
    douData: douInfo?.douData,
    douSecao: douInfo?.douSecao,
    douPagina: douInfo?.douPagina,
    douEdicao: douInfo?.douEdicao,
  };
}
```

---

## 🎯 Use Cases

### 1. Verificar Publicação Oficial

```typescript
const doc = await prisma.document.findUnique({
  where: { id: documentId }
});

if (doc.douUrl) {
  console.log(`Publicado no DOU em ${doc.douData}`);
  console.log(`Link: ${doc.douUrl}`);
} else {
  console.log('Documento ainda não publicado no DOU');
}
```

### 2. Listar Documentos Publicados Recentemente

```typescript
const recentDOU = await prisma.document.findMany({
  where: {
    category: 'orientacao-normativa',
    douData: {
      gte: new Date('2024-01-01')
    }
  },
  orderBy: { douData: 'desc' },
  take: 10
});

for (const doc of recentDOU) {
  console.log(`${doc.title} - DOU ${doc.douData}`);
}
```

### 3. Filtrar por Seção do DOU

```typescript
const secao1 = await prisma.document.findMany({
  where: {
    douSecao: '1' // Seção 1 = Atos normativos
  }
});

const secao3 = await prisma.document.findMany({
  where: {
    douSecao: '3' // Seção 3 = Contratos, editais, avisos
  }
});
```

### 4. Enriquecer Documento Manualmente

```typescript
// Adicionar link DOU a documento existente
const info = extractDOUInfo('https://www.in.gov.br/web/dou/-/orientacao-normativa-n-50');

await prisma.document.update({
  where: { id: documentId },
  data: {
    douUrl: info?.douUrl,
    douData: info?.douData ? new Date(formatDateBR(info.douData)) : undefined,
    douSecao: info?.douSecao,
    douPagina: info?.douPagina,
    douEdicao: info?.douEdicao,
  }
});
```

---

## 📊 Seções do DOU

O Diário Oficial da União é dividido em 3 seções:

| Seção | Conteúdo | Exemplos de Documentos AGU |
|-------|----------|----------------------------|
| **Seção 1** | Atos normativos (leis, decretos, portarias, etc.) | Orientações Normativas, Portarias AGU |
| **Seção 2** | Atos de pessoal (nomeações, exonerações, etc.) | Raramente usado para documentos AGU |
| **Seção 3** | Contratos, editais, avisos, licitações | Editais de licitação, avisos de contratação |

**Mais comum para documentos AGU:** Seção 1

---

## 🔧 Funções Helper

### `extractDOUInfo(douUrlOrText: string): DOUInfo | null`

Extrai informações completas do DOU a partir de URL ou texto.

**Parâmetros:**
- `douUrlOrText` - URL do DOU ou texto contendo a URL

**Retorna:**
```typescript
{
  douUrl: string;      // URL completa
  douData?: string;    // Data (DD/MM/YYYY)
  douSecao?: string;   // Seção (1, 2, 3)
  douPagina?: string;  // Página
  douEdicao?: string;  // Edição/número
}
```

### `isDOUUrl(url: string): boolean`

Verifica se uma URL é do DOU.

**Exemplos:**
```typescript
isDOUUrl('https://www.in.gov.br/web/dou/-/orientacao-50'); // true
isDOUUrl('https://www.agu.gov.br/parecer-123');            // false
```

---

## 🚀 Próximos Passos

### Fase 2: Enriquecimento Automático

1. **Buscar Automaticamente no DOU**
   - Para documentos sem link DOU, buscar automaticamente
   - Usar API do DOU (se disponível) ou scraping
   - Preencher campos automaticamente

2. **Validação de Links**
   - Verificar se link DOU está ativo
   - Atualizar se houver mudança de URL
   - Alertar se link quebrado

### Fase 3: Interface Admin

1. **Visualização**
   - Mostrar badge "Publicado no DOU" nos documentos
   - Link direto para DOU
   - Data de publicação destacada

2. **Edição Manual**
   - Campo para adicionar/editar link DOU
   - Validação automática do link
   - Preview da publicação do DOU

### Fase 4: Notificações

1. **Alertas de Publicação**
   - Notificar quando documento for publicado no DOU
   - Email automático para admin
   - Atualizar status do documento

---

## 📝 Resumo

**Sistema Atual:**
- ✅ Campos douUrl, douData, douSecao, douPagina, douEdicao no schema
- ✅ Função extractDOUInfo() para extração automática
- ✅ Suporte a múltiplos formatos de data
- ✅ Detecção automática de metadados (seção, página, edição)
- ✅ Função isDOUUrl() para validação
- ✅ Índices no banco para consultas eficientes

**Benefícios:**
- 📚 Referência oficial completa
- ⚖️ Validade jurídica comprovada
- 🔍 Rastreabilidade total
- 📊 Organização por data de publicação
- 🎯 Conformidade legal

**Arquivos Principais:**
- `prisma/schema.prisma` - Schema do banco (campos DOU)
- `lib/agu-types.ts` - Interface AGUDocument (campos DOU)
- `lib/agu-modules/helpers.ts` - Funções de extração

---

**Última atualização:** 2025-11-02
**Versão:** 1.0
**Status:** ✅ Implementado e pronto para uso
