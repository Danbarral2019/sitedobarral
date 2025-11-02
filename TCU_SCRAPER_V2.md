# TCU Scraper v2 - Sistema Completo com Versionamento

## 📋 Visão Geral

O **TCU Scraper v2** é uma versão melhorada do scraper de acórdãos do TCU que aplica as mesmas técnicas do AGU Scraper v4, incluindo:

✅ **Versionamento automático** - Detecta mudanças em acórdãos existentes
✅ **Keywords unificadas** - Sistema compartilhado com AGU para consistência
✅ **Análise de relevância** - Filtra automaticamente acórdãos sobre licitações/contratos
✅ **Sugestão de cursos** - Mapeia acórdãos para cursos relevantes
✅ **Estatísticas detalhadas** - Relatórios completos de importação

---

## 🏗️ Arquitetura

### Arquivos Criados/Modificados

```
lib/
├── shared-keywords.ts          ✨ NOVO - Keywords unificadas AGU + TCU
├── tcu-module.ts               ✨ NOVO - Módulo TCU com versionamento
├── tcu-scraper.ts              🔄 ATUALIZADO - Usa keywords unificadas
└── agu-modules/
    └── versioning.ts           ✅ EXISTENTE - Reusado pelo TCU

scripts/
└── test-tcu-with-versioning.ts ✨ NOVO - Script de teste completo
```

### Fluxo de Dados

```
1. TCU API
   ↓
2. tcu-scraper.ts (fetch + análise de relevância)
   ↓
3. tcu-module.ts (versionamento + importação)
   ↓
4. agu-modules/versioning.ts (detecção de mudanças)
   ↓
5. Prisma Database (Document + DocumentVersion)
```

---

## 🔑 Keywords Unificadas

### Localização
**Arquivo:** `lib/shared-keywords.ts`

### Estrutura

```typescript
export const KEYWORDS_RELEVANCIA = {
  high: [...],    // +10 pontos cada
  medium: [...],  // +5 pontos cada
  low: [...],     // +2 pontos cada
  exclude: [...]  // -15 pontos cada
}

export const CURSOS_KEYWORDS = {
  '1': [...],  // Nova Lei de Licitações
  '2': [...],  // Planejamento
  '3': [...],  // Gestão e Fiscalização
  // ... outros cursos
}

export const TEMAS_MAP = {
  'licitacao': 'Licitação',
  'pregao': 'Pregão Eletrônico',
  // ... outros temas
}
```

### Benefícios da Unificação

1. **Consistência**: AGU e TCU usam mesmos critérios
2. **Manutenção**: Atualizar keywords em um único lugar
3. **Expansão**: Fácil adicionar novos documentos (STF, STJ, etc.)

---

## 📥 Sistema de Importação com Versionamento

### Função Principal

```typescript
import { importTCUAcordaosWithVersioning } from '@/lib/tcu-module';

const result = await importTCUAcordaosWithVersioning(acordaos);

console.log(result);
// {
//   total: 100,
//   novos: 45,
//   atualizados: 12,
//   semMudancas: 43,
//   erros: 0,
//   detalhes: [...]
// }
```

### Detecção de Mudanças

O sistema detecta automaticamente mudanças em:

- ✅ **Sumário** (descrição do acórdão)
- ✅ **URLs** (PDF, arquivo, página)
- ✅ **Situação** (publicado, em tramitação, etc.)
- ✅ **Relator** (ministro relator)
- ✅ **Data da sessão**

**Exemplo:**

```typescript
// Importação inicial
Acórdão 1234/2024 - Situação: "Em tramitação"
→ Cria documento + versão 1

// Re-importação após publicação
Acórdão 1234/2024 - Situação: "Publicado", PDF disponível
→ Atualiza documento + cria versão 2 (detecta mudanças)

// Re-importação sem mudanças
Acórdão 1234/2024 - Mesmos dados
→ Não faz nada (versão 2 continua sendo a última)
```

---

## 🎯 Análise de Relevância

### Threshold

```typescript
Score >= 10 → RELEVANTE
Score < 10  → NÃO RELEVANTE
```

### Exemplos

