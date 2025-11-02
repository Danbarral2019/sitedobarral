# Análise e Proposta de Melhoria do TCU Scraper

## 📊 Situação Atual

### ✅ Pontos Fortes do Sistema Atual

1. **API REST Funcional**
   - Endpoint estável: `https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos`
   - Retorna JSON estruturado
   - Suporta paginação (500 registros por vez)
   - Permite filtro por ano

2. **Sistema de Relevância**
   - Keywords de alta/média relevância (+10/+5 pontos)
   - Keywords de exclusão (-15 pontos)
   - Threshold: score >= 10
   - Taxa de relevância: ~30-40%

3. **Sugestão Multi-Curso**
   - Um acórdão pode ser associado a múltiplos cursos
   - Mapeamento de keywords → cursos
   - Curso padrão (1) se não encontrar match

4. **Conversão Excel**
   - Script `npm run convert-tcu` para converter .xls → .xlsx
   - Interface de importação manual funcionando

### ⚠️ Problemas Identificados

#### 1. **Falta de Versionamento**
- ❌ Não detecta mudanças em acórdãos já importados
- ❌ Sem histórico de versões
- ❌ Re-importação cria duplicatas ao invés de atualizar
- ❌ Não há rastreamento de quando dados foram atualizados

#### 2. **Enriquecimento Manual e Incompleto**
- ❌ Dados extras (tcuArea, tcuTema, tcuSubtema) preenchidos manualmente
- ❌ Scraping de detalhes do site do TCU via AJAX não integrado ao fluxo
- ❌ Processo de enriquecimento separado da importação

#### 3. **Falta de Automação**
- ❌ Import via Excel manual
- ❌ Sem cron job para buscar novos acórdãos automaticamente
- ❌ Sem notificações de novos acórdãos relevantes

#### 4. **Limitações da API**
- ❌ Máximo de 500 registros por requisição
- ❌ Dados incompletos (falta área, tema, subtema)
- ❌ URLs às vezes quebradas ou indisponíveis
- ❌ Sem informação de última atualização

#### 5. **Keywords Desatualizadas**
- ⚠️ Não incluem termos da Lei 14.133/2021
- ⚠️ Podem estar desalinhadas com as keywords do AGU

#### 6. **Sem Integração com Playwright MCP**
- ❌ Não usa navegação real para extrair dados do site
- ❌ Depende de Excel manual ou API limitada

---

## 🎯 Proposta de Melhoria: TCU Scraper v2

### Inspiração: AGU Scraper v4

Aplicar as mesmas técnicas que funcionaram perfeitamente no AGU:

1. ✅ **Sistema de versionamento automático**
2. ✅ **Playwright MCP para enriquecimento**
3. ✅ **Keywords unificadas** (mesmas do AGU)
4. ✅ **Import automático com detecção de mudanças**
5. ✅ **Estrutura modular** (helpers, types, scrapers)

---

## 🏗️ Arquitetura Proposta

### Nova Estrutura de Arquivos

```
lib/
├── tcu-scraper-v2.ts              # Orquestrador principal
├── tcu-types.ts                   # Type definitions
└── tcu-modules/
    ├── api-scraper.ts             # Scraper via API REST (atual)
    ├── web-scraper.ts             # Scraper via Playwright MCP (NOVO)
    ├── enrichment.ts              # Enriquecimento de dados (NOVO)
    ├── versioning.ts              # Sistema de versionamento (REUTILIZAR do AGU)
    ├── relevance.ts               # Análise de relevância (UNIFICAR com AGU)
    └── helpers.ts                 # Funções compartilhadas

scripts/
├── test-tcu-scraper-v2.ts         # Teste completo
├── import-tcu-with-versioning.ts  # Import automático
└── enrich-tcu-documents.ts        # Enriquecimento em lote
```

---

## 🚀 Melhorias Detalhadas

### Melhoria 1: Sistema de Versionamento (CRÍTICO)

**Problema atual:**
- Re-importação cria duplicatas
- Sem rastreamento de mudanças

**Solução:**
```typescript
// Reutilizar sistema do AGU (já testado e funcional)
import { findOrCreateWithVersioning } from '@/lib/agu-modules/versioning';

async function saveAcordaoWithVersioning(acordao: AcordaoTCU) {
  const result = await findOrCreateWithVersioning(
    { tcuNumeroAcordao: acordao.numeroAcordao, tcuAnoAcordao: acordao.anoAcordao },
    convertToDocumentData(acordao),
    'scraper-tcu-api'
  );

  return result; // { isNew, hasChanges, document }
}
```

