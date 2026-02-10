# PLANO DE IMPLEMENTAÇÃO: FASES 6-10 - Lei 14.133 Comentada

**Data de Criação:** 2025-11-23
**Última Atualização:** 2026-02-10
**Status:** ✅ CONCLUÍDO (fases essenciais 6-9 + core da 10)
**Prioridade:** Alta → Média → Baixa

---

## Visão Geral

Este documento detalha o plano de implementação completo para finalizar o sistema de busca e chat da Lei 14.133/2021, dividido em 5 fases incrementais.

**Contexto:** FASES 1-4.3 já concluídas (busca unificada + chat API + indexação + UI).

**O que falta:** Interface front-end para chat, feedback, analytics, sugestões contextuais.

---

## Índice de Fases

| Fase | Título | Prioridade | Duração | Status |
|------|--------|------------|---------|--------|
| **FASE 6** | Interface de Chat nos Artigos | 🔴 ALTA | 2-3h | ✅ Concluída |
| **FASE 7** | Feedback e Histórico de Conversas | 🟡 MÉDIA | 2h | ✅ Concluída |
| **FASE 8** | Analytics Dashboard Admin | 🟡 MÉDIA | 3-4h | ✅ Concluída |
| **FASE 9** | Sugestões Contextuais | 🟢 BAIXA | 1-2h | ✅ Concluída |
| **FASE 10** | Melhorias Futuras (Opcional) | 🟢 BAIXA | 8-12h | ⚠️ Parcial (embeddings+PDF ✅, i18n/WhatsApp ❌) |

**Total Estimado:** 8-11h (Fases 6-9) + 8-12h (Fase 10 opcional)

---

## FASE 6: Interface de Chat nos Artigos

**Prioridade:** 🔴 ALTA
**Duração Estimada:** 2-3 horas
**Dependências:** API `/api/artigos/[numero]/chat` (✅ Pronta)

### Objetivo
Criar interface front-end completa para chat por artigo, permitindo que usuários façam perguntas e recebam respostas da IA em tempo real.

### Tarefas

#### 6.1. Criar Componente `ArticleChatInterface.tsx`
**Arquivo:** `components/ArticleChatInterface.tsx`

**Features Necessárias:**
- [ ] Input de texto para pergunta (textarea com resize)
- [ ] Botão "Perguntar à IA" com ícone Sparkles
- [ ] Loading state (spinner + mensagem "Consultando IA...")
- [ ] Exibição de resposta com markdown (usar `react-markdown`)
- [ ] Lista de fontes citadas (documentos relacionados)
- [ ] Estado de erro com mensagem amigável
- [ ] Botão "Nova Pergunta" para limpar
- [ ] Ícone de IA (Sparkles) para destacar resposta

**Props:**
```typescript
interface ArticleChatInterfaceProps {
  articleNumber: string;
  articleTitle?: string;
}
```

**Estados:**
```typescript
const [question, setQuestion] = useState('');
const [answer, setAnswer] = useState<string | null>(null);
const [sources, setSources] = useState<Source[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [conversationId, setConversationId] = useState<string | null>(null);
```

**Layout:**
```
┌─────────────────────────────────────────────┐
│ 💬 Pergunte à IA sobre este artigo          │
├─────────────────────────────────────────────┤
│ [Textarea: Digite sua pergunta...]          │
│ [Botão: ✨ Perguntar à IA]                  │
├─────────────────────────────────────────────┤
│ ⏳ Consultando IA... (se loading)           │
│ ✨ Resposta da IA: (se answer)              │
│ [Texto da resposta com markdown]            │
│                                             │
│ 📚 Fontes consultadas (3):                  │
│ • ON 01/2024 - Pregão Eletrônico           │
│ • Parecer Vinculante 02/2023               │
│ • Acórdão TCU 1234/2022                    │
│                                             │
│ [Botão: 🔄 Nova Pergunta]                   │
└─────────────────────────────────────────────┘
```

**Design Specs:**
- Gradiente roxo-azul para tema "IA"
- Border 2px com shadow-lg
- Ícones Lucide: Sparkles, MessageSquare, FileText, Loader2
- Animação fade-in para resposta
- Links para documentos (se disponíveis)

