# Integração Ro-DOU - Mineração Automática de Dados do DOU

## 📋 Visão Geral

**Ro-DOU** é uma ferramenta open-source do Governo Federal que realiza clipping automático do Diário Oficial da União (DOU) e diários municipais.

**Repositório:** https://github.com/gestaogovbr/Ro-dou
**Documentação:** https://gestaogovbr.github.io/Ro-dou/

### Por que integrar?

Atualmente, nosso sistema captura documentos de:
- ✅ AGU (Orientações Normativas, Pareceres, Súmulas)
- ✅ TCU (Acórdãos via API)
- ❌ **DOU direto** - ainda não implementado

O Ro-DOU pode **complementar** nosso sistema capturando:
- 📰 Publicações de normas, portarias, decretos relacionados a licitações
- 📄 Editais de licitação publicados no DOU
- 🏛️ Atos normativos de órgãos públicos (CGU, CGE, etc.)
- 📋 Avisos de contratação direta
- ⚖️ Decisões administrativas publicadas oficialmente

---

## 🏗️ Arquitetura do Ro-DOU

### Tecnologias

- **Linguagem:** Python (98.3%)
- **Orquestração:** Apache Airflow (DAGs)
- **Containerização:** Docker + Kubernetes
- **Integração:** API do Querido Diário

### Como Funciona

```
1. Usuário configura palavras-chave
   ↓
2. Airflow executa DAGs programadas
   ↓
3. Busca no DOU via Querido Diário
   ↓
4. Filtra por palavras-chave
   ↓
5. Envia notificações (e-mail, Slack, Discord)
```

---

## 🎯 Proposta de Integração

### Opção 1: Integração Nativa (Recomendada)

**Instalar Ro-DOU como serviço separado** e consumir seus resultados via API.

#### Arquitetura

```
┌─────────────────────┐
│   Ro-DOU Service    │
│   (Python/Airflow)  │
│                     │
│  Palavras-chave:    │
│  - licitação        │
│  - pregão           │
│  - dispensa         │
│  - Lei 14.133       │
│  - contrato         │
└──────────┬──────────┘
           │
           │ (Webhook/API)
           ↓
┌─────────────────────┐
│  Nossa API Next.js  │
│  /api/rodou/webhook │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Prisma Database    │
│  (Document model)   │
└─────────────────────┘
```

#### Passos de Implementação

1. **Deploy do Ro-DOU**
   ```bash
   # Clone do repositório
   git clone https://github.com/gestaogovbr/Ro-dou.git
   cd Ro-dou

   # Deploy com Docker
   docker-compose up -d
   ```

2. **Configurar Palavras-Chave**

   Criar arquivo `dag_confs/licitacoes.yaml`:
   ```yaml
   id: licitacoes_contratos
   description: "Monitor de licitações e contratos no DOU"

   keywords:
     - licitação
     - pregão
     - dispensa
     - inexigibilidade
     - Lei 14.133
     - Lei 8.666
     - contrato administrativo
     - registro de preços
     - edital

   notification:
     type: webhook
     url: https://site-prof-barral.vercel.app/api/rodou/webhook
     method: POST
   ```

3. **Criar Webhook na Nossa API**

   `app/api/rodou/webhook/route.ts`:
   ```typescript
   import { NextRequest } from 'next/server';
   import { importDOUDocument } from '@/lib/dou-module';

   export async function POST(request: NextRequest) {
     const data = await request.json();

     // Validar secret
     if (request.headers.get('x-rodou-secret') !== process.env.RODOU_SECRET) {
       return Response.json({ error: 'Unauthorized' }, { status: 401 });
     }

     // Importar documento
     const result = await importDOUDocument(data);

     return Response.json({ success: true, documentId: result.id });
   }
   ```

4. **Processar Dados do Ro-DOU**

   `lib/dou-module.ts`:
   ```typescript
   export async function importDOUDocument(roDOUData: any) {
     const { isRelevant, score } = analyzeRelevanceDOU(
       roDOUData.title,
       roDOUData.content
     );

     if (!isRelevant) {
       console.log('Documento não relevante, descartado');
       return null;
     }

     const doc = await prisma.document.create({
       data: {
         title: roDOUData.title,
         description: roDOUData.excerpt,
         content: roDOUData.content,
         url: roDOUData.url,
         category: detectCategory(roDOUData.title),
         type: 'link',
         isPublic: true,
         douUrl: roDOUData.url,
         douData: new Date(roDOUData.publication_date),
         douSecao: roDOUData.section,
         douPagina: roDOUData.page,
         tags: JSON.stringify([...roDOUData.keywords, 'DOU']),
       }
     });

     return doc;
   }
   ```