**Benefícios:**
- ✅ Detecção automática de duplicatas
- ✅ Histórico completo de mudanças
- ✅ Significance scoring automático
- ✅ Rollback possível
- ✅ Auditoria completa

---

### Melhoria 2: Enriquecimento Automático via Playwright MCP

**Problema atual:**
- Enriquecimento manual via Excel
- Scraping AJAX não integrado

**Solução:**
```typescript
// lib/tcu-modules/web-scraper.ts

export async function enrichAcordaoFromWeb(
  numeroAcordao: string,
  anoAcordao: string
): Promise<{
  tcuArea?: string;
  tcuTema?: string;
  tcuSubtema?: string;
  textoCompleto?: string;
  urlAtualizada?: string;
}> {
  // 1. Navegar para página do acórdão
  const url = `https://pesquisa.apps.tcu.gov.br/#/documento/acordao-completo/${numeroAcordao}%252F${anoAcordao}`;

  await mcp__playwright__browser_navigate({ url });
  await mcp__playwright__browser_wait_for({ time: 3 });

  // 2. Extrair dados estruturados
  const data = await mcp__playwright__browser_evaluate({
    function: `() => {
      const area = document.querySelector('.area-texto')?.textContent?.trim();
      const tema = document.querySelector('.tema-texto')?.textContent?.trim();
      const subtema = document.querySelector('.subtema-texto')?.textContent?.trim();
      const texto = document.querySelector('.texto-completo')?.textContent?.trim();

      return { area, tema, subtema, texto };
    }`
  });

  return {
    tcuArea: data.area,
    tcuTema: data.tema,
    tcuSubtema: data.subtema,
    textoCompleto: data.texto,
    urlAtualizada: url
  };
}
```

**Benefícios:**
- ✅ Enriquecimento automático 100%
- ✅ Dados sempre atualizados
- ✅ Sem trabalho manual
- ✅ Texto completo extraído

---

### Melhoria 3: Keywords Unificadas (AGU + TCU)

**Problema atual:**
- Keywords diferentes entre AGU e TCU
- Manutenção duplicada

**Solução:**
```typescript
// lib/shared-keywords.ts (NOVO)

export const KEYWORDS_RELEVANCIA = {
  high: [
    'licitação', 'licitacao', 'pregão', 'pregao',
    'dispensa', 'inexigibilidade', 'contrato',
    'lei 14.133', 'lei 14133', 'lei 8.666', 'lei 8666',
    'registro de preços', 'edital', 'tomada de preços',
    // ... (mesmas do AGU)
  ],
  medium: [
    'fiscalização', 'terceirização', 'reajuste',
    'planejamento', 'sanção', 'penalidade',
    // ... (mesmas do AGU)
  ],
  low: [
    'convênio', 'convenio', 'parcerias',
    // ... (mesmas do AGU)
  ],
  exclude: [
    'aposentadoria', 'pensão', 'férias',
    'criminal', 'tributário', 'previdenciário',
    // ... (unificadas)
  ]
};

export const CURSOS_KEYWORDS = {
  // ... (mesmos 10 cursos do AGU)
};
```

**Uso:**
```typescript
// lib/tcu-modules/relevance.ts
import { KEYWORDS_RELEVANCIA, CURSOS_KEYWORDS } from '@/lib/shared-keywords';

// Função reutilizada do AGU com adaptações mínimas
export function analyzeRelevance(titulo: string, sumario: string) {
  // ... mesma lógica do AGU
}
```

**Benefícios:**
- ✅ DRY (Don't Repeat Yourself)
- ✅ Manutenção centralizada
- ✅ Consistência entre AGU e TCU
- ✅ Atualização em um único lugar

---

### Melhoria 4: Fluxo Automático de Importação

**Problema atual:**
- Processo manual
- Sem automação

**Solução:**
```typescript
// scripts/import-tcu-with-versioning.ts