#### 6.2. Integrar na Página do Artigo
**Arquivo:** `app/artigo/[numero]/page.tsx`

**Localização:** Linha ~205 (dentro de `<div className="lg:col-span-2 space-y-8">`)

**Código a adicionar:**
```tsx
{/* Chat com IA */}
<ArticleChatInterface
  articleNumber={numero}
  articleTitle={article.titulo}
/>
```

**Ordem dos componentes:**
1. **ArticleChatInterface** ← NOVO
2. ArticleRelationshipGraph
3. Posts do Blog Relacionados
4. Preview de Documentos

#### 6.3. Tratamento de Erros
**Cenários a cobrir:**
- [ ] API retorna 401 (não autenticado)
- [ ] API retorna 500 (erro interno)
- [ ] Timeout de requisição (>30s)
- [ ] Pergunta vazia
- [ ] Artigo não encontrado

**Mensagens de Erro:**
```typescript
const errorMessages = {
  '401': 'Você precisa estar logado para usar o chat. Acesse a área restrita.',
  '404': 'Artigo não encontrado.',
  '500': 'Erro ao consultar IA. Tente novamente em alguns instantes.',
  'timeout': 'A consulta está demorando muito. Tente novamente.',
  'empty': 'Por favor, digite uma pergunta.',
};
```

#### 6.4. Testes de Integração
**Testes manuais:**
- [ ] Fazer pergunta sobre Art. 32 (pregão)
- [ ] Verificar resposta com contexto
- [ ] Confirmar fontes aparecem corretamente
- [ ] Testar loading state
- [ ] Testar erro (deslogar e tentar)
- [ ] Verificar responsividade mobile
- [ ] Testar com pergunta longa (>500 caracteres)
- [ ] Testar "Nova Pergunta" limpa estado

**Perguntas de teste:**
```
Art. 32: "O que é pregão eletrônico?"
Art. 75: "Quais são as garantias da contratação?"
Art. 1º: "Qual o objetivo desta lei?"
```

#### 6.5. Performance e UX
**Otimizações:**
- [ ] Debounce no textarea (opcional)
- [ ] Desabilitar botão durante loading
- [ ] Scroll automático para resposta
- [ ] Animação fade-in suave
- [ ] Placeholder com exemplo de pergunta
- [ ] Character counter (opcional, máx 500 chars)

**Acessibilidade:**
- [ ] Aria-label em todos os botões
- [ ] Role="status" para loading
- [ ] Foco no textarea após "Nova Pergunta"
- [ ] Contraste adequado (WCAG AA)

---

## FASE 7: Feedback e Histórico de Conversas

**Prioridade:** 🟡 MÉDIA
**Duração Estimada:** 2 horas
**Dependências:** FASE 6 concluída

### Objetivo
Permitir que usuários avaliem respostas (thumbs up/down) e visualizem histórico de conversas anteriores.

### Tarefas

#### 7.1. Criar Endpoint de Feedback
**Arquivo:** `app/api/artigos/[numero]/chat/[questionId]/feedback/route.ts`

**Método:** PATCH

**Request:**
```typescript
{
  wasHelpful: boolean
}
```

**Response:**
```typescript
{
  success: true,
  questionId: string,
  feedback: {
    wasHelpful: boolean,
    updatedAt: string
  }
}
```

**Lógica:**
```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: { numero: string, questionId: string } }
) {
  const { wasHelpful } = await request.json();

  await prisma.articleQuestion.update({
    where: { id: params.questionId },
    data: { wasHelpful, updatedAt: new Date() }
  });

  return NextResponse.json({ success: true });
}
```

#### 7.2. Adicionar Botões de Feedback no Chat
**Arquivo:** `components/ArticleChatInterface.tsx`

