# Plano de Refatoração: Sistema de Edição de Documentos + Centralidade Lei 14.133

**Data:** 20/11/2025
**Status:** Em implementação - Fase 1 em andamento

## 🎯 Visão Geral

Transformar o site de "repositório de documentos" para **"Lei 14.133 Comentada com documentos organizados por artigo"**. O wizard de edição facilitará a catalogação, e a interface de alunos navegará primariamente pela estrutura da lei.

---

## 📋 FASE 1: Backend - Campos e APIs (1h) ⏳ EM ANDAMENTO

### ✅ 1.1 Migração de Schema
- ✅ Migrar `content` → `summary` onde summary está vazio
- ✅ Script executado com sucesso

### ⏳ 1.2 Serviço de Enriquecimento com IA
**Arquivo:** `lib/ai/document-enhancer.ts`
- ✅ Criado serviço `enhanceDocumentWithAI()`
- ✅ Gera: summary, highlights, keyPoints, practicalUse, publicNotes, suggestedImportance, tags, leiArticles
- ✅ Usa Claude Sonnet 4 via Anthropic API

### 🔜 1.3 API de Enriquecimento
**Arquivo:** `app/api/admin/documents/[id]/enhance/route.ts`

**Endpoint:**
```typescript
POST /api/admin/documents/[id]/enhance

Response: {
  summary: string,
  highlights: string[],
  keyPoints: string[],
  practicalUse: string,
  publicNotes: string,
  suggestedImportance: 'alta',
  tags: string[],
  leiArticles: number[],
  confidence: 85,
  reasoning: string
}
```

### 🔜 1.4 API de Dashboard de Cobertura
**Arquivo:** `app/api/admin/analytics/lei-cobertura/route.ts`

**Endpoint:**
```typescript
GET /api/admin/analytics/lei-cobertura

Response: {
  totalArtigos: 195,
  artigosComDocumentos: 156,
  percentualCobertura: 80,
  artigosOrfaos: [ /* artigos SEM documentos */ ],
  artigosPoucos: [ /* artigos com < 3 docs */ ],
  distribuicaoPorTitulo: { /* estatísticas por TÍTULO */ }
}
```

---

## 📋 FASE 2: Admin - Wizard com Foco em Artigos (3h) 🔜 PENDENTE

### 2.1 Refatoração Completa do Formulário de Edição
**Arquivo:** `app/admin/documentos/[id]/edit/page.tsx`

**Wizard de 4 Etapas:**

#### STEP 1: Informações Básicas (30 segundos)
- Título*
- Descrição curta (3 linhas)
- Categoria* + Curso*
- □ Público  □ Comum
- Upload/URL*

#### STEP 2: Vinculação com Lei 14.133 ⭐ DESTAQUE
- [🤖 Analisar com IA] - Botão grande destacado
- ✨ IA sugere artigos COM JUSTIFICATIVA
- Estatísticas inline (quantos docs já existem)
- Badges: Popular 🔥, Carente ⚠️, Bem coberto ✅
- Alerta de artigos órfãos

#### STEP 3: Conteúdo Educacional (IA preenche)
- Resumo (gerado por IA, editável)
- Pontos-Chave (3-5, gerado por IA)
- Aplicação Prática (gerado por IA)
- Observações do Professor (gerado por IA)

#### STEP 4: Finalizar
- Importância (sugestão IA)
- Obs. Privadas
- Links de Referência
- [Preview: Como aluno verá]

### 2.2 Dashboard de Cobertura (Admin)
**Arquivo:** `app/admin/documentos/page.tsx` (adicionar widget)

**Widget acima da lista:**
```
📊 COBERTURA DA LEI 14.133/2021
████████████████░░░░ 80% (156/195 artigos)

🎯 Prioridades para catalogação:
• Art. 12 - Fases do processo (0 docs)
• Art. 45 - Comissão de licitação (0 docs)
• Art. 89 - Contratos de eficiência (0 docs)

[Ver Relatório Completo] [Exportar CSV]
```

### 2.3 Remover Modal de Observações Separado
- Deletar `components/DocumentNotesEditor.tsx`
- Remover botão "Observações" (ícone StickyNote)
- Todas observações agora no wizard