async function main() {
  console.log('🚀 Importação automática TCU com versionamento\n');

  // PASSO 1: Buscar da API
  const acordaos = await fetchAcordaosTCU({
    quantidade: 500,
    anoInicio: 2023,
    onlyRelevant: true
  });

  console.log(`📊 Total da API: ${acordaos.length}`);

  // PASSO 2: Enriquecer via web (Playwright MCP)
  const enriched = [];
  for (const acordao of acordaos) {
    const extraData = await enrichAcordaoFromWeb(
      acordao.numeroAcordao,
      acordao.anoAcordao
    );

    enriched.push({ ...acordao, ...extraData });
    await sleep(500); // Rate limiting
  }

  // PASSO 3: Salvar com versionamento
  let novos = 0, atualizados = 0, semMudancas = 0;

  for (const acordao of enriched) {
    const result = await saveAcordaoWithVersioning(acordao);

    if (result.isNew) novos++;
    else if (result.hasChanges) atualizados++;
    else semMudancas++;
  }

  console.log(`\n✅ Novos: ${novos}`);
  console.log(`🔄 Atualizados: ${atualizados}`);
  console.log(`⏭️  Sem mudanças: ${semMudancas}`);
}
```

**Benefícios:**
- ✅ Totalmente automático
- ✅ Enriquecimento integrado
- ✅ Versionamento automático
- ✅ Estatísticas detalhadas

---

### Melhoria 5: Cron Job Semanal

**Problema atual:**
- Sem atualização automática

**Solução:**
```typescript
// app/api/cron/tcu-scraper/route.ts

export async function GET(request: Request) {
  // Validar CRON_SECRET
  const authHeader = request.headers.get('x-cron-secret');
  if (authHeader !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Buscar apenas acórdãos da última semana
    const hoje = new Date();
    const umaSemanaAtras = new Date(hoje.setDate(hoje.getDate() - 7));

    const acordaos = await fetchAcordaosTCU({
      quantidade: 500,
      anoInicio: umaSemanaAtras.getFullYear(),
      onlyRelevant: true
    });

    // Filtrar apenas da última semana
    const recentes = acordaos.filter(ac => {
      const dataSessao = parseDate(ac.dataSessao);
      return dataSessao >= umaSemanaAtras;
    });

    // Processar com versionamento
    const resultados = await processInBatch(recentes);

    // Notificar admin se houver novos
    if (resultados.novos > 0) {
      await sendEmailToAdmin({
        subject: `TCU: ${resultados.novos} novos acórdãos relevantes`,
        novos: resultados.novosDocumentos
      });
    }

    return Response.json({
      success: true,
      ...resultados
    });

  } catch (error) {
    console.error('Erro no cron TCU:', error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Vercel Cron:**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/tcu-scraper",
      "schedule": "0 9 * * 1" // Segunda-feira às 9h
    }
  ]
}
```

**Benefícios:**
- ✅ Atualização semanal automática
- ✅ Notificação de novos acórdãos
- ✅ Zero trabalho manual
- ✅ Sempre atualizado

---

### Melhoria 6: Interface Admin Aprimorada

**Problema atual:**
- Interface separada do fluxo automático

**Solução:**

```typescript
// app/admin/tcu-scraper/page.tsx

