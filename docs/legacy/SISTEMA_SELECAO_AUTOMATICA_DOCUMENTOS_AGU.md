# Sistema de Seleção Automática de Documentos AGU

## 📋 Visão Geral

O sistema possui **seleção automática de relevância** para diferentes tipos de documentos AGU:

### Comportamento por Tipo de Documento

| Tipo | Filtro de Relevância | Justificativa |
|------|---------------------|---------------|
| **Orientações Normativas (ONs)** | ❌ NÃO (todas são importadas) | Todas as ONs da AGU tratam de licitações e contratos |
| **Pareceres Vinculantes** | ✅ SIM (filtro automático) | Assuntos variados, precisa filtrar por relevância |
| **DECOR/CONUNI** | ✅ SIM (filtro automático) | Assuntos variados, precisa filtrar por relevância |
| **Súmulas AGU** | ⚠️ A DEFINIR | Aguarda implementação |

---

## 🎯 Como Funciona a Seleção Automática

### Localização do Código
**Arquivo:** `lib/agu-modules/helpers.ts`
**Função:** `analyzeRelevancia(titulo, descricao)`

### Algoritmo de Pontuação

O sistema analisa título + descrição e atribui pontos baseado em keywords:

#### 1. Keywords de Alta Relevância (+10 pontos cada)
Definidas em `KEYWORDS_RELEVANCIA.high` no arquivo `lib/agu-types.ts`:

```typescript
- licitação, licitacao
- pregão, pregao
- dispensa
- inexigibilidade
- contrato
- Lei 14.133, Lei 14133
- Lei 8.666, Lei 8666
- registro de preços, registro de precos
- ... e outras
```

#### 2. Keywords de Média Relevância (+5 pontos cada)
Definidas em `KEYWORDS_RELEVANCIA.medium`:

```typescript
- fiscalização, fiscalizacao
- terceirização, terceirizacao
- reajuste, repactuação
- planejamento
- sanção, penalidade
- ... e outras
```

#### 3. Keywords de Baixa Relevância (+2 pontos cada)
Definidas em `KEYWORDS_RELEVANCIA.low`:

```typescript
- convênio, convenio
- parcerias
- ... e outras
```

#### 4. Keywords de Exclusão (-15 pontos cada)
Definidas em `KEYWORDS_RELEVANCIA.exclude`:

```typescript
- criminal
- penal
- tributário, tributario
- previdenciário, previdenciario
- ... (assuntos NÃO relacionados a licitações)
```

### Critério de Relevância

```typescript
Score >= 10 → Documento é RELEVANTE
Score < 10  → Documento é DESCARTADO
```

**Score normalizado:** 0-100

---

## 📊 Exemplo Prático

### Exemplo 1: Parecer RELEVANTE
**Título:** "Parecer Vinculante nº 10/2024 - Dispensa de licitação para emergência"

**Análise:**
- "licitação" → +10 pontos
- "dispensa" → +10 pontos
- **Score total:** 20 pontos
- **Resultado:** ✅ RELEVANTE (score >= 10)

### Exemplo 2: Parecer NÃO RELEVANTE
**Título:** "Parecer Vinculante nº 8/2023 - Questões tributárias de previdência"

**Análise:**
- "tributárias" → -15 pontos
- "previdência" → -15 pontos
- **Score total:** 0 pontos (mínimo)
- **Resultado:** ❌ DESCARTADO (score < 10)

### Exemplo 3: ON (sempre relevante)
**Título:** "Orientação Normativa nº 50/2024"

**Análise:**
- Análise é executada apenas para sugerir cursos e extrair temas
- **Resultado:** ✅ SEMPRE IMPORTADA (independente do score)

---

## 🔧 Como Usar

### 1. Pareceres Vinculantes (com filtro)

```typescript
import { scrapeParecerVinculante } from '@/lib/agu-modules/pareceres-vinculantes';

const result = await scrapeParecerVinculante({
  tipos: ['parecer-vinculante'],
  filtroRelevancia: true, // ← ATIVA O FILTRO
  // ...
});

// Apenas pareceres relevantes serão retornados
console.log(`Total: ${result.total}`);
console.log(`Relevantes: ${result.totalRelevante}`);
```

### 2. Orientações Normativas (sem filtro)

