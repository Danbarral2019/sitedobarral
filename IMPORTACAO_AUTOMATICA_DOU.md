# Importação Automática Diária do DOU - Documentação Completa

## 📋 Visão Geral

Este documento explica em detalhes como funciona o sistema de importação automática de documentos do Diário Oficial da União (DOU), desde a busca até a disponibilização para os alunos na área restrita.

---

## 🔄 Fluxo Completo da Informação

### Diagrama do Fluxo

```
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 1: AGENDAMENTO AUTOMÁTICO (Vercel Cron)                 │
│  Todos os dias às 10h UTC (7h BR)                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 2: CHAMADA DO ENDPOINT                                   │
│  GET /api/cron/import-dou?days=7&limit=50                      │
│  Header: x-cron-secret: [CRON_SECRET]                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 3: BUSCA NO QUERIDO DIÁRIO API                          │
│  - Busca publicações dos últimos 7 dias                        │
│  - Usa 20 keywords de alta relevância                          │
│  - Filtra por território "BR" (DOU federal)                    │
│  - Máximo: 50 publicações                                      │
│                                                                 │
│  API: https://api.queridodiario.ok.org.br/api/gazettes        │
│  Query: licitação OR pregão OR Lei 14.133 OR ...              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 4: ANÁLISE DE RELEVÂNCIA (PRÉ-FILTRO)                   │
│  Para cada publicação encontrada:                              │
│  - Analisa título e conteúdo                                   │
│  - Calcula score baseado em keywords:                          │
│    * high (+10): licitação, pregão, Lei 14.133, etc.          │
│    * medium (+5): fiscalização, terceirização, etc.            │
│    * low (+2): convênio, parceria, etc.                        │
│    * exclude (-15): criminal, tributário, etc.                 │
│  - Score >= 15 = RELEVANTE                                     │
│  - Score < 15 = DESCARTADO                                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 5: DETECÇÃO DE CATEGORIA                                │
│  Para cada publicação relevante:                               │
│  - Portaria: "portaria", "port."                              │
│  - Decreto: "decreto", "dec."                                  │
│  - Lei: "lei nº", "lei federal"                               │
│  - Instrução Normativa: "instrução normativa", "in nº"        │
│  - Orientação Normativa: "orientação normativa", "on nº"      │
│  - Edital: "aviso de licitação", "pregão eletrônico"         │
│  - Parecer: "parecer", "parecer vinculante"                   │
│  - Resolução: "resolução"                                      │
│  - Outros: (fallback)                                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 6: SUGESTÃO DE CURSO                                    │
│  Analisa conteúdo e sugere curso mais adequado:                │
│  - Curso 1: lei 14.133, licitação, pregão                     │
│  - Curso 2: planejamento, estudo técnico preliminar           │
│  - Curso 3: gestão, fiscalização de contratos                 │
│  - Curso 4: processo sancionador, penalidades                 │
│  - ... (até 10 cursos)                                        │
│  - Padrão: Curso 1 se nenhum match                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 7: EXTRAÇÃO DE DADOS DOU                                │
│  Extrai metadados oficiais:                                    │
│  - douUrl: URL completa da publicação                         │
│  - douData: Data de publicação (convertida para Date)         │
│  - douSecao: Seção do DOU (1, 2, 3)                          │
│  - douPagina: Número da página                                │
│  - douEdicao: Número da edição                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 8: SISTEMA DE VERSIONAMENTO                             │
│  Busca no banco por título único:                              │
│                                                                 │
│  A) DOCUMENTO NÃO EXISTE:                                      │
│     - Cria novo documento                                      │
│     - Cria versão 1                                           │
│     - Status: "NOVO"                                           │
│                                                                 │
│  B) DOCUMENTO JÁ EXISTE (mesmo título):                        │
│     - Compara campos importantes:                              │
│       * description, url, category, tags                       │
│       * douUrl, douSecao, douPagina                           │
│     - Se MUDOU:                                                │
│       * Atualiza documento                                     │
│       * Cria nova versão                                       │
│       * Status: "ATUALIZADO"                                   │
│     - Se IGUAL:                                                │
│       * Não faz nada                                           │
│       * Status: "SEM_MUDANÇAS"                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 9: SALVAMENTO NO BANCO DE DADOS                         │
│  Tabela: Document                                               │
│  Campos principais:                                             │
│  - title: "Portaria nº XXX - DOU Edição 210"                  │
│  - description: Conteúdo/sumário da publicação                 │
│  - url: Link do PDF no DOU                                     │
│  - category: portaria/decreto/lei/edital/etc                   │
│  - type: 'link' (sempre link externo)                         │
│  - tags: JSON array ["DOU", "210", "Executivo", temas...]    │
│  - courseId: ID do curso sugerido (ex: "1", "3")              │
│  - isPublic: true (sempre público)                            │
│  - douUrl, douData, douSecao, douPagina, douEdicao           │
│                                                                 │
│  Tabela: DocumentVersion                                        │
│  - documentId: ID do documento pai                             │
│  - versionNumber: Número sequencial (1, 2, 3...)              │
│  - changeType: 'created' | 'content' | 'metadata' | 'url'     │
│  - previousData: JSON com dados antigos                        │
│  - changedFields: Array de campos que mudaram                  │
│  - changesSummary: Resumo em texto                             │
│  - detectedBy: 'scraper-dou'                                   │
│  - detectedAt: Timestamp da detecção                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASSO 10: RETORNO DE ESTATÍSTICAS                             │
│  Resposta JSON:                                                 │
│  {                                                              │
│    success: true,                                               │
│    message: "Importação concluída: 5 novos, 2 atualizados",   │
│    stats: {                                                     │
│      buscados: 50,        // Total de publicações da API       │
│      relevantes: 12,      // Filtradas (score >= 15)           │
│      novos: 5,            // Documentos criados                │
│      atualizados: 2,      // Documentos modificados            │
│      semMudancas: 5,      // Duplicatas sem mudança            │
│      erros: 0             // Falhas na importação              │
│    }                                                            │
│  }                                                              │
│                                                                 │
│  Logs salvos no Vercel Dashboard para monitoramento            │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Configuração do Sistema

### 1. Vercel Cron (vercel.json)

**Arquivo:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/import-dou",
      "schedule": "0 10 * * *"
    }
  ]
}
```

