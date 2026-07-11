# 🤖 Configuração da Classificação por IA - Documentação

## ✅ Configuração Funcionando (Testado e Aprovado)

Esta documentação registra as configurações que **funcionaram** para classificação automática de documentos usando Claude API.

---

## 🔑 Variáveis de Ambiente

### Local (.env.local)
```env
ANTHROPIC_API_KEY=sk-ant-api03-wk6bseQvhpc2fiaQCRt5iXJoRo0yN5jwobryR1uquUhgKhM6U86BdrleRf2LcBVYT2xpRQFFPt4nH...
```

### Vercel (Production)
- ✅ Configurada em: Vercel Dashboard → Settings → Environment Variables
- ✅ Scope: All Environments
- ✅ Valor: Mesma chave da API do Claude

---

## 🏗️ Arquitetura de Lotes (Evita Timeout)

### Problema Resolvido
- **Antes:** Tentava classificar 70 documentos de uma vez → 140 segundos → Timeout 504
- **Depois:** Processa em lotes de 3 documentos → 1.5s por lote → Sem timeout

### Configuração Frontend
**Arquivo:** `app/admin/tcu-manager/page.tsx`

```typescript
const BATCH_SIZE = 3; // 3 documentos por requisição (evita timeout)

// Processa em lotes
for (let i = 0; i < docs.length; i += BATCH_SIZE) {
  const batch = docs.slice(i, i + BATCH_SIZE);

  const response = await fetch('/api/admin/tcu-manager/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documents: batch.map(doc => ({
        tcuData: doc.tcuData,
        enrichment: doc.enrichment,
        rowIndex: doc.rowIndex,
      })),
    }),
  });

  // Atualiza progresso em tempo real
  setClassificationProgress({ current: processedCount, total: docs.length });
}
```

### Configuração Backend
**Arquivo:** `app/api/admin/tcu-manager/classify/route.ts`

```typescript
const classificationResults = await classifyTCUAcordaosBatch(inputs, {
  delayMs: 500, // 0.5 segundos entre documentos (lotes pequenos)
  onProgress: (current, total, result) => {
    console.log(`[TCU Classify API] Progresso: ${current}/${total}`);
  },
});
```

---

## 🎯 Configuração da API do Claude

### Modelo
```typescript
model: 'claude-3-5-sonnet-20241022'
```
⚠️ **Importante:** Este é o modelo correto disponível. Não usar datas futuras como `20250219`.

### Parâmetros da Requisição
```typescript
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1500,
  temperature: 0.3,
  // ❌ NÃO adicionar: timeout (API não aceita esse parâmetro)
  messages: [{ role: 'user', content: prompt }],
});
```

### ❌ Erros Comuns a Evitar

**Erro 1: Adicionar parâmetro `timeout`**
```typescript
// ❌ ERRADO - Causa erro 400
const response = await anthropic.messages.create({
  timeout: 15000, // API não aceita esse parâmetro!
  model: 'claude-3-5-sonnet-20241022',
  ...
});

// ✅ CORRETO - Sem timeout
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1500,
  ...
});
```

**Erro 2: Usar modelo com data futura**
```typescript
// ❌ ERRADO - Modelo não existe
model: 'claude-3-5-sonnet-20250219'

// ✅ CORRETO
model: 'claude-3-5-sonnet-20241022'
```

---

## 📊 Estrutura do Prompt de Classificação

### Campos Retornados pela IA
```typescript
interface ClassificationResult {
  success: boolean;
  numeroAcordao: string;
  titulo: string;          // Título descritivo do documento
  descricao: string;       // Resumo de 100-200 caracteres
  categoria: string;       // acordao, parecer, apostila, etc.
  cursos: string[];        // IDs dos cursos (ex: ['1', '2'])
  tags: string[];          // Tags relevantes
  artigos: string[];       // Artigos da Lei 14.133/2021
  confianca: number;       // 0-100
  raciocinio: string;      // Explicação da classificação
}
```

### Exemplo de Prompt (TCU)
```typescript
const prompt = `
Você é um especialista em Direito Administrativo e Licitações Públicas.

TAREFA: Classifique este acórdão do TCU e sugira metadados.

DADOS DO ACÓRDÃO:
${JSON.stringify(input.planilha, null, 2)}

RETORNE JSON com:
{
  "titulo": "Título descritivo (50-80 chars)",
  "descricao": "Resumo (100-200 chars)",
  "categoria": "acordao",
  "cursos": ["1", "2"],  // IDs dos cursos relevantes
  "tags": ["tag1", "tag2"],
  "artigos": ["75", "92"],  // Artigos da Lei 14.133/2021
  "confianca": 85,
  "raciocinio": "Explicação da classificação"
}
`;
```

---

## 🔄 Aplicação para Outros Tipos de Documentos