---

### Opção 2: Integração via API Querido Diário (Alternativa)

**Usar API do Querido Diário diretamente**, sem Ro-DOU.

#### Vantagens
- ✅ Controle total sobre as buscas
- ✅ Não precisa manter serviço Airflow
- ✅ Integração mais simples

#### Desvantagens
- ❌ Precisa implementar toda lógica de filtragem
- ❌ Sem sistema de notificações pronto
- ❌ Mais trabalho de desenvolvimento

#### Implementação

```typescript
// lib/querido-diario-api.ts
export async function searchQueridoDiario(
  keywords: string[],
  dateFrom?: string,
  dateTo?: string
) {
  const query = keywords.join(' OR ');

  const response = await fetch(
    `https://api.queridodiario.ok.org.br/api/gazettes?querystring=${encodeURIComponent(query)}&since=${dateFrom}&until=${dateTo}`
  );

  const data = await response.json();
  return data.gazettes;
}
```

---

## 📊 Comparação de Opções

| Aspecto | Opção 1: Ro-DOU | Opção 2: API Direta |
|---------|-----------------|---------------------|
| **Complexidade** | Média (deploy Airflow) | Baixa (apenas API calls) |
| **Manutenção** | Alta (serviço separado) | Baixa (código Next.js) |
| **Features** | Sistema completo (notificações, DAGs) | Básico (apenas busca) |
| **Custo** | Servidor adicional | Sem custo extra |
| **Flexibilidade** | Limitada (configuração YAML) | Total (código custom) |
| **Open Source** | ✅ Sim | ✅ Sim |
| **Recomendação** | 🥇 Para alto volume | 🥈 Para começar |

---

## 🎯 Casos de Uso

### 1. Captura de Editais de Licitação

```yaml
# Ro-DOU config
keywords:
  - "AVISO DE LICITAÇÃO"
  - "PREGÃO ELETRÔNICO"
  - "TOMADA DE PREÇOS"
  - "CONCORRÊNCIA PÚBLICA"

filters:
  section: "3" # Seção 3 do DOU (editais)
```

**Resultado:** Importar automaticamente editais publicados no DOU

### 2. Monitoramento de Normas

```yaml
keywords:
  - "PORTARIA.*LICITAÇ"
  - "DECRETO.*CONTRATO"
  - "INSTRUÇÃO NORMATIVA.*PREGÃO"

filters:
  section: "1" # Seção 1 do DOU (normas)
```

**Resultado:** Capturar portarias, decretos, INs sobre licitações

### 3. Atos da AGU

```yaml
keywords:
  - "ADVOCACIA-GERAL DA UNIÃO"
  - "AGU"
  - "ORIENTAÇÃO NORMATIVA"
  - "PARECER.*VINCULANTE"

filters:
  section: "1"
```

**Resultado:** Complementar scraper AGU com publicações oficiais no DOU

---

## 🚀 Implementação Recomendada (Fase 1)

### Passo 1: Integração API Direta (Rápida)

**Começar com API do Querido Diário** para validar conceito:

1. Criar `lib/querido-diario.ts`
2. Implementar busca por palavras-chave
3. Filtrar por relevância usando `shared-keywords.ts`
4. Importar com versionamento
5. Testar com 100 documentos

**Estimativa:** 1-2 dias

### Passo 2: Avaliar Volume e Qualidade

- Quantos documentos relevantes?
- Taxa de falsos positivos?
- Frequência de publicações?

### Passo 3: Decidir sobre Ro-DOU

Se volume alto (>50 docs/dia): **Implementar Ro-DOU**
Se volume baixo (<20 docs/dia): **Manter API direta**

---

## 📝 Estrutura de Dados do DOU

### Campos Típicos (Querido Diário)

```json
{
  "id": "12345",
  "territory_id": "BR",
  "date": "2024-11-02",
  "edition_number": "210",
  "is_extra_edition": false,
  "power": "executive",
  "file_checksum": "abc123",
  "file_path": "https://...",
  "file_url": "https://...",
  "scraped_at": "2024-11-02T10:00:00",
  "created_at": "2024-11-02T10:05:00",
  "territory_name": "Brasil",
  "state_code": "BR",
  "excerpts": [
    {
      "excerpt": "AVISO DE LICITAÇÃO...",
      "highlight": "PREGÃO ELETRÔNICO Nº 10/2024"
    }
  ]
}
```

### Mapeamento para Nosso Schema

```typescript
{
  title: excerpt.highlight || generateTitle(excerpt),
  description: excerpt.excerpt,
  url: file_url,
  category: detectCategory(excerpt.excerpt), // "edital", "portaria", "decreto"
  type: 'link',
  isPublic: true,
  douUrl: file_url,
  douData: new Date(date),
  douSecao: detectSection(power, excerpt),
  douEdicao: edition_number,
  tags: extractTags(excerpt.excerpt),
  cursosIds: suggestCourses(excerpt.excerpt),
}
```

---

## 🎓 Keywords para Busca no DOU

Reutilizar `shared-keywords.ts`:

```typescript
import { KEYWORDS_RELEVANCIA } from '@/lib/shared-keywords';