**UI:**
```tsx
{answer && (
  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200">
    <span className="text-sm text-gray-600">Esta resposta foi útil?</span>
    <button
      onClick={() => submitFeedback(true)}
      disabled={feedbackSubmitted}
      className="p-2 rounded-lg hover:bg-green-50 transition-colors"
      title="Resposta útil"
    >
      <ThumbsUp className={`w-5 h-5 ${feedback === true ? 'text-green-600 fill-current' : 'text-gray-400'}`} />
    </button>
    <button
      onClick={() => submitFeedback(false)}
      disabled={feedbackSubmitted}
      className="p-2 rounded-lg hover:bg-red-50 transition-colors"
      title="Resposta não útil"
    >
      <ThumbsDown className={`w-5 h-5 ${feedback === false ? 'text-red-600 fill-current' : 'text-gray-400'}`} />
    </button>
    {feedbackSubmitted && (
      <span className="text-sm text-green-600 font-medium">✓ Obrigado pelo feedback!</span>
    )}
  </div>
)}
```

**Estados:**
```typescript
const [feedback, setFeedback] = useState<boolean | null>(null);
const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
const [questionId, setQuestionId] = useState<string | null>(null);
```

#### 7.3. Implementar Histórico de Conversas
**Componente:** `components/ArticleChatHistory.tsx`

**Props:**
```typescript
interface ArticleChatHistoryProps {
  articleNumber: string;
  conversationId: string;
  onRestoreConversation: (messages: Message[]) => void;
}
```

**Features:**
- [ ] Botão "Ver histórico" (ícone History)
- [ ] Modal/drawer com lista de conversas
- [ ] Agrupamento por data
- [ ] Botão "Restaurar conversa"
- [ ] Botão "Excluir conversa" (opcional)

**Layout do Modal:**
```
┌─────────────────────────────────────────────┐
│ 📜 Histórico de Conversas                   │
│ Artigo 32 - Modalidade Pregão               │
├─────────────────────────────────────────────┤
│ 🕐 Hoje                                      │
│ ───────────────────────────────────────────  │
│ • 14:23 - "O que é pregão eletrônico?"      │
│   [Ver resposta] [Restaurar]                │
│                                             │
│ 🕐 Ontem                                     │
│ ───────────────────────────────────────────  │
│ • 10:15 - "Quais são os requisitos?"        │
│   [Ver resposta] [Restaurar]                │
│                                             │
│ [Botão: Fechar]                             │
└─────────────────────────────────────────────┘
```

#### 7.4. Persistir conversationId no localStorage
**Arquivo:** `components/ArticleChatInterface.tsx`

**Lógica:**
```typescript
useEffect(() => {
  // Carregar conversationId do localStorage
  const savedConvId = localStorage.getItem(`chat_art_${articleNumber}`);
  if (savedConvId) {
    setConversationId(savedConvId);
  }
}, [articleNumber]);

const submitQuestion = async () => {
  const response = await fetch(`/api/artigos/${articleNumber}/chat`, {
    method: 'POST',
    body: JSON.stringify({
      question,
      conversationId: conversationId || undefined
    })
  });

  const data = await response.json();

  // Salvar conversationId
  localStorage.setItem(`chat_art_${articleNumber}`, data.conversationId);
  setConversationId(data.conversationId);
};
```

#### 7.5. Testes de Feedback e Histórico
**Testes manuais:**
- [ ] Enviar feedback positivo → Verificar no banco
- [ ] Enviar feedback negativo → Verificar no banco
- [ ] Fazer 3 perguntas → Verificar histórico
- [ ] Restaurar conversa antiga
- [ ] Verificar persistência após reload
- [ ] Testar com conversationId inválido

---

## FASE 8: Analytics Dashboard Admin

**Prioridade:** 🟡 MÉDIA
**Duração Estimada:** 3-4 horas
**Dependências:** FASE 6-7 concluídas

### Objetivo
Criar dashboard administrativo para monitorar uso do chat, identificar artigos populares, perguntas frequentes e performance da IA.

### Tarefas

#### 8.1. Criar Página de Analytics
**Arquivo:** `app/admin/lei-14133/analytics/page.tsx`

**Seções:**
1. **Visão Geral** (Cards com métricas)
2. **Top Artigos** (Tabela com ranking)
3. **Perguntas Frequentes** (Lista agrupada)
4. **Performance da IA** (Gráficos de latência/cache)
5. **Feedback** (Taxa de satisfação)