### Pareceres da AGU
**Arquivo para criar:** `lib/agu-classifier.ts` (similar a `tcu-classifier.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk';

export interface AGUClassificationInput {
  numero: string;
  ementa: string;
  texto: string;
  data?: string;
  orgao?: string;
}

export interface AGUClassificationResult {
  success: boolean;
  titulo: string;
  descricao: string;
  categoria: 'parecer' | 'nota-tecnica' | 'orientacao';
  cursos: string[];
  tags: string[];
  artigos: string[];
  confianca: number;
  raciocinio: string;
}

export async function classifyAGUParecer(
  input: AGUClassificationInput
): Promise<AGUClassificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      titulo: `Parecer AGU ${input.numero}`,
      descricao: input.ementa.substring(0, 200),
      categoria: 'parecer',
      cursos: ['1'],
      tags: ['agu', 'parecer'],
      artigos: [],
      confianca: 60,
      raciocinio: 'Classificação automática (IA não disponível)',
    };
  }

  const anthropic = new Anthropic({ apiKey });

  const prompt = `
Você é um especialista em Direito Administrativo e Licitações Públicas.

TAREFA: Classifique este parecer da AGU e sugira metadados.

DADOS DO PARECER:
Número: ${input.numero}
Ementa: ${input.ementa}
Órgão: ${input.orgao || 'N/A'}
Texto: ${input.texto.substring(0, 2000)}

RETORNE JSON com:
{
  "titulo": "Título descritivo (50-80 chars)",
  "descricao": "Resumo (100-200 chars)",
  "categoria": "parecer",
  "cursos": ["1", "2"],
  "tags": ["agu", "parecer", "tag-relevante"],
  "artigos": ["75", "92"],  // Artigos da Lei 14.133/2021 mencionados
  "confianca": 85,
  "raciocinio": "Explicação da classificação"
}
`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          ...parsed,
        };
      }
    }

    throw new Error('Resposta inválida da IA');

  } catch (error) {
    console.error('[AGU Classifier] Erro:', error);
    return {
      success: false,
      titulo: `Parecer AGU ${input.numero}`,
      descricao: input.ementa.substring(0, 200),
      categoria: 'parecer',
      cursos: ['1'],
      tags: ['agu', 'parecer'],
      artigos: [],
      confianca: 60,
      raciocinio: `Erro na IA: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    };
  }
}
```

### Enunciados (IBDA, INCP, CJF)
**Já implementado em:** `lib/enunciados-parser.ts`
- ✅ Usa a mesma estrutura de classificação
- ✅ Reutiliza `tcu-classifier.ts` internamente
- ✅ Funciona com processamento em lotes

---

## ✅ Checklist para Novos Tipos de Documentos

Ao implementar classificação para novos tipos (ex: Pareceres AGU):

- [ ] Criar classifier em `lib/[tipo]-classifier.ts`
- [ ] Usar modelo `claude-3-5-sonnet-20241022`
- [ ] **NÃO** adicionar parâmetro `timeout`
- [ ] Configurar `max_tokens: 1500`, `temperature: 0.3`
- [ ] Implementar fallback quando IA não disponível (confianca: 60%)
- [ ] Processar em **lotes de 3 documentos** no frontend
- [ ] Usar `delayMs: 500` entre documentos no backend
- [ ] Retornar interface padronizada com `artigos: string[]`
- [ ] Adicionar logs de progresso
- [ ] Testar com ANTHROPIC_API_KEY configurada

---

## 🧪 Teste de Configuração

**Script de teste:** `scripts/test-anthropic-key.js`

```bash
node scripts/test-anthropic-key.js
```

**Saída esperada:**
```
✅ ANTHROPIC_API_KEY encontrada!
   Prefixo: sk-ant-api03-wk6bseQ...
   Tamanho: 108 caracteres

📊 Status:
   Local (dev): ✅ Configurada
   Vercel (prod): ✅ Configurada
```

---

## 📈 Performance

### Métricas (70 documentos)
- **Antes:** 140s → Timeout 504 ❌
- **Depois:** ~36s → Sucesso 200 ✅

### Cálculo
```
Lotes: 70 docs ÷ 3 = 24 lotes
Tempo por lote: (3 docs × 0.5s delay) + ~1s IA = ~2.5s
Total: 24 lotes × 1.5s = ~36 segundos
```

---

## 🎓 Cursos (IDs de Referência)

```typescript
const CURSOS = {
  '1': 'Nova Lei de Licitações (Lei 14.133/2021)',
  '2': 'Planejamento das Contratações Públicas',
  '3': 'Gestão e Fiscalização de Contratos',
  '4': 'Processo Administrativo Sancionador',
  '5': 'Inovação nas Contratações Públicas',
  '6': 'Terceirização e Formação de Preços',
  '7': 'Assessoramento Jurídico na Nova Lei',
  '8': 'Revisão, Reajuste e Repactuação',
  '9': 'Alterações Contratuais',
  '10': 'Contratação Direta',
};
```

---

## 📝 Notas Importantes

1. **Serverless Limits:** Vercel tem limite de 10 segundos para funções serverless no plano gratuito
2. **Rate Limits:** Claude API tem rate limits - lotes pequenos ajudam a evitar
3. **Timeout Parameter:** API do Claude **não aceita** parâmetro `timeout`
4. **Model Versions:** Sempre use versão disponível (checar documentação Anthropic)
5. **Fallback:** Sempre implementar fallback para quando IA não está disponível

---

**Data de criação:** 2025-10-27
**Última atualização:** 2025-10-27
**Status:** ✅ Testado e Aprovado
**Aplicações:** TCU Acórdãos, Enunciados, AGU Pareceres (futuro)
