# 🤖 Sistema de Classificação Automática com Claude AI

Este documento explica o sistema de classificação em 2 camadas implementado no site do Prof. Daniel Barral.

## 📋 Visão Geral

O sistema classifica automaticamente documentos jurídicos (PDFs, artigos, pareceres, etc.) sugerindo:
- **Cursos** mais relevantes (pode sugerir múltiplos)
- **Categoria** do documento (apostila, acórdão, parecer, edital, artigo, outro)
- **Tags** relevantes (leis citadas, termos técnicos, conceitos)

## 🔄 Arquitetura em 2 Camadas

### Camada 1: Análise Básica (Sempre Executada)
**Arquivo:** `lib/auto-classifier.ts`

- ✅ **Rápida:** ~1ms por documento
- ✅ **Gratuita:** Sem custos de API
- ✅ **Baseada em regras:** Palavras-chave e padrões específicos
- ⚠️ **Limitada:** Não entende contexto semântico

```typescript
import { classifyDocumentSync } from '@/lib/auto-classifier';

const result = classifyDocumentSync(
  'Acórdão TCU 1234/2023 - Dispensa de Licitação',
  'Análise de contratação direta...'
);

console.log(result);
// {
//   courseSlugs: ['contratacao-direta'],
//   category: 'acordao',
//   tags: ['TCU', 'dispensa', 'Lei 14.133/2021'],
//   confidence: 80,
//   source: 'basic'
// }
```

### Camada 2: Análise Avançada com Claude AI (Condicional)
**Arquivo:** `lib/claude-classifier.ts`

- 🚀 **Inteligente:** Análise semântica profunda
- 🎯 **Precisa:** Entende contexto e nuances
- 💰 **Paga:** ~$0.0013 USD por documento (Haiku)
- ⏱️ **Mais lenta:** ~300-500ms por documento

**Acionada automaticamente quando:**
1. Confiança da análise básica < 50%
2. `ANTHROPIC_API_KEY` configurada
3. `forceBasic` não é `true`

```typescript
import { classifyDocumentEnhanced } from '@/lib/auto-classifier';

const result = await classifyDocumentEnhanced(
  'Decisão sobre aplicação de multa em procedimento administrativo',
  'Análise de penalidades em contrato após execução...'
);

console.log(result);
// {
//   courseSlugs: ['processo-sancionador', 'gestao-fiscalizacao-contratos'],
//   category: 'acordao',
//   tags: ['sanção', 'multa', 'fiscalização', 'Lei 14.133/2021', 'art. 155'],
//   confidence: 85,
//   source: 'claude',
//   reasoning: 'Documento trata principalmente de aplicação de sanções...'
// }
```

## ⚙️ Configuração

### 1. Obter API Key da Anthropic

1. Acesse: https://console.anthropic.com
2. Crie uma conta ou faça login
3. Vá em **Settings → API Keys**
4. Clique em **Create Key**
5. Copie a chave (formato: `sk-ant-api03-...`)

### 2. Configurar Localmente

**Arquivo:** `.env.local`

```bash
# Anthropic Claude API (Catalogação Automática Avançada)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
```

### 3. Configurar em Produção (Vercel)

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. **Settings → Environment Variables**
4. Adicione:
   - **Key:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-api03-...`
   - **Environment:** Production, Preview, Development
5. **Save** e redesploy

### 4. Adicionar Créditos (IMPORTANTE!)

⚠️ **A API key precisa ter créditos para funcionar!**

1. Vá em https://console.anthropic.com/settings/billing
2. Clique em **Add Payment Method**
3. Adicione cartão de crédito
4. Opcionalmente, adicione créditos pré-pagos

**Custos estimados:**
- Modelo usado: **Claude 3.5 Haiku** (~$0.25 por 1M tokens de input)
- Documento médio (10 páginas): ~5000 tokens
- **Custo por documento:** ~$0.0013 USD
- **1000 documentos:** ~$1.30 USD

## 🧪 Testes

### Teste Completo (Análise Básica + Claude)

```bash
npx tsx scripts/test-claude-classifier.ts
```

**Saída esperada:**
```
✓ API Key configurada