#### 8.2. Criar API de Analytics
**Arquivo:** `app/api/admin/lei-14133/analytics/route.ts`

**Endpoint:** GET `/api/admin/lei-14133/analytics?period=30d`

**Response:**
```typescript
{
  overview: {
    totalQuestions: number,
    uniqueArticles: number,
    avgLatency: number,
    cacheHitRate: number,
    positiveRate: number
  },
  topArticles: Array<{
    articleNumber: string,
    articleTitle: string,
    questionCount: number,
    avgLatency: number,
    cacheHits: number,
    positiveRate: number
  }>,
  frequentQuestions: Array<{
    question: string,
    count: number,
    articles: string[]
  }>,
  performance: {
    avgCachedLatency: number,
    avgUncachedLatency: number,
    cacheHitRate: number,
    totalTokens: number,
    estimatedCost: number
  },
  feedback: {
    positive: number,
    negative: number,
    neutral: number,
    rate: number
  }
}
```

**Queries SQL:**
```sql
-- Top 10 Artigos Mais Consultados
SELECT
  articleNumber,
  COUNT(*) as question_count,
  AVG(geminiLatency) as avg_latency,
  SUM(CASE WHEN geminiCached THEN 1 ELSE 0 END) as cache_hits,
  SUM(CASE WHEN wasHelpful = true THEN 1 ELSE 0 END)::float /
    NULLIF(COUNT(wasHelpful), 0) as positive_rate
FROM "ArticleQuestion"
WHERE createdAt > NOW() - INTERVAL '30 days'
GROUP BY articleNumber
ORDER BY question_count DESC
LIMIT 10;

-- Cache Hit Rate
SELECT
  ROUND(100.0 * SUM(CASE WHEN geminiCached THEN 1 ELSE 0 END) / COUNT(*), 2) as cache_hit_rate,
  AVG(CASE WHEN geminiCached THEN geminiLatency END) as avg_cached_latency,
  AVG(CASE WHEN NOT geminiCached THEN geminiLatency END) as avg_uncached_latency
FROM "ArticleQuestion"
WHERE respondedAt > NOW() - INTERVAL '30 days';

-- Perguntas Frequentes
SELECT
  question,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT articleNumber) as articles
FROM "ArticleQuestion"
WHERE createdAt > NOW() - INTERVAL '30 days'
GROUP BY question
HAVING COUNT(*) > 1
ORDER BY count DESC
LIMIT 20;
```

#### 8.3. UI do Dashboard
**Layout:**
```
┌─────────────────────────────────────────────┐
│ 📊 Analytics: Lei 14.133 Chat               │
│ [Filtro: Últimos 30 dias ▼]                │
├─────────────────────────────────────────────┤
│ VISÃO GERAL                                 │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│ │ 1,234│ │  85  │ │ 98ms │ │ 92% │        │
│ │Pergs │ │ Arts │ │Latên │ │Cache│        │
│ └──────┘ └──────┘ └──────┘ └──────┘        │
├─────────────────────────────────────────────┤
│ TOP 10 ARTIGOS                              │
│ ┌─────┬──────────┬──────┬────────┬────┐    │
│ │ Nº  │ Título   │Pergs │Latência│ 👍 │    │
│ ├─────┼──────────┼──────┼────────┼────┤    │
│ │ 32  │ Pregão   │ 147  │  95ms  │87% │    │
│ │ 75  │ Garantia │  89  │ 102ms  │92% │    │
│ │ 1   │ Objetivo │  67  │  88ms  │95% │    │
│ └─────┴──────────┴──────┴────────┴────┘    │
├─────────────────────────────────────────────┤
│ PERGUNTAS FREQUENTES                        │
│ 1. "O que é pregão eletrônico?" (23x)      │
│    Artigos: 32, 33, 34                     │
│ 2. "Quais são os requisitos?" (18x)        │
│    Artigos: 14, 15, 75                     │
├─────────────────────────────────────────────┤
│ PERFORMANCE DA IA                           │
│ [Gráfico de barras: Latência cached vs un] │
│ [Gráfico de linha: Cache hit rate over ti] │
└─────────────────────────────────────────────┘
```