**Significado do Schedule:**
- `0 10 * * *` = Todo dia às 10h UTC (7h horário de Brasília)
- Formato: `minuto hora dia-do-mês mês dia-da-semana`

**⚠️ IMPORTANTE:** Ainda NÃO está configurado no vercel.json atual! Precisa ser adicionado.

---

### 2. Variáveis de Ambiente

**Arquivo:** `.env.production` (Vercel)

```bash
# Segurança do Cron Job
CRON_SECRET=seu-secret-aleatorio-aqui

# Database (já configurado)
DATABASE_URL=postgresql://...
```

**Como gerar CRON_SECRET:**
```bash
openssl rand -base64 32
```

---

### 3. Endpoint da API

**Arquivo:** `app/api/cron/import-dou/route.ts`

**Características:**
- Método: `GET`
- Runtime: Node.js
- Timeout: 300 segundos (5 minutos)
- Segurança: Header `x-cron-secret` obrigatório
- Parâmetros opcionais:
  - `days`: Número de dias para buscar (padrão: 7)
  - `limit`: Máximo de publicações (padrão: 50)

---

## 📊 Disponibilização para os Alunos

### Como os Documentos Aparecem na Área Restrita

#### 1. **Agrupamento por Categoria**

Os documentos importados do DOU aparecem agrupados por categoria no componente `DocumentsByCategory`:

```typescript
// Categorias detectadas do DOU:
const categoryConfig = {
  'portaria': { icon: '📝', color: 'green', label: 'Portarias' },
  'decreto': { icon: '📜', color: 'blue', label: 'Decretos' },
  'lei': { icon: '⚖️', color: 'indigo', label: 'Leis' },
  'instrucao-normativa': { icon: '📋', color: 'purple', label: 'Instruções Normativas' },
  'orientacao-normativa': { icon: '📋', color: 'indigo', label: 'Orientações Normativas' },
  'edital': { icon: '📰', color: 'orange', label: 'Editais' },
  'parecer': { icon: '📝', color: 'green', label: 'Pareceres' },
  'resolucao': { icon: '📜', color: 'cyan', label: 'Resoluções' },
  'outros': { icon: '📄', color: 'gray', label: 'Outros' }
};
```

**Exemplo visual:**
```
📚 Materiais por Categoria

📰 Editais (3)
  ▼ Mostrar documentos
    • Edital de Pregão Eletrônico nº 10/2024 - DOU Edição 210
      📅 02/11/2024  |  📖 Seção 3, pág. 45
      🔗 Link do DOU

📝 Portarias (5)
  ▼ Mostrar documentos
    • Portaria nº 123/2024 sobre Licitações - DOU Edição 208
      📅 30/10/2024  |  📖 Seção 1, pág. 12
      🔗 Link do DOU
```

---

#### 2. **Filtro por Curso**

Os documentos são automaticamente associados a um curso baseado no conteúdo:

**Sidebar de Cursos:**
```
Curso 1: Nova Lei de Licitações
  📄 45 documentos

Curso 3: Gestão e Fiscalização
  📄 12 documentos
```

O aluno vê **apenas os documentos do curso selecionado**.

---

#### 3. **Sistema de Busca**

Todos os documentos DOU são indexados e aparecem na busca:

```typescript
// Campos pesquisáveis:
- title: "Portaria nº 123/2024 sobre Licitações"
- description: Conteúdo completo da publicação
- tags: ["DOU", "210", "Executivo", "Licitação", "Pregão"]
```

**Exemplo de busca:**
- Aluno busca: "pregão eletrônico 2024"
- Resultados incluem:
  - Editais do DOU com "pregão eletrônico"
  - Portarias sobre pregão
  - ONs da AGU sobre pregão

---

#### 4. **Informações Detalhadas**

Ao clicar em um documento DOU, o aluno vê:

```
┌─────────────────────────────────────────────────┐
│  EDITAL DE PREGÃO ELETRÔNICO Nº 10/2024        │
│                                                 │
│  📰 Categoria: Edital                          │
│  📅 Publicado em: 02/11/2024                   │
│  📖 DOU: Seção 3, Página 45, Edição 210       │
│  🏷️ Tags: DOU, Edital, Pregão Eletrônico      │
│  📚 Curso: Nova Lei de Licitações              │
│                                                 │
│  📝 Descrição:                                 │
│  AVISO DE LICITAÇÃO PREGÃO ELETRÔNICO Nº       │
│  10/2024. Objeto: Aquisição de materiais...   │
│                                                 │
│  🔗 [Acessar Publicação Oficial no DOU]       │
│                                                 │
│  ❤️ Adicionar aos Favoritos                   │
└─────────────────────────────────────────────────┘
```

---

## ✅ Adequação do Site - Checklist

Vou verificar se o site está pronto para a nova funcionalidade:

### 1. ✅ **Schema do Banco de Dados**

**Status:** ✅ COMPLETO

- [x] Campos DOU no modelo Document
- [x] Índices para consulta eficiente
- [x] Sistema de versionamento
- [x] Campo `category` suporta novas categorias

```prisma
model Document {
  // Campos DOU
  douUrl              String?
  douData             DateTime?
  douSecao            String?
  douPagina           String?
  douEdicao           String?

  // Índices
  @@index([douData])
  @@index([douSecao])
  @@index([category, douData])
}
```