const searchTerms = [
  ...KEYWORDS_RELEVANCIA.high,
  ...KEYWORDS_RELEVANCIA.medium
].filter(k => k.length > 5); // Evitar termos muito genéricos

// Buscar no DOU
const results = await searchQueridoDiario(searchTerms, '2024-01-01');
```

---

## 📈 Benefícios da Integração

1. **Completude de Dados**
   - AGU: Pareceres, ONs, Súmulas
   - TCU: Acórdãos
   - **+ DOU:** Editais, portarias, decretos, avisos

2. **Automação Total**
   - Captura diária automática
   - Notificações de novos documentos
   - Versionamento automático

3. **Fonte Oficial**
   - Publicações oficiais do DOU
   - Validade jurídica garantida
   - Rastreabilidade completa

4. **Descoberta de Documentos**
   - Normas que ainda não estão no site da AGU
   - Editais de outros órgãos
   - Atos de órgãos estaduais/municipais (via Querido Diário)

---

## 🚧 Desafios e Soluções

### Desafio 1: Volume Alto de Dados

**Problema:** DOU publica centenas de páginas por dia

**Solução:**
- Filtro rigoroso de relevância (score >= 15)
- Busca apenas em Seção 1 e 3
- Limitar a órgãos específicos (AGU, TCU, CGU, etc.)

### Desafio 2: Falsos Positivos

**Problema:** Palavra "contrato" aparece em contextos irrelevantes

**Solução:**
- Usar keywords de exclusão
- Combinar múltiplas keywords (AND)
- Análise de contexto com IA

### Desafio 3: Duplicatas com AGU Scraper

**Problema:** Mesma ON capturada no site AGU e no DOU

**Solução:**
- Detecção por título + data
- Enriquecer documento AGU existente com dados do DOU
- Não criar duplicata, apenas adicionar link DOU

---

## 🔧 Código de Exemplo

### Busca Básica

```typescript
import { searchQueridoDiario } from '@/lib/querido-diario';
import { analyzeRelevanceDOU } from '@/lib/dou-module';

async function importDailyDOU() {
  const today = new Date().toISOString().split('T')[0];

  const results = await searchQueridoDiario(
    ['licitação', 'pregão', 'contrato', 'Lei 14.133'],
    today
  );

  for (const gazette of results) {
    for (const excerpt of gazette.excerpts) {
      const { isRelevant, score } = analyzeRelevanceDOU(
        excerpt.highlight,
        excerpt.excerpt
      );

      if (isRelevant && score >= 15) {
        await importDOUDocument({
          title: excerpt.highlight,
          content: excerpt.excerpt,
          url: gazette.file_url,
          date: gazette.date,
          edition: gazette.edition_number
        });
      }
    }
  }
}
```

---

## 📝 Conclusão

**Recomendação Final:**

1. **Curto Prazo (1-2 semanas):** Implementar integração direta com API Querido Diário
2. **Médio Prazo (1-2 meses):** Avaliar resultados e decidir sobre Ro-DOU
3. **Longo Prazo (3-6 meses):** Se viável, deploy completo do Ro-DOU em infraestrutura própria

**Próximos Passos:**
1. Criar `lib/querido-diario.ts` com funções de busca
2. Criar `lib/dou-module.ts` com processamento e importação
3. Criar `app/api/cron/import-dou/route.ts` para execução diária
4. Testar com 30 dias de dados históricos
5. Ajustar keywords baseado nos resultados

---

**Última atualização:** 2025-11-02
**Status:** 📋 Proposta - Aguarda implementação
**Prioridade:** 🟡 Média (complementar aos scrapers existentes)