#### Acórdão RELEVANTE
```
Título: "Acórdão 1234/2024 - Pregão eletrônico para contratação de serviços"
Sumário: "Licitação. Pregão. Lei 14.133/2021. Dispensa de licitação..."

Keywords encontradas:
- "pregão" → +10
- "licitação" → +10
- "lei 14.133" → +10
- "dispensa" → +10

Score total: 40
Resultado: ✅ RELEVANTE
Cursos: ['1', '10']
```

#### Acórdão NÃO RELEVANTE
```
Título: "Acórdão 5678/2024 - Aposentadoria de servidor"
Sumário: "Trata de concessão de aposentadoria. Direito previdenciário..."

Keywords encontradas:
- "aposentadoria" → -15
- "previdenciário" → -15

Score total: 0 (mínimo)
Resultado: ❌ NÃO RELEVANTE
```

---

## 🧪 Teste Completo

### Executar Teste

```bash
npx tsx scripts/test-tcu-with-versioning.ts
```

### Passos do Teste

1. **PASSO 1**: Busca 10 acórdãos via API do TCU (apenas relevantes, ano 2024)
2. **PASSO 2**: Importa com versionamento
3. **PASSO 3**: Estatísticas de versionamento por tipo de mudança
4. **PASSO 4**: Exemplos de acórdãos com histórico de versões
5. **PASSO 5**: Teste de re-importação (deve detectar "sem mudanças")
6. **PASSO 6**: Verificação de integridade dos dados
7. **PASSO 7**: Análise de cursos sugeridos

### Saída Esperada

```
🚀 Teste de Importação de Acórdãos TCU com Versionamento
============================================================

📡 PASSO 1: Buscando acórdãos do TCU via API...

✅ Busca concluída:
   Total extraído: 10
   Todos relevantes: true

📥 PASSO 2: Importando com versionamento...

[1/10] Processando Acórdão 1234/2024...
  ✅ Novo acórdão criado
[2/10] Processando Acórdão 2345/2024...
  ✅ Novo acórdão criado
...

[TCU Module] Importação concluída!
  ✅ Novos: 10
  🔄 Atualizados: 0
  ⏭️  Sem mudanças: 0
  ❌ Erros: 0

📊 PASSO 3: Estatísticas de versionamento...

   Total de versões TCU no banco: 10

   Versões por tipo de mudança:
   - created: 10

...

🎉 TESTE CONCLUÍDO COM SUCESSO!
```

---

## 📊 Comparação: v1 vs v2

### Versão 1 (Antiga)

```typescript
❌ Keywords hardcoded no tcu-scraper.ts
❌ Sem versionamento
❌ Sem detecção de mudanças
❌ Duplicatas possíveis em re-importação
❌ Sem estatísticas de importação
❌ Inconsistência com AGU
```

### Versão 2 (Nova)

```typescript
✅ Keywords unificadas (shared-keywords.ts)
✅ Versionamento automático completo
✅ Detecção de mudanças com field-level diff
✅ Previne duplicatas automaticamente
✅ Estatísticas detalhadas (novos, atualizados, erros)
✅ Consistência total com AGU Scraper v4
```

---

## 🔧 Como Usar

### 1. Importação Simples

```typescript
import { fetchTCUAcordaos } from '@/lib/tcu-scraper';
import { importTCUAcordaosWithVersioning } from '@/lib/tcu-module';

// 1. Buscar acórdãos
const acordaos = await fetchTCUAcordaos({
  quantidade: 50,
  anoInicio: 2024,
  onlyRelevant: true
});

// 2. Importar com versionamento
const result = await importTCUAcordaosWithVersioning(acordaos);

console.log(`Importados: ${result.novos} novos, ${result.atualizados} atualizados`);
```

### 2. Importação com Busca por Termo

```typescript
const acordaos = await fetchTCUAcordaos({
  quantidade: 100,
  anoInicio: 2023,
  anoFim: 2024,
  searchTerm: 'pregão eletrônico',
  onlyRelevant: true
});

const result = await importTCUAcordaosWithVersioning(acordaos);
```

### 3. Análise Manual de Relevância