---

### 2. ❓ **Componentes de UI**

**Status:** ⚠️ PARCIALMENTE ADEQUADO

#### ✅ Funciona automaticamente:
- `DocumentsByCategory` - Agrupa por categoria
- `SearchBar` - Busca por título/descrição/tags
- `SearchFilters` - Filtro por categoria e tipo
- Modal de detalhes

#### ⚠️ Precisa de Ajuste:

**a) Mapeamento de Categorias no `DocumentsByCategory.tsx`:**

Atualmente tem:
```typescript
const categoryConfig = {
  'acordao': { icon: '⚖️', color: 'blue', label: 'Acórdãos' },
  'parecer': { icon: '📝', color: 'green', label: 'Pareceres' },
  'orientacao-normativa': { icon: '📋', color: 'indigo', label: 'ONs' },
  // ... etc
};
```

**FALTA adicionar:**
```typescript
'portaria': { icon: '📜', color: 'emerald', label: 'Portarias' },
'decreto': { icon: '📋', color: 'blue', label: 'Decretos' },
'lei': { icon: '⚖️', color: 'purple', label: 'Leis' },
'instrucao-normativa': { icon: '📄', color: 'indigo', label: 'Instruções Normativas' },
'resolucao': { icon: '📜', color: 'cyan', label: 'Resoluções' },
```

**b) Exibição de Dados DOU:**

O modal de detalhes pode mostrar informações DOU adicionais:
- Seção do DOU
- Página
- Edição
- Link oficial

---

### 3. ⚠️ **Vercel Cron Configuration**

**Status:** ❌ NÃO CONFIGURADO

**Arquivo atual (`vercel.json`):**
```json
{
  "crons": [
    {
      "path": "/api/enrollment/check-expiration",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/notify-new-documents",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/import-documents",
      "schedule": "0 2 * * 2"
    },
    {
      "path": "/api/cron/monthly-newsletter",
      "schedule": "0 9 1 * *"
    }
  ]
}
```

**FALTA ADICIONAR:**
```json
{
  "path": "/api/cron/import-dou",
  "schedule": "0 10 * * *"
}
```

---

### 4. ✅ **Endpoint da API**

**Status:** ✅ COMPLETO

- [x] Rota criada: `/api/cron/import-dou/route.ts`
- [x] Validação de segurança (CRON_SECRET)
- [x] Timeout adequado (300s)
- [x] Tratamento de erros
- [x] Logs detalhados

---

### 5. ⚠️ **Variáveis de Ambiente**

**Status:** ⏳ PENDENTE DE CONFIGURAÇÃO NO VERCEL

**Precisa adicionar no Vercel Dashboard:**
```
CRON_SECRET=<gerar-com-openssl-rand>
```

---

### 6. ✅ **Sistema de Notificações** (Opcional)

**Sugestão:** Enviar email aos alunos quando novos documentos DOU forem importados.

**Endpoint já existente:** `/api/cron/notify-new-documents`

**Pode ser adaptado para incluir documentos DOU:**

```typescript
// No notify-new-documents
const douDocuments = await prisma.document.findMany({
  where: {
    uploadedAt: { gte: since },
    versions: {
      some: { detectedBy: 'scraper-dou' }
    }
  }
});
```

---

## 🔧 Ajustes Necessários

### CRÍTICO (Obrigatório para funcionar)

1. **Adicionar cron job ao vercel.json**
2. **Configurar CRON_SECRET no Vercel**

### IMPORTANTE (Para melhor experiência)

3. **Adicionar categorias DOU ao DocumentsByCategory.tsx**
4. **Melhorar modal de detalhes para mostrar dados DOU**

### OPCIONAL (Melhorias futuras)

5. **Notificação de novos documentos DOU**
6. **Dashboard admin para monitorar importações**
7. **Filtro específico para "Documentos do DOU"**