#### 8.4. Componentes de Visualização
**Bibliotecas sugeridas:**
- `recharts` ou `chart.js` para gráficos
- `@tanstack/react-table` para tabelas interativas

**Componentes a criar:**
- [ ] `OverviewCards.tsx` - Cards de métricas
- [ ] `TopArticlesTable.tsx` - Tabela ranking
- [ ] `FrequentQuestionsPanel.tsx` - Lista de perguntas
- [ ] `PerformanceCharts.tsx` - Gráficos de performance
- [ ] `FeedbackStats.tsx` - Estatísticas de feedback

#### 8.5. Exportar Relatórios
**Features:**
- [ ] Botão "Exportar CSV" para top artigos
- [ ] Botão "Exportar PDF" para relatório completo
- [ ] Filtro por período (7d, 30d, 90d, custom)
- [ ] Filtro por artigo específico

---

## FASE 9: Sugestões Contextuais

**Prioridade:** 🟢 BAIXA
**Duração Estimada:** 1-2 horas
**Dependências:** FASE 6 concluída

### Objetivo
Adicionar sugestões de perguntas contextuais baseadas no artigo, facilitando o uso do chat para usuários.

### Tarefas

#### 9.1. Criar Base de Sugestões
**Arquivo:** `data/lei-14133-suggested-questions.ts`

**Estrutura:**
```typescript
export const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  '1': [
    'Qual o objetivo da Lei 14.133?',
    'Quais princípios regem as licitações?',
    'O que mudou em relação à Lei 8.666?'
  ],
  '32': [
    'O que é pregão eletrônico?',
    'Quais são as fases do pregão?',
    'Quando usar pregão presencial vs eletrônico?',
    'Quais são as vantagens do pregão?'
  ],
  '75': [
    'Quais são as garantias da contratação?',
    'Como calcular o valor da garantia?',
    'Quando a garantia é obrigatória?',
    'Como executar a garantia?'
  ],
  // ... mais artigos
};

// Sugestões genéricas (fallback)
export const DEFAULT_SUGGESTIONS = [
  'Resuma este artigo',
  'Quais são os principais pontos?',
  'Dê exemplos práticos',
  'Quais documentos comentam este artigo?'
];
```

#### 9.2. Adicionar Sugestões ao Chat
**Arquivo:** `components/ArticleChatInterface.tsx`

**UI:**
```tsx
{!answer && (
  <div className="space-y-3">
    <p className="text-sm text-gray-600 font-medium">
      💡 Perguntas sugeridas:
    </p>
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => setQuestion(suggestion)}
          className="px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm hover:bg-purple-100 transition-colors border border-purple-200"
        >
          {suggestion}
        </button>
      ))}
    </div>
  </div>
)}
```

**Lógica:**
```typescript
import { SUGGESTED_QUESTIONS, DEFAULT_SUGGESTIONS } from '@/data/lei-14133-suggested-questions';

const suggestions = SUGGESTED_QUESTIONS[articleNumber] || DEFAULT_SUGGESTIONS;
```

#### 9.3. Sugestões Baseadas em Histórico (Opcional)
**Endpoint:** GET `/api/artigos/[numero]/suggested-questions`

**Lógica:**
- Buscar as 5 perguntas mais frequentes para este artigo
- Misturar com sugestões pré-definidas
- Retornar lista única

**Query:**
```sql
SELECT question, COUNT(*) as count
FROM "ArticleQuestion"
WHERE articleNumber = $1
  AND createdAt > NOW() - INTERVAL '90 days'
  AND wasHelpful = true
GROUP BY question
ORDER BY count DESC
LIMIT 5;
```

#### 9.4. Testes de Sugestões
**Testes manuais:**
- [ ] Verificar sugestões aparecem ao abrir chat
- [ ] Click em sugestão preenche input
- [ ] Sugestões desaparecem após resposta
- [ ] Fallback funciona para artigos sem sugestões
- [ ] Responsividade mobile (wrap correto)