```typescript
import { analyzeRelevanceTCU } from '@/lib/tcu-module';

const { isRelevant, score, temas } = analyzeRelevanceTCU(
  'Acórdão sobre licitação de obras',
  'Pregão eletrônico. Lei 14.133/2021. Registro de preços...'
);

console.log(`Relevante: ${isRelevant}, Score: ${score}`);
console.log(`Temas: ${temas.join(', ')}`);
```

### 4. Sugestão de Cursos

```typescript
import { suggestCoursesTCU } from '@/lib/tcu-module';

const cursos = suggestCoursesTCU(
  'Fiscalização de contratos',
  'Gestão contratual. Acompanhamento de contratos...'
);

console.log(`Cursos sugeridos: ${cursos.join(', ')}`); // ['1', '3']
```

---

## 📈 Estatísticas de Versionamento

### Consultar Histórico de um Acórdão

```typescript
const doc = await prisma.document.findFirst({
  where: {
    title: 'Acórdão 1234/2024 - TCU'
  },
  include: {
    versions: {
      orderBy: { versionNumber: 'desc' }
    }
  }
});

console.log(`Total de versões: ${doc.versions.length}`);

for (const version of doc.versions) {
  console.log(`
    Versão ${version.versionNumber}
    Tipo: ${version.changeType}
    Data: ${version.detectedAt}
    Mudanças: ${version.changesSummary}
  `);
}
```

### Consultar Acórdãos Atualizados Recentemente

```typescript
const recentUpdates = await prisma.documentVersion.findMany({
  where: {
    detectedBy: 'scraper-tcu',
    changeType: 'updated',
    detectedAt: {
      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Últimos 7 dias
    }
  },
  include: {
    document: true
  },
  orderBy: { detectedAt: 'desc' }
});

console.log(`${recentUpdates.length} acórdãos atualizados nos últimos 7 dias`);
```

---

## 🚀 Próximos Passos

### Fase 3: Automação Completa

1. **Cron Job Semanal**
   ```typescript
   // app/api/cron/tcu-scraper/route.ts
   export async function GET(request: Request) {
     // Verificar CRON_SECRET
     const acordaos = await fetchTCUAcordaos({
       quantidade: 500,
       anoInicio: new Date().getFullYear() - 1,
       onlyRelevant: true
     });

     const result = await importTCUAcordaosWithVersioning(acordaos);

     // Enviar notificação se houver novos ou atualizados
     if (result.novos > 0 || result.atualizados > 0) {
       await sendAdminNotification(result);
     }

     return Response.json(result);
   }
   ```

2. **Interface Admin para Versionamento**
   - Visualizar histórico de versões
   - Diff visual entre versões
   - Rollback para versão anterior

3. **Enriquecimento Automático**
   - Buscar PDF automaticamente se não disponível
   - Extrair texto do PDF
   - Gerar resumo com IA

4. **Integração com AGU**
   - Buscar pareceres da AGU relacionados ao acórdão
   - Criar links cruzados entre documentos
   - Timeline integrada TCU + AGU

---

## 📝 Resumo

**Sistema Atual (v2):**
- ✅ Keywords unificadas AGU + TCU
- ✅ Versionamento automático completo
- ✅ Detecção de mudanças com diff
- ✅ Análise de relevância automática
- ✅ Sugestão de cursos (10 cursos)
- ✅ Detecção de temas (13 temas)
- ✅ Sistema testado e funcional

**Benefícios:**
- 🎯 Consistência total com AGU Scraper v4
- 📊 Rastreamento completo de mudanças
- 🔄 Prevenção automática de duplicatas
- 📈 Estatísticas detalhadas de importação
- 🎓 Organização automática por curso
- 🏷️ Categorização por temas

**Arquivos Principais:**
- `lib/shared-keywords.ts` - Keywords unificadas
- `lib/tcu-module.ts` - Lógica de versionamento TCU
- `lib/tcu-scraper.ts` - Scraper da API do TCU
- `lib/agu-modules/versioning.ts` - Sistema de versionamento
- `scripts/test-tcu-with-versioning.ts` - Teste completo

---

**Última atualização:** 2025-11-02
**Versão:** 2.0
**Status:** ✅ Implementado e testável