═══ TESTE 1: ANÁLISE BÁSICA (SEM CLAUDE) ═══
📄 Acórdão TCU 1234/2023...
   Curso: contratacao-direta ✓
   Categoria: acordao ✓
   Confiança: 80%

═══ TESTE 2: ANÁLISE AVANÇADA (COM CLAUDE) ═══
📄 Documento ambíguo...
⏳ Aguardando resposta do Claude...
✓ Análise concluída em 0.35s

   Cursos: processo-sancionador, gestao-fiscalizacao-contratos ✓
   Fonte: CLAUDE
   💬 Raciocínio: "Documento trata de sanções..."

✅ Todos os testes concluídos!
```

### Teste Forçado com Claude

```bash
npx tsx scripts/test-claude-force.ts
```

## 📊 Quando o Claude é Usado

### Cenários com Alta Confiança (Análise Básica)

| Documento | Confiança | Análise |
|-----------|-----------|---------|
| "Acórdão TCU - Dispensa de Licitação" | 80% | ✅ Básica |
| "Edital de Pregão Eletrônico 001/2024" | 70% | ✅ Básica |
| "Parecer AGU sobre Gestão de Contratos" | 65% | ✅ Básica |

### Cenários com Baixa Confiança (Claude Acionado)

| Documento | Confiança | Análise |
|-----------|-----------|---------|
| "Manual de Planejamento do PCA 2024" | 5% | 🤖 Claude |
| "Decisão sobre aplicação de multa" | 5% | 🤖 Claude |
| "Análise de reequilíbrio contratual" | 40% | 🤖 Claude |

## 🔧 Como Usar no Código

### Importação Individual (Admin Panel)

```typescript
import { classifyDocumentEnhanced } from '@/lib/auto-classifier';

// Em um API route (app/api/admin/upload/route.ts)
export async function POST(request: Request) {
  const { title, description } = await request.json();

  const classification = await classifyDocumentEnhanced(
    title,
    description,
    false // Permite Claude
  );

  // Salva no banco com a classificação
  await prisma.document.create({
    data: {
      title,
      description,
      courseId: classification.courseSlugs[0], // Primeiro curso sugerido
      category: classification.category,
      tags: classification.tags,
    },
  });

  return Response.json({
    success: true,
    classification,
  });
}
```

### Importação em Lote (Excel) - Sem Claude

```typescript
import { classifyDocumentSync } from '@/lib/auto-classifier';

// O excel-processor usa análise síncrona (rápida)
function processExcelRow(row: ExcelRow) {
  const classification = classifyDocumentSync(
    row.titulo,
    row.descricao
  );

  return {
    ...row,
    courseSlug: classification.courseSlugs[0],
    category: classification.category,
    tags: classification.tags,
  };
}
```

## 🎛️ Configurações Avançadas

### Ajustar Limiar de Confiança

**Arquivo:** `lib/auto-classifier.ts`

```typescript
// Linha 354 - Ajustar este valor
const CONFIDENCE_THRESHOLD = 50; // Padrão: 50%

// Valores sugeridos:
// 30 = Claude usado com mais frequência (mais custo, mais precisão)
// 50 = Balanceado (padrão recomendado)
// 70 = Claude usado raramente (menos custo, menos precisão)
```

### Forçar Análise Básica (Economizar)

```typescript
const result = await classifyDocumentEnhanced(
  title,
  description,
  true // forceBasic = true, nunca usa Claude
);
```

### Modelo do Claude

**Arquivo:** `lib/claude-classifier.ts`

```typescript
// Linha 71
model: 'claude-3-5-haiku-20241022', // Mais econômico

