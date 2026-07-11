# Fase 3 - Backend APIs (Infraestrutura Pronta)

Este documento descreve as APIs backend criadas para a Fase 3 do sistema de busca por artigos. A infraestrutura está completa e funcional, aguardando apenas a implementação do frontend quando for o momento adequado (associado à cobrança de inscrições).

## 🎯 Visão Geral

As APIs da Fase 3 fornecem:
1. **Timeline Cronológica** - Documentos organizados por período
2. **IA Assistente** - Chat placeholder (preparado para ativação futura)

**Status Atual:**
- ✅ Backend 100% funcional
- ✅ Banco de dados atualizado
- ✅ Zero custos de IA
- ❌ Frontend não implementado (propositalmente)
- ❌ IA real não ativada (placeholder)

---

## 1. Timeline por Artigo

### Endpoint
```
GET /api/artigos/[numero]/timeline
```

### Descrição
Retorna documentos relacionados a um artigo organizados cronologicamente por período (mês/ano).

### Parâmetros Query String

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `period` | string | Não | Filtro de período: `30d`, `6m`, `1y`, `all` (padrão: `all`) |
| `category` | string | Não | Filtrar por categoria de documento |

### Exemplo de Requisição
```bash
GET /api/artigos/75/timeline?period=6m&category=acordao
```

### Resposta de Sucesso (200)

```json
{
  "articleNumber": "75",
  "timeline": [
    {
      "period": "2024-11",
      "label": "Novembro 2024",
      "documents": [
        {
          "id": "doc-uuid-123",
          "title": "Acórdão TCU 1234/2024",
          "category": "acordao",
          "type": "pdf",
          "uploadedAt": "2024-11-15T10:30:00.000Z"
        }
      ],
      "count": 1
    },
    {
      "period": "2024-10",
      "label": "Outubro 2024",
      "documents": [...],
      "count": 5
    }
  ],
  "stats": {
    "total": 50,
    "oldestDate": "2021-04-01T00:00:00.000Z",
    "newestDate": "2024-11-15T10:30:00.000Z",
    "categories": {
      "acordao": 25,
      "parecer": 15,
      "apostila": 10
    }
  },
  "filters": {
    "period": "6m",
    "category": "acordao"
  }
}
```

### Casos de Uso

1. **Ver documentos recentes**
   ```
   GET /api/artigos/75/timeline?period=30d
   ```

2. **Timeline histórica completa**
   ```
   GET /api/artigos/75/timeline?period=all
   ```

3. **Evolução de jurisprudência**
   ```
   GET /api/artigos/75/timeline?category=acordao&period=1y
   ```

---

## 2. IA Assistente (Placeholder)

### Endpoint POST - Fazer Pergunta
```
POST /api/artigos/[numero]/chat
```

### Descrição
Recebe perguntas sobre um artigo e retorna resposta placeholder. Quando a IA for ativada (plano premium), substituirá a resposta placeholder por resposta real da Claude AI.

### Body da Requisição

```json
{
  "question": "O que é dispensa de licitação?",
  "conversationId": "uuid-opcional-para-continuar-conversa"
}
```

### Resposta de Sucesso (200)

```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "questionId": "question-uuid-123",
  "answer": "Esta funcionalidade estará disponível em breve!\n\nQuando ativada, nosso assistente de IA poderá responder perguntas sobre o Artigo 75 baseado em 5 documentos relacionados.\n\n**Sua pergunta foi registrada:**\n\"O que é dispensa de licitação?\"\n\n**Documentos relacionados encontrados:**\n1. Acórdão TCU 1234/2024 (acordao)\n2. Parecer AGU 15/2024 (parecer)\n...\n\nAguarde a ativação do plano premium para obter respostas personalizadas!",
  "sources": [
    {
      "id": "doc-uuid-1",
      "title": "Acórdão TCU 1234/2024",
      "category": "acordao",
      "excerpt": "Resumo do documento..."
    }
  ],
  "isPlaceholder": true,
  "meta": {
    "articleNumber": "75",
    "relevantDocsCount": 5,
    "message": "IA não ativada. Esta é uma resposta placeholder."
  }
}
```

### Endpoint GET - Obter Histórico
```
GET /api/artigos/[numero]/chat?conversationId=XXX
```

### Descrição
Retorna histórico de perguntas de uma conversa.

### Resposta de Sucesso (200)

```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "articleNumber": "75",
  "messages": [
    {
      "id": "msg-1",
      "question": "O que é dispensa de licitação?",
      "answer": "Resposta placeholder...",
      "isPlaceholder": true,
      "timestamp": "2024-11-02T10:00:00.000Z",
      "feedback": null
    }
  ],
  "count": 1
}
```

---

## 3. Banco de Dados

### Modelo ArticleQuestion

Criado no Prisma Schema para armazenar histórico de perguntas e respostas.

```prisma
model ArticleQuestion {
  id              String   @id @default(uuid())
  articleNumber   String   // Número do artigo (ex: "75")

  // Pergunta do usuário
  question        String   @db.Text

  // Contexto usado para responder (IDs de documentos relevantes)
  contextDocIds   String?  // JSON array com IDs de documentos

  // Resposta (vazio até IA ser ativada)
  answer          String?  @db.Text
  aiProvider      String?  // "anthropic-claude" | "openai" | null

  // Conversa (para manter contexto entre mensagens)
  conversationId  String?

  // Analytics
  wasHelpful      Boolean? // Feedback do usuário
  feedbackComment String?

  // Identificação do usuário
  userId          String?
  userEmail       String?
  ip              String?

  // Controle
  isPlaceholder   Boolean  @default(true) // true = IA não ativa
  createdAt       DateTime @default(now())
  respondedAt     DateTime? // Quando a IA responder (futuro)

  @@index([articleNumber])
  @@index([conversationId])
  @@index([userId])
  @@index([isPlaceholder])
  @@index([createdAt])
}
```