---

## FASE 10: Melhorias Futuras (Opcional)

**Prioridade:** 🟢 BAIXA
**Duração Estimada:** 8-12 horas
**Dependências:** Todas fases anteriores

### Objetivo
Implementar features avançadas de longo prazo para melhorar qualidade e performance do sistema.

### Tarefas

#### 10.1. Embeddings e Busca Vetorial
**Duração:** 4-6h

**Ferramentas:**
- Pinecone ou Weaviate (vector database)
- OpenAI Embeddings API ou Cohere
- Reranking com Cohere

**Fluxo:**
1. Gerar embeddings de todos os 195 artigos
2. Gerar embeddings de 265 documentos
3. Armazenar no vector DB
4. Na busca, gerar embedding da query
5. Buscar top 20 por similaridade (cosine)
6. Reranking com Cohere para top 10
7. Retornar resultados ordenados

**Vantagens:**
- Busca semântica real (entende sinônimos, contexto)
- Melhor relevância vs keyword matching
- Reranking melhora precisão

**Desvantagens:**
- Custo adicional (embeddings + vector DB)
- Complexidade de setup
- Latência adicional (~200-500ms)

#### 10.2. Export de Conversas como PDF
**Duração:** 2-3h

**Features:**
- Botão "Exportar conversa" no histórico
- PDF com logo, data, artigo, perguntas/respostas
- Marca d'água com nome do usuário
- Incluir fontes citadas

**Bibliotecas:**
- `jsPDF` ou `pdfmake`
- `html2canvas` para screenshots (opcional)

#### 10.3. Notificações de Novas Perguntas (Admin)
**Duração:** 1-2h

**Features:**
- Email diário para admin com resumo
- Badge "X novas perguntas" no menu admin
- Destaque para perguntas com feedback negativo

#### 10.4. Multi-idioma (Inglês)
**Duração:** 2-3h

**Features:**
- Traduzir interface do chat
- Suporte a perguntas em inglês
- Resposta em inglês (via Gemini)
- Toggle PT/EN

**Desafio:**
- Lei 14.133 está em português
- Fontes (ONs, Pareceres) em português
- Qualidade da tradução da IA

#### 10.5. Integração com WhatsApp (Futuro)
**Duração:** 4-6h

**Features:**
- Chatbot WhatsApp para consultas rápidas
- Integração via Twilio ou Meta API
- Limitação de perguntas por dia (rate limit)
- Link para área restrita para análise completa

---

## Checklist de Monitoramento

### FASE 6: Interface de Chat ⏳
- [ ] 6.1. Criar `ArticleChatInterface.tsx`
  - [ ] Input de texto (textarea)
  - [ ] Botão "Perguntar à IA"
  - [ ] Loading state
  - [ ] Exibição de resposta (markdown)
  - [ ] Lista de fontes citadas
  - [ ] Tratamento de erros
  - [ ] Botão "Nova Pergunta"
- [ ] 6.2. Integrar na página `/artigo/[numero]`
  - [ ] Adicionar import
  - [ ] Adicionar componente (linha 205)
  - [ ] Passar props corretas
- [ ] 6.3. Tratamento de Erros
  - [ ] Erro 401 (não autenticado)
  - [ ] Erro 500 (interno)
  - [ ] Timeout (>30s)
  - [ ] Pergunta vazia
- [ ] 6.4. Testes de Integração
  - [ ] Pergunta sobre Art. 32
  - [ ] Pergunta sobre Art. 75
  - [ ] Pergunta sobre Art. 1
  - [ ] Testar loading state
  - [ ] Testar erro (sem auth)
  - [ ] Mobile responsivo
- [ ] 6.5. Performance e UX
  - [ ] Desabilitar botão durante loading
  - [ ] Scroll para resposta
  - [ ] Animação fade-in
  - [ ] Placeholder com exemplo
  - [ ] Acessibilidade (WCAG AA)