---

## 📋 FASE 3: Frontend Alunos - Hub "Lei Comentada" (4h) 🔜 PENDENTE

### 3.1 Página Central: `/area-restrita/lei-comentada`
**Arquivo:** `app/area-restrita/lei-comentada/page.tsx` (novo)

**Layout Desktop:**
```
┌──────────────┬──────────────────────────────────────────┐
│ 📚 ESTRUTURA │  🔍 [Buscar artigo ou tema...]           │
│              │  Cobertura: 156/195 (80%) • 1,245 docs  │
│ ▼ TÍTULO I   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   ▼ Cap I    │  ▼ Art. 75 - Planejamento                │
│     • Art 1  │     [Texto completo do artigo...]         │
│     • Art 2  │     📄 12 documentos relacionados:       │
│   ▶ Cap II   │     • ON 1/2024 - AGU [Ver] [⭐]        │
│ ▶ TÍTULO II  │     • Acórdão 1234/2024 - TCU           │
└──────────────┴──────────────────────────────────────────┘
```

**Features:**
- Auto-scroll para artigo (URL: `/lei-comentada?artigo=75`)
- Expansão progressiva (carregar docs sob demanda)
- Busca em tempo real
- Filtro: "Somente artigos com documentos"
- Estatísticas de cobertura

### 3.2 Widget "Explorar Lei 14.133" (Home Área Restrita)
**Arquivo:** `app/area-restrita/page.tsx`

**Posição:** Após banner de status, antes de "Meus Documentos"

```
📚 EXPLORAR LEI 14.133 COMENTADA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🥇 Art. 75 - Planejamento
   156 documentos • 1.2k visualizações

🥈 Art. 6 - Princípios
   89 documentos • 950 visualizações

🥉 Art. 18 - Pesquisa de Preços
   67 documentos • 780 visualizações

[Navegar pela Lei Completa →]
```

### 3.3 Modal de Detalhes - Contexto da Lei
**Arquivo:** `components/DocumentDetailModal.tsx`

**Adicionar seções:**
1. Breadcrumb da Lei (ex: "Lei 14.133 > Art. 75")
2. Resumo IA (bg gradient azul-indigo)
3. Pontos-Chave (bullets com ícone Target)
4. Aplicação Prática (bg verde)
5. Observações do Prof. Barral (bg âmbar, itálico)

### 3.4 Breadcrumbs Contextuais
**Quando aluno filtra por artigo:**
```
Área Restrita > Lei 14.133 > Art. 75 - Planejamento > 12 documentos
```

**Quando navega pela lei comentada:**
```
Área Restrita > Lei 14.133 Comentada > TÍTULO IV > CAPÍTULO I > Art. 75
```

---

## 📋 FASE 4: Analytics & Métricas (1h) 🔜 PENDENTE

### 4.1 Tracking de Uso
**Arquivo:** `lib/analytics/lei-tracking.ts` (novo)

**Eventos:**
- `lei_comentada_view` (artigo visitado)
- `documento_via_artigo` (doc acessado via artigo)
- `artigo_expandido` (artigo expandido na lei comentada)

### 4.2 Relatório para Admin
**Arquivo:** `app/admin/analytics/lei-14133/page.tsx` (novo)

**Métricas:**
- % de documentos acessados via artigo (vs. busca/categoria)
- Artigos mais visitados (top 20)
- Artigos órfãos mais visitados (indicando demanda)
- Tempo médio na página "Lei Comentada"
- Taxa de conversão: visita artigo → download documento

**Meta:** 60% dos acessos iniciarem pela estrutura da lei

---

## 📋 FASE 5: Melhorias Visuais & UX (2h) 🔜 PENDENTE

### 5.1 Indicadores Visuais de Cobertura
**Componente:** `ArticleTreeNavigator` (atualizar)

**Cores:**
- Verde escuro (≥15 docs): "Muito bem coberto" ✅
- Verde claro (10-14 docs): "Bem coberto" ✅
- Azul (5-9 docs): "Cobertura média" 📘
- Laranja (1-4 docs): "Carente" ⚠️
- Cinza (0 docs): "Órfão" 🚫