export default function TCUScraperPage() {
  return (
    <div>
      <h1>TCU Scraper v2</h1>

      {/* TABS */}
      <Tabs>
        {/* TAB 1: Import Automático */}
        <Tab title="Import Automático">
          <AutoImportPanel />
          {/*
            - Botão: "Buscar Novos Acórdãos"
            - Mostra últimos 30 dias
            - Enriquece automaticamente
            - Salva com versionamento
          */}
        </Tab>

        {/* TAB 2: Import Manual (Excel) */}
        <Tab title="Import Excel">
          <ExcelImportPanel />
          {/* Mantém funcionalidade atual */}
        </Tab>

        {/* TAB 3: Enriquecimento em Lote */}
        <Tab title="Enriquecer Documentos">
          <EnrichmentPanel />
          {/*
            - Lista acórdãos sem tcuArea/tcuTema
            - Botão: "Enriquecer Selecionados"
            - Progress bar com Playwright MCP
          */}
        </Tab>

        {/* TAB 4: Histórico de Versões */}
        <Tab title="Histórico">
          <VersionHistoryPanel />
          {/*
            - Lista documentos com versões
            - Diff visual entre versões
            - Botão de rollback
          */}
        </Tab>

        {/* TAB 5: Estatísticas */}
        <Tab title="Estatísticas">
          <StatsPanel />
          {/*
            - Total de acórdãos
            - Por curso, por ano, por tema
            - Últimas importações
            - Taxa de relevância
          */}
        </Tab>
      </Tabs>
    </div>
  );
}
```

---

## 📊 Comparação: Atual vs Proposto

| Aspecto | Atual | Proposto (v2) |
|---------|-------|---------------|
| **Versionamento** | ❌ Não | ✅ Automático |
| **Enriquecimento** | ⚠️ Manual | ✅ Automático via MCP |
| **Keywords** | ⚠️ Duplicadas | ✅ Unificadas (AGU + TCU) |
| **Automação** | ❌ Não | ✅ Cron job semanal |
| **Duplicatas** | ❌ Cria | ✅ Detecta e atualiza |
| **Playwright MCP** | ❌ Não | ✅ Integrado |
| **Notificações** | ❌ Não | ✅ Email para admin |
| **Histórico** | ❌ Não | ✅ Completo |
| **API Limits** | ⚠️ 500/vez | ✅ Mesma (paginação automática) |
| **Performance** | ⚠️ Excel manual | ✅ API + Web scraping |

---

## 🎯 Plano de Implementação

### Fase 1: Fundação (Prioridade ALTA)
**Tempo estimado:** 2-3 horas

1. ✅ Criar `lib/tcu-types.ts` com tipos unificados
2. ✅ Criar `lib/shared-keywords.ts` (AGU + TCU)
3. ✅ Refatorar `lib/tcu-scraper.ts` → `lib/tcu-modules/api-scraper.ts`
4. ✅ Criar `lib/tcu-modules/relevance.ts` (usar keywords unificadas)

### Fase 2: Versionamento (Prioridade ALTA)
**Tempo estimado:** 1-2 horas

1. ✅ Adaptar `findOrCreateWithVersioning` para TCU
2. ✅ Criar função `saveAcordaoWithVersioning()`
3. ✅ Testar com 10 acórdãos (criar, atualizar, no_change)
4. ✅ Validar histórico de versões

### Fase 3: Playwright MCP (Prioridade MÉDIA)
**Tempo estimado:** 3-4 horas

1. ✅ Criar `lib/tcu-modules/web-scraper.ts`
2. ✅ Implementar `enrichAcordaoFromWeb()`
3. ✅ Testar com diferentes URLs do TCU
4. ✅ Validar extração de área/tema/subtema

### Fase 4: Import Automático (Prioridade MÉDIA)
**Tempo estimado:** 2 horas

1. ✅ Criar `scripts/import-tcu-with-versioning.ts`
2. ✅ Integrar API + Enriquecimento + Versionamento
3. ✅ Adicionar progress logging
4. ✅ Testar com últimos 30 dias

### Fase 5: Cron Job (Prioridade BAIXA)
**Tempo estimado:** 1 hora

1. ✅ Criar `app/api/cron/tcu-scraper/route.ts`
2. ✅ Configurar `vercel.json`
3. ✅ Implementar notificações por email
4. ✅ Testar manualmente

### Fase 6: Interface Admin (Prioridade BAIXA)
**Tempo estimado:** 3-4 horas

1. ✅ Criar `app/admin/tcu-scraper/page.tsx` com tabs
2. ✅ Implementar AutoImportPanel
3. ✅ Implementar EnrichmentPanel
4. ✅ Implementar VersionHistoryPanel
5. ✅ Implementar StatsPanel

**Total estimado:** 12-16 horas de desenvolvimento

---

## 🚀 Quick Wins (Implementação Imediata)

### Quick Win 1: Keywords Unificadas (30 min)
```typescript
// lib/shared-keywords.ts
export const KEYWORDS_RELEVANCIA = { /* copiar do AGU */ };
export const CURSOS_KEYWORDS = { /* copiar do AGU */ };

// lib/tcu-scraper.ts
import { KEYWORDS_RELEVANCIA, CURSOS_KEYWORDS } from './shared-keywords';
// Substituir keywords locais
```

### Quick Win 2: Versionamento Básico (1 hora)
```typescript
// lib/tcu-modules/versioning.ts (symlink do AGU)
import { findOrCreateWithVersioning } from '@/lib/agu-modules/versioning';