```typescript
import { scrapeOrientacoesNormativas } from '@/lib/agu-modules/orientacoes-normativas';

const result = await scrapeOrientacoesNormativas({
  tipos: ['orientacao-normativa'],
  filtroRelevancia: false, // ← DESLIGADO (mas pode estar true, será ignorado)
  // ...
});

// TODAS as ONs serão importadas
// isRelevante será sempre true
```

### 3. DECOR (com filtro)

```typescript
import { scrapeParecerCONUNI } from '@/lib/agu-modules/pareceres-conuni';

const result = await scrapeParecerCONUNI({
  tipos: ['parecer-conuni'],
  filtroRelevancia: true, // ← ATIVA O FILTRO
  // ...
});

// Apenas DECOR relevantes serão retornados
```

---

## 🎓 Sugestão Automática de Cursos

Além da relevância, o sistema também **sugere cursos** automaticamente baseado em keywords específicas:

### Mapeamento de Cursos
Definido em `CURSOS_KEYWORDS` no arquivo `lib/agu-types.ts`:

```typescript
'1': [ // Nova Lei de Licitações
  'lei 14.133', 'lei 14133', 'nova lei',
  'licitação', 'pregão', 'dispensa'
],
'2': [ // Planejamento das Contratações
  'planejamento', 'estudo técnico preliminar', 'etp'
],
'3': [ // Gestão e Fiscalização de Contratos
  'fiscalização', 'gestor', 'fiscal de contrato'
],
'4': [ // Processo Administrativo Sancionador
  'sanção', 'penalidade', 'multa', 'impedimento'
],
// ... outros cursos
```

### Como Funciona

1. Para cada documento, o sistema verifica se alguma keyword de cada curso está presente
2. Se encontrar match, adiciona o curso à lista de cursos sugeridos
3. Se não encontrar nenhum curso, adiciona automaticamente o curso '1' (Nova Lei de Licitações)

**Exemplo:**
```typescript
Título: "Parecer sobre fiscalização de contratos de terceirização"

Keywords encontradas:
- "fiscalização" → Curso '3' (Gestão e Fiscalização)
- "contratos" → Curso '1' (Nova Lei de Licitações)
- "terceirização" → Curso '6' (Terceirização e Formação de Preços)

cursosIds: ['1', '3', '6']
```

---

## 🔍 Extração de Temas

O sistema também identifica **temas** automaticamente:

### Temas Detectados

```typescript
- licitacao         → "Licitação"
- pregao            → "Pregão Eletrônico"
- dispensa          → "Dispensa/Inexigibilidade"
- contrato          → "Contratos Administrativos"
- lei-14133         → "Lei 14.133/2021"
- lei-8666          → "Lei 8.666/93"
- registro-precos   → "Registro de Preços"
- fiscalizacao      → "Fiscalização Contratual"
- terceirizacao     → "Terceirização"
- reajuste          → "Reajuste/Repactuação"
- planejamento      → "Planejamento"
- sancao            → "Sanções Administrativas"
- convenio          → "Convênios"
```

**Uso:**
- Facilita filtros na área restrita
- Permite agrupamento de documentos por tema
- Auxilia na busca e navegação

---

## 📈 Estatísticas de Seleção

Ao executar o scraping, você recebe estatísticas detalhadas:

```typescript
{
  success: true,
  tipo: 'parecer-vinculante',
  documentos: [...],
  total: 215,              // Total extraído da página
  totalRelevante: 87,      // Total que passou no filtro (score >= 10)
  executionTime: 5432,
  errors: [],
  warnings: []
}
```

**Taxa de relevância:** `(totalRelevante / total) * 100`

---

## ⚙️ Configuração Personalizada

### Ajustar Threshold de Relevância

Se quiser ser mais restritivo ou permissivo:

**Arquivo:** `lib/agu-modules/helpers.ts`
**Linha 103:**

```typescript
// Padrão atual: score >= 10
const isRelevante = score >= 10;

// Mais restritivo (apenas documentos com alta relevância):
const isRelevante = score >= 20;

// Mais permissivo (aceita documentos com relevância média):
const isRelevante = score >= 5;
```

### Adicionar Novas Keywords

**Arquivo:** `lib/agu-types.ts`