// Alternativas:
// 'claude-3-5-sonnet-20241022'   // Mais inteligente, mais caro (~$3/1M)
// 'claude-3-opus-20240229'       // Máxima precisão (~$15/1M)
```

## 📈 Monitoramento

### Logs no Console

```typescript
// Análise básica retornada
// (nenhum log)

// Claude acionado
[Enhanced Classifier] Baixa confiança (35%). Acionando Claude...

// Claude completou
[Claude Classifier] Análise concluída: {
  title: "Manual de...",
  courses: ["planejamento-contratacoes"],
  category: "apostila",
  confidence: 85
}

// Erro no Claude (fallback para análise básica)
[Claude Classifier] Erro ao classificar documento: ...
[Enhanced Classifier] Erro ao usar Claude. Retornando análise básica
```

## ❓ Troubleshooting

### Problema: Claude nunca é usado

**Diagnóstico:**
```typescript
import { isClaudeAvailable } from '@/lib/claude-classifier';

console.log('Claude disponível?', isClaudeAvailable());
// Se false, API key não está configurada
```

**Soluções:**
1. Verificar se `ANTHROPIC_API_KEY` está no `.env.local`
2. Verificar se tem créditos na conta
3. Testar com `npx tsx scripts/test-claude-force.ts`

### Problema: Erro 401 (Unauthorized)

❌ **Erro:** `API key inválida`

✅ **Solução:**
1. Verificar se copiou a chave completa
2. Gerar nova chave em https://console.anthropic.com

### Problema: Erro 400 (Credit balance too low)

❌ **Erro:** `Your credit balance is too low`

✅ **Solução:**
1. Acessar https://console.anthropic.com/settings/billing
2. Adicionar método de pagamento
3. Adicionar créditos ($5-10 USD recomendado para início)

### Problema: Erro 429 (Rate limit)

❌ **Erro:** `Rate limit exceeded`

✅ **Solução:**
1. Aguardar alguns segundos
2. Implementar retry com backoff
3. Considerar upgrade do plano

## 📚 Arquivos Criados/Modificados

### Novos Arquivos

- ✅ `lib/claude-classifier.ts` - Serviço de análise com Claude
- ✅ `scripts/test-claude-classifier.ts` - Teste completo
- ✅ `scripts/test-claude-force.ts` - Teste forçado
- ✅ `CLASSIFICACAO_CLAUDE.md` - Esta documentação

### Arquivos Modificados

- ✅ `lib/auto-classifier.ts` - Adicionadas funções `classifyDocumentEnhanced` e `classifyDocumentSync`
- ✅ `.env.local` - Adicionada `ANTHROPIC_API_KEY`
- ✅ `package.json` - Adicionados pacotes `@anthropic-ai/sdk`, `dotenv`, `tsx`

## 🚀 Próximos Passos

1. ✅ **Configuração concluída:** Sistema pronto para uso
2. ✅ **Testes validados:** Integração funcionando
3. ⏳ **Adicionar créditos:** Necessário para uso em produção
4. ⏳ **Deploy na Vercel:** Configurar `ANTHROPIC_API_KEY` nas variáveis de ambiente
5. ⏳ **Monitorar uso:** Acompanhar custos no console da Anthropic

## 💡 Dicas de Otimização

1. **Use análise básica para documentos claros** (ex: "Acórdão TCU...", "Edital de Pregão...")
2. **Reserve Claude para documentos ambíguos** (ex: títulos genéricos)
3. **Monitore custos mensalmente** no console da Anthropic
4. **Ajuste o limiar de confiança** conforme necessário
5. **Considere cache** para documentos já classificados

## 📞 Suporte

- **Documentação Anthropic:** https://docs.anthropic.com
- **Console Anthropic:** https://console.anthropic.com
- **Status da API:** https://status.anthropic.com
- **Pricing:** https://www.anthropic.com/pricing

---

**Última atualização:** 2025-10-26
**Versão do sistema:** 1.0.0
**Modelo do Claude:** 3.5 Haiku (20241022)