### 5.2 Preview no Wizard
**Step 4 do wizard:**
- Modal renderiza `DocumentDetailModal` com dados do formulário
- Permite testar antes de salvar

### 5.3 Atalhos de Teclado
```
Ctrl + K: Buscar artigo
Ctrl + L: Ir para Lei Comentada
Ctrl + Enter: Próximo step no wizard
Ctrl + S: Salvar rascunho
```

---

## ✅ Checklist de Implementação (Total: ~12-15 horas)

### FASE 1: Backend (1h) ⏳
- [x] Migração SQL: content → summary
- [x] Serviço de enriquecimento IA (`lib/ai/document-enhancer.ts`)
- [ ] API `/api/admin/documents/[id]/enhance`
- [ ] API `/api/admin/analytics/lei-cobertura`

### FASE 2: Admin (3h) 🔜
- [ ] Wizard Step 1: Info básica
- [ ] Wizard Step 2: Artigos Lei 14.133 (DESTAQUE)
- [ ] Wizard Step 3: Conteúdo educacional (IA)
- [ ] Wizard Step 4: Finalizar + preview
- [ ] Dashboard de cobertura (widget)
- [ ] Deletar `DocumentNotesEditor.tsx`

### FASE 3: Alunos (4h) 🔜
- [ ] Página `/area-restrita/lei-comentada`
- [ ] Componente `ArticleWithDocuments`
- [ ] Widget "Explorar Lei 14.133" (home)
- [ ] Modal: breadcrumb + novos campos
- [ ] Breadcrumbs contextuais

### FASE 4: Analytics (1h) 🔜
- [ ] Tracking de eventos
- [ ] Relatório `/admin/analytics/lei-14133`

### FASE 5: UX (2h) 🔜
- [ ] Cores de cobertura atualizadas
- [ ] Preview no wizard
- [ ] Atalhos de teclado

### Testes (2h) 🔜
- [ ] Criar documento novo via wizard
- [ ] Editar documento existente
- [ ] Navegar por lei comentada (desktop + mobile)
- [ ] Filtrar docs por artigo
- [ ] Preview antes de salvar
- [ ] Gerar enriquecimento IA

### Deploy (1h) 🔜
- [ ] Verificar 195 artigos intactos
- [ ] Deploy produção
- [ ] Monitorar analytics primeiros dias

---

## 🎯 Resultados Esperados

### Para o Admin:
- ⏱️ **Catalogação 70% mais rápida** (IA preenche campos)
- 📊 **Visibilidade de gaps** (artigos órfãos destacados)
- 🎯 **Priorização clara** (onde focar esforço)

### Para os Alunos:
- 🗺️ **Navegação intuitiva** (estrutura da lei como mapa)
- 📚 **Descoberta eficiente** (156 artigos com docs organizados)
- 🎓 **Conteúdo rico** (resumo + pontos-chave + observações)
- 🔗 **Contexto claro** (breadcrumbs mostram onde está na lei)

### Métricas de Sucesso:
- **60%** dos acessos via estrutura da lei
- **Cobertura 90%+** da lei em 6 meses
- **Tempo na página +150%**
- **Downloads +40%**

---

## 📝 Notas de Implementação

### Decisões Técnicas:
1. **Campo `content` deprecado:** Migrado para `summary`, mantido no schema por compatibilidade
2. **IA sugere artigos:** Claude Sonnet 4 analisa conteúdo e sugere artigos 1-194 com justificativa
3. **Wizard multi-step:** 4 etapas com navegação fluida, Step 2 dedicado exclusivamente aos artigos
4. **Componentes reutilizados:** `ArticleTreeNavigator`, `DocumentsByCategory`, `TopArticlesWidget`

### Considerações de Performance:
- Expansão progressiva na lei comentada (lazy loading de documentos)
- Cache de cobertura da lei (atualizar a cada 5min)
- Busca de artigos client-side (195 artigos é pequeno)

### API Keys Necessárias:
- ✅ `ANTHROPIC_API_KEY` - Para Claude Sonnet (enriquecimento IA)

---

**Última atualização:** 20/11/2025 18:45
**Próximo passo:** Implementar APIs de enriquecimento e cobertura (Fase 1.3 e 1.4)