```typescript
export const KEYWORDS_RELEVANCIA = {
  high: [
    // ... existentes
    'nova keyword de alta relevância',
  ],
  medium: [
    // ... existentes
    'nova keyword de média relevância',
  ],
  low: [
    // ... existentes
    'nova keyword de baixa relevância',
  ],
  exclude: [
    // ... existentes
    'nova keyword para excluir',
  ]
};
```

### Adicionar Cursos

**Arquivo:** `lib/agu-types.ts`

```typescript
export const CURSOS_KEYWORDS: Record<string, string[]> = {
  // ... cursos existentes
  '11': [ // Novo curso
    'keyword1',
    'keyword2',
    'keyword3'
  ]
};
```

---

## 🧪 Testar o Sistema

### Teste Manual de Relevância

```typescript
import { analyzeRelevancia } from '@/lib/agu-modules/helpers';

const result = analyzeRelevancia(
  'Parecer sobre dispensa de licitação',
  'Análise da possibilidade de dispensa em casos emergenciais'
);

console.log(result);
// {
//   isRelevante: true,
//   score: 20,
//   temas: ['Licitação', 'Dispensa/Inexigibilidade']
// }
```

### Teste de Sugestão de Cursos

```typescript
import { suggestCursos } from '@/lib/agu-modules/helpers';

const cursos = suggestCursos(
  'Orientação sobre fiscalização de contratos',
  'Diretrizes para gestores e fiscais de contratos'
);

console.log(cursos);
// ['1', '3'] → Nova Lei de Licitações, Gestão e Fiscalização
```

---

## 📊 Comparação: ONs vs Pareceres

### Orientações Normativas (ONs)

```typescript
✅ Todas importadas (100%)
✅ Análise de relevância apenas para sugerir cursos
✅ isRelevante = true (sempre)
✅ Score calculado mas não usado para filtrar
✅ Cursos sugeridos baseado em keywords
```

**Justificativa:** Todas as ONs da AGU tratam de licitações e contratos, portanto são sempre relevantes para nossa temática.

### Pareceres Vinculantes

```typescript
⚠️  Filtro de relevância ativo
⚠️  Apenas pareceres com score >= 10 são importados
✅ Análise completa (score + temas + cursos)
✅ Taxa de relevância varia (estimado: 30-50%)
❌ Pareceres não relevantes são descartados
```

**Justificativa:** Pareceres da AGU abordam assuntos variados (tributário, previdenciário, criminal, etc.), precisando de filtro para selecionar apenas os relacionados a licitações e contratos.

---

## 🚀 Próximos Passos

### Melhorias Planejadas

1. **Machine Learning:**
   - Treinar modelo baseado em feedback do admin
   - Melhorar precisão da classificação
   - Sistema de aprendizado contínuo

2. **Interface Admin:**
   - Visualizar documentos descartados
   - Permitir reclassificação manual
   - Ajustar threshold dinamicamente

3. **Análise de Contexto:**
   - NLP para entender contexto além de keywords
   - Análise semântica do conteúdo
   - Detecção de sinônimos e variações

4. **Métricas:**
   - Dashboard com estatísticas de relevância
   - Taxa de acerto por tipo de documento
   - Cursos mais frequentes

---

## 📝 Resumo

**Sistema Atual:**
- ✅ Seleção automática de Pareceres e DECOR por relevância
- ✅ Todas as ONs sempre importadas
- ✅ Sugestão automática de cursos (10 cursos)
- ✅ Extração automática de temas (13 temas)
- ✅ Score de 0-100 com threshold configurável
- ✅ Keywords de inclusão e exclusão
- ✅ Sistema testado e funcional

**Benefícios:**
- 🎯 Reduz volume de documentos não relevantes
- 🎓 Organiza automaticamente por curso
- 🏷️ Categoriza por temas
- ⚡ Processa milhares de documentos automaticamente
- 📊 Fornece estatísticas detalhadas

**Suporte:**
- Ver `lib/agu-types.ts` para configurar keywords
- Ver `lib/agu-modules/helpers.ts` para lógica de análise
- Ver scripts de teste para exemplos práticos

---

**Última atualização:** 2025-11-02
**Versão:** 1.0
**Status:** ✅ Implementado e funcional