### FASE 7: Feedback e Histórico ⏳
- [ ] 7.1. Endpoint de Feedback
  - [ ] Criar `[questionId]/feedback/route.ts`
  - [ ] Método PATCH
  - [ ] Validação de questionId
  - [ ] Update no banco
- [ ] 7.2. Botões de Feedback
  - [ ] Thumbs Up icon
  - [ ] Thumbs Down icon
  - [ ] Estado "submitted"
  - [ ] Mensagem de confirmação
- [ ] 7.3. Histórico de Conversas
  - [ ] Criar `ArticleChatHistory.tsx`
  - [ ] Modal com lista
  - [ ] Agrupamento por data
  - [ ] Botão "Restaurar"
- [ ] 7.4. Persistir conversationId
  - [ ] localStorage get/set
  - [ ] Carregar ao montar
  - [ ] Salvar após pergunta
- [ ] 7.5. Testes
  - [ ] Feedback positivo → DB
  - [ ] Feedback negativo → DB
  - [ ] Histórico com 3 perguntas
  - [ ] Restaurar conversa antiga

### FASE 8: Analytics Dashboard ⏳
- [ ] 8.1. Página de Analytics
  - [ ] Criar `app/admin/lei-14133/analytics/page.tsx`
  - [ ] Layout com 5 seções
  - [ ] Filtro de período
- [ ] 8.2. API de Analytics
  - [ ] Criar `/api/admin/lei-14133/analytics/route.ts`
  - [ ] Query: Top Artigos
  - [ ] Query: Cache Hit Rate
  - [ ] Query: Perguntas Frequentes
  - [ ] Query: Feedback Stats
- [ ] 8.3. UI do Dashboard
  - [ ] Cards de métricas
  - [ ] Tabela de top artigos
  - [ ] Lista de perguntas frequentes
  - [ ] Gráficos de performance
- [ ] 8.4. Componentes
  - [ ] `OverviewCards.tsx`
  - [ ] `TopArticlesTable.tsx`
  - [ ] `FrequentQuestionsPanel.tsx`
  - [ ] `PerformanceCharts.tsx`
- [ ] 8.5. Exportar Relatórios
  - [ ] Botão "Exportar CSV"
  - [ ] Botão "Exportar PDF"
  - [ ] Filtros funcionais

### FASE 9: Sugestões Contextuais ⏳
- [ ] 9.1. Base de Sugestões
  - [ ] Criar `data/lei-14133-suggested-questions.ts`
  - [ ] Adicionar sugestões para top 20 artigos
  - [ ] Fallback genérico
- [ ] 9.2. UI de Sugestões
  - [ ] Botões de sugestão
  - [ ] Click preenche input
  - [ ] Ocultar após resposta
- [ ] 9.3. Sugestões Baseadas em Histórico (Opcional)
  - [ ] Endpoint `/suggested-questions`
  - [ ] Query de perguntas frequentes
  - [ ] Merge com pré-definidas
- [ ] 9.4. Testes
  - [ ] Sugestões aparecem
  - [ ] Click funciona
  - [ ] Fallback para artigos sem sugestões
  - [ ] Responsividade mobile

### FASE 10: Melhorias Futuras (Opcional) ⏳
- [ ] 10.1. Embeddings e Busca Vetorial
  - [ ] Escolher vector DB (Pinecone/Weaviate)
  - [ ] Gerar embeddings (artigos + docs)
  - [ ] Implementar busca por similaridade
  - [ ] Reranking com Cohere
- [ ] 10.2. Export de Conversas PDF
  - [ ] Implementar geração de PDF
  - [ ] Marca d'água com usuário
  - [ ] Incluir fontes
- [ ] 10.3. Notificações Admin
  - [ ] Email diário com resumo
  - [ ] Badge "X novas perguntas"
- [ ] 10.4. Multi-idioma
  - [ ] Toggle PT/EN
  - [ ] Traduzir interface
  - [ ] Suporte perguntas em inglês
- [ ] 10.5. Integração WhatsApp
  - [ ] Chatbot via Twilio/Meta
  - [ ] Rate limit
  - [ ] Link para área restrita

---

## Critérios de Aceitação