---

## 📈 Monitoramento

### Logs no Vercel

Após configurar, os logs aparecerão em:
```
Vercel Dashboard > Functions > /api/cron/import-dou
```

**Exemplo de log bem-sucedido:**
```
[Cron DOU] 🚀 Iniciando importação diária do DOU...
[Cron DOU] Buscando publicações dos últimos 7 dias (limite: 50)
[Querido Diário] Buscando: licitação OR pregão OR Lei 14.133 OR ...
[Querido Diário] ✅ 45 publicações encontradas
[Cron DOU] 📊 12 publicações relevantes (27%)
[DOU Module] Iniciando importação de 12 publicações...
[DOU Module] ✅ Importação concluída!
  ✅ Novos: 5
  🔄 Atualizados: 2
  ⏭️ Sem mudanças: 5
  ❌ Erros: 0
```

---

## 🚀 Colocando em Produção

### Passo a Passo

1. **Gerar CRON_SECRET**
```bash
openssl rand -base64 32
```

2. **Adicionar ao Vercel**
   - Ir em: Settings > Environment Variables
   - Adicionar: `CRON_SECRET` = valor gerado

3. **Atualizar vercel.json**
   - Adicionar configuração do cron DOU
   - Fazer commit e push

4. **Deploy no Vercel**
   - Push para `main` faz deploy automático
   - Vercel detecta novo cron job

5. **Testar Manualmente**
```bash
curl -X GET https://site-prof-barral.vercel.app/api/cron/import-dou?days=1&limit=10 \
  -H "x-cron-secret: SEU_CRON_SECRET"
```

6. **Aguardar Primeira Execução Automática**
   - Próximo dia às 10h UTC (7h BR)
   - Verificar logs no Vercel Dashboard

---

## ❓ FAQs

### 1. Por que usar Querido Diário e não scraping direto do DOU?

**Resposta:**
- Querido Diário é mantido pela Open Knowledge Brasil
- API estável e gratuita
- Já indexa todo o DOU automaticamente
- Economiza processamento (não precisamos fazer scraping)
- Suporta busca por keywords

---

### 2. O que acontece se a API do Querido Diário ficar fora do ar?

**Resposta:**
- O cron job retorna erro
- Log registrado no Vercel
- Tentará novamente no próximo dia
- Documentos não são perdidos (versionamento evita duplicatas)

---

### 3. Como evitar duplicatas se rodar o cron manualmente?

**Resposta:**
- Sistema de versionamento detecta documentos existentes
- Compara por título único
- Se igual: retorna "sem mudanças"
- Se mudou: cria nova versão
- Nunca duplica

---

### 4. Posso mudar o horário de execução?

**Resposta:** Sim, basta alterar o `schedule` no vercel.json:
```json
"schedule": "0 14 * * *"  // 14h UTC = 11h BR
```

---

### 5. Como desativar temporariamente?

**Resposta:**
- Remover do `vercel.json`
- Fazer deploy
- Ou: retornar erro 503 no início do endpoint

---

## 📝 Conclusão

### Sistema Está Pronto? ✅ QUASE!

**O que funciona:**
- ✅ Endpoint da API completo
- ✅ Integração com Querido Diário
- ✅ Sistema de versionamento
- ✅ Análise de relevância
- ✅ Detecção de categoria
- ✅ Sugestão de curso
- ✅ Salvamento no banco

**O que falta:**
- ❌ Configurar cron no vercel.json (5 minutos)
- ❌ Adicionar CRON_SECRET no Vercel (2 minutos)
- ⚠️ Adicionar categorias DOU ao UI (10 minutos)
- ⚠️ Melhorar modal de detalhes (15 minutos)

**Tempo total para produção:** ~30 minutos de ajustes

---

**Data:** 2025-11-02
**Versão:** 1.0
**Status:** 🟡 Pronto para Produção (após ajustes finais)