### Campos Importantes

- **isPlaceholder**: `true` = resposta placeholder, `false` = resposta real da IA
- **contextDocIds**: JSON array com IDs dos documentos usados como contexto
- **aiProvider**: Identificador do provedor de IA quando ativado
- **conversationId**: Agrupa perguntas da mesma conversa

---

## 4. Ativação Futura da IA

### Quando o Plano Premium for Implementado

**O que precisa ser feito:**

1. **Configurar API Key**
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
   ```

2. **Modificar `/api/artigos/[numero]/chat`**
   - Substituir resposta placeholder por chamada real à Claude API
   - Usar `contextDocIds` para montar prompt com documentos relevantes
   - Salvar resposta no campo `answer`
   - Atualizar `isPlaceholder` para `false`
   - Definir `aiProvider` como `"anthropic-claude"`

3. **Frontend** (quando implementar)
   - Criar componente de chat
   - Verificar `isPlaceholder` na resposta
   - Mostrar aviso de "funcionalidade premium" se necessário
   - Implementar feedback (útil/não útil)

### Código Exemplo (Futuro)

```typescript
// Substituir o placeholder em chat/route.ts por:
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Montar contexto dos documentos
const context = relevantDocs.map(doc =>
  `${doc.title}\n${doc.summary || doc.description}`
).join('\n\n');

// Chamar Claude
const message = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  messages: [{
    role: "user",
    content: `Baseado nos seguintes documentos sobre o Artigo ${articleNumber}:\n\n${context}\n\nResponda: ${body.question}`
  }]
});

const aiAnswer = message.content[0].text;

// Salvar resposta real
await prisma.articleQuestion.update({
  where: { id: questionRecord.id },
  data: {
    answer: aiAnswer,
    isPlaceholder: false,
    aiProvider: 'anthropic-claude',
    respondedAt: new Date()
  }
});
```

---

## 5. Analytics e Monitoramento

### Perguntas Armazenadas

Todas as perguntas são salvas no banco para:
- **Analytics**: Quais artigos geram mais dúvidas
- **Melhoria**: Identificar gaps de conteúdo
- **Treinamento**: Dataset para futuro fine-tuning

### Queries Úteis

**Artigos mais questionados:**
```sql
SELECT articleNumber, COUNT(*) as total
FROM ArticleQuestion
GROUP BY articleNumber
ORDER BY total DESC
LIMIT 10;
```

**Perguntas sem resposta útil (feedback negativo):**
```sql
SELECT * FROM ArticleQuestion
WHERE wasHelpful = false;
```

---

## 6. Segurança e Rate Limiting

### Proteções Implementadas

1. **Validação de Input**
   - Pergunta não vazia
   - Limite de tamanho (implícito no `@db.Text`)

2. **IP Tracking**
   - Registra IP para analytics e anti-abuse

3. **Futuras Implementações Recomendadas**
   - Rate limiting por IP (ex: 10 perguntas/hora)
   - Autenticação obrigatória para plano premium
   - Validação de conversationId pertence ao usuário

---

## 7. Custos Estimados (Quando Ativado)

### Claude AI (Anthropic)

**Modelo Recomendado:** `claude-3-5-sonnet-20241022`

**Custos por requisição:**
- Input: ~500 tokens (contexto + pergunta) = $0.0015
- Output: ~200 tokens (resposta) = $0.015
- **Total por pergunta:** ~$0.017 (R$ 0.08)

**Com 1000 perguntas/mês:**
- Custo: $17/mês (R$ 80/mês)

**Otimizações:**
- Cache de respostas para perguntas similares
- Limitar contexto a documentos mais relevantes
- Rate limiting por usuário

---

## 8. Testes

### Testar Timeline

```bash
# Ver todos os documentos
curl http://localhost:3000/api/artigos/75/timeline

# Ver últimos 30 dias
curl http://localhost:3000/api/artigos/75/timeline?period=30d

# Ver apenas acórdãos
curl http://localhost:3000/api/artigos/75/timeline?category=acordao
```

### Testar Chat (Placeholder)

```bash
# Fazer pergunta
curl -X POST http://localhost:3000/api/artigos/75/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "O que é dispensa de licitação?"}'

# Ver histórico
curl http://localhost:3000/api/artigos/75/chat?conversationId=UUID-DA-RESPOSTA
```

---

## 9. Checklist de Ativação

Quando for implementar a IA no plano premium:

- [ ] Configurar `ANTHROPIC_API_KEY` no ambiente de produção
- [ ] Modificar `POST /api/artigos/[numero]/chat` para chamar Claude
- [ ] Implementar rate limiting
- [ ] Criar componente frontend de chat
- [ ] Adicionar verificação de plano premium
- [ ] Configurar analytics de custos
- [ ] Testar em ambiente de staging primeiro
- [ ] Documentar para usuários finais

---

## 📝 Resumo

✅ **Pronto para uso:**
- API de Timeline funcionando
- API de Chat salvando perguntas
- Banco de dados estruturado
- Zero custos até ativação

⏳ **Aguardando implementação:**
- Frontend de chat
- Integração real com Claude AI
- Sistema de planos/pagamento
- Rate limiting por usuário

**Próximos passos:** Aguardar definição do plano de expansão para ativar funcionalidades premium.