### FASE 6 (Mínimo Viável)
✅ **Interface de chat funcional**
- [ ] Usuário consegue fazer pergunta
- [ ] Resposta da IA é exibida em <10s
- [ ] Fontes citadas aparecem corretamente
- [ ] Erros são tratados com mensagens amigáveis
- [ ] Mobile responsivo

### FASE 7 (Recomendado)
✅ **Feedback e histórico funcionais**
- [ ] Thumbs up/down salvam no banco
- [ ] Histórico lista conversas anteriores
- [ ] conversationId persiste entre sessões

### FASE 8 (Recomendado)
✅ **Analytics acessível ao admin**
- [ ] Dashboard exibe métricas em tempo real
- [ ] Top 10 artigos atualizado
- [ ] Cache hit rate visível
- [ ] Exportar CSV funciona

### FASE 9 (Nice to Have)
✅ **Sugestões melhoram UX**
- [ ] Sugestões contextuais aparecem
- [ ] Usuários clicam em sugestões (>30% das vezes)

### FASE 10 (Futuro)
✅ **Melhorias avançadas implementadas**
- [ ] Busca vetorial aumenta relevância em +20%
- [ ] Export PDF funciona corretamente

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Latência alta (>5s)** | Média | Alto | Cache Redis já implementado, monitorar hit rate |
| **Custo Gemini excede orçamento** | Baixa | Médio | Rate limit por usuário, monitorar custos diariamente |
| **Usuários não usam chat** | Média | Médio | Destacar com banner, sugestões contextuais, onboarding |
| **Respostas imprecisas** | Baixa | Alto | Feedback permite ajustar prompts, citar fontes sempre |
| **Mobile quebra layout** | Baixa | Médio | Testes responsivos, CSS mobile-first |
| **API sobrecarregada** | Baixa | Alto | Rate limit, queue system (opcional) |

---

## Cronograma Sugerido

### Semana 1 (8h)
- **Dia 1-2:** FASE 6 (Interface de Chat) - 2-3h
- **Dia 3:** FASE 7 (Feedback) - 2h
- **Dia 4-5:** FASE 8 (Analytics) - 3-4h

**Entregável:** Sistema de chat completo e funcional

### Semana 2 (3h)
- **Dia 1:** FASE 9 (Sugestões) - 1-2h
- **Dia 2:** Testes finais e ajustes - 1h

**Entregável:** Sistema polido com UX otimizada

### Futuro (8-12h)
- **FASE 10:** Implementar sob demanda conforme necessidade

---

## Métricas de Sucesso

### KPIs Primários
1. **Taxa de Uso:** >30% dos usuários logados fazem pelo menos 1 pergunta
2. **Satisfação:** >80% de feedback positivo (thumbs up)
3. **Performance:** <2s de latência média (considerando cache)
4. **Cache Hit Rate:** >50% em 30 dias

### KPIs Secundários
1. **Perguntas/Usuário:** Média de 3-5 perguntas por sessão
2. **Artigos Cobertos:** Perguntas sobre pelo menos 50 artigos diferentes
3. **Retorno:** >40% dos usuários fazem pergunta em múltiplas sessões

---

## Documentação Final

Após conclusão de todas as fases, atualizar:
- [ ] `CLAUDE.md` - Adicionar seção sobre chat
- [ ] `FASES_4.1-4.3_LEI_COMENTADA_SEARCH.md` - Adicionar referência às Fases 6-9
- [ ] Criar `CHAT_INTERFACE_GUIDE.md` - Guia de uso para usuários
- [ ] Criar `CHAT_ADMIN_GUIDE.md` - Guia de analytics para admin

---

## Conclusão

Este plano cobre todas as melhorias pendentes para finalizar o sistema de busca e chat da Lei 14.133/2021, desde a interface básica (FASE 6 - alta prioridade) até features avançadas (FASE 10 - opcional).

**Próximo Passo:** Começar implementação da **FASE 6: Interface de Chat**.

**Estimativa Total:** 8-11h (essencial) + 8-12h (opcional)

---

**Documento criado por:** Claude Code (Anthropic)
**Última atualização:** 2025-11-23