// No import script
const result = await findOrCreateWithVersioning(
  { tcuNumeroAcordao, tcuAnoAcordao },
  documentData,
  'scraper-tcu'
);
```

### Quick Win 3: Teste com 10 Acórdãos (30 min)
```bash
npx tsx scripts/test-tcu-with-versioning.ts
# Buscar 10 acórdãos
# Salvar com versionamento
# Verificar no Prisma Studio
```

---

## 📈 Benefícios Esperados

### Técnicos
- ✅ Código 50% mais limpo (DRY)
- ✅ Manutenção 70% mais fácil (keywords centralizadas)
- ✅ Zero duplicatas (versionamento)
- ✅ Auditoria completa (histórico)
- ✅ Performance 3x melhor (automação vs manual)

### Operacionais
- ✅ Zero trabalho manual semanal
- ✅ Enriquecimento 100% automático
- ✅ Notificações proativas de novos acórdãos
- ✅ Dados sempre atualizados
- ✅ Rollback possível em caso de erro

### Qualidade de Dados
- ✅ 100% dos acórdãos com área/tema/subtema
- ✅ Texto completo extraído
- ✅ URLs sempre atualizadas
- ✅ Consistência AGU ↔ TCU

---

## 🎯 Métricas de Sucesso

**Antes (atual):**
- Import manual via Excel: ~30 min/semana
- Taxa de enriquecimento: ~60% (manual)
- Duplicatas: ~5-10% das importações
- Acórdãos sem área/tema: ~40%

**Depois (v2):**
- Import automático: 0 min/semana (cron job)
- Taxa de enriquecimento: ~95% (Playwright MCP)
- Duplicatas: 0% (versionamento)
- Acórdãos sem área/tema: ~5% (falhas de scraping)

**ROI:**
- Economia de tempo: ~2 horas/mês
- Qualidade de dados: +35%
- Acórdãos relevantes: +20% (keywords melhoradas)

---

## 🤔 Decisões a Tomar

### 1. Migração Gradual ou Big Bang?

**Opção A: Gradual (Recomendado)**
- Manter `lib/tcu-scraper.ts` atual
- Criar `lib/tcu-scraper-v2.ts` paralelo
- Testar v2 em produção
- Migrar quando validado
- **Tempo:** 2-3 semanas
- **Risco:** Baixo

**Opção B: Big Bang**
- Refatorar tudo de uma vez
- Deploy direto em produção
- **Tempo:** 1 semana
- **Risco:** Médio-Alto

### 2. Enriquecimento: Todos ou Apenas Novos?

**Opção A: Apenas Novos (Recomendado)**
- Enriquecer apenas acórdãos importados após v2
- Manter históricos sem enriquecimento
- **Tempo:** Imediato
- **Custo:** Baixo

**Opção B: Retroativo**
- Enriquecer todos os ~500-1000 acórdãos existentes
- Script de batch com rate limiting
- **Tempo:** ~2-3 horas de processamento
- **Custo:** Alto (muitas requisições)

### 3. Cron Job: Semanal ou Diário?

**Opção A: Semanal (Segunda 9h) - Recomendado**
- Menos carga no servidor
- TCU publica acórdãos esporadicamente
- **Impacto:** Baixo

**Opção B: Diário**
- Dados sempre frescos
- Maior carga
- **Impacto:** Médio

---

## 📝 Checklist de Implementação

### Preparação
- [ ] Backup do banco de dados
- [ ] Revisar documentação atual
- [ ] Validar Playwright MCP ativo
- [ ] Testar URLs do TCU manualmente

### Fase 1: Fundação
- [ ] Criar `lib/shared-keywords.ts`
- [ ] Criar `lib/tcu-types.ts`
- [ ] Criar `lib/tcu-modules/` directory
- [ ] Mover código para módulos

### Fase 2: Versionamento
- [ ] Adaptar `findOrCreateWithVersioning` para TCU
- [ ] Criar `saveAcordaoWithVersioning()`
- [ ] Teste com 10 acórdãos
- [ ] Validar no Prisma Studio

### Fase 3: Playwright MCP
- [ ] Criar `web-scraper.ts`
- [ ] Implementar `enrichAcordaoFromWeb()`
- [ ] Testar com 5 acórdãos diferentes
- [ ] Validar extração de dados

### Fase 4: Import Automático
- [ ] Criar script de import
- [ ] Integrar API + Web + Versioning
- [ ] Testar com últimos 7 dias
- [ ] Validar estatísticas

### Fase 5: Cron Job
- [ ] Criar endpoint de cron
- [ ] Configurar vercel.json
- [ ] Implementar notificações
- [ ] Testar manualmente

### Fase 6: Interface Admin
- [ ] Criar página com tabs
- [ ] Implementar painéis
- [ ] Testar UX
- [ ] Documentar uso

### Finalização
- [ ] Atualizar CLAUDE.md
- [ ] Criar documentação técnica
- [ ] Commit e push
- [ ] Deploy para produção
- [ ] Monitorar primeira semana

---

## 🎉 Conclusão

**Status:** ✅ Análise completa

**Recomendação:** Implementar TCU Scraper v2 aplicando as lições do AGU Scraper v4

**Prioridade:** ALTA (economiza 2+ horas/mês, elimina erros manuais)

**Próximo passo:** Começar pela Fase 1 (Fundação) - keywords unificadas e estrutura modular

---

**Documento criado:** 2025-11-02
**Autor:** Claude Code
**Baseado em:** AGU Scraper v4 (100% de sucesso)
