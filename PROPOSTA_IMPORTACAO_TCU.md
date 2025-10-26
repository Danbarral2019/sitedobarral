# 🏛️ Proposta: Sistema de Importação de Acórdãos do TCU

## 📋 Análise do Webservice

### Endpoint Disponível
```
GET https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos?inicio={inicio}&quantidade={quantidade}
```

### Estrutura de Dados (Resposta)
```json
[
  {
    "key": "12345",
    "tipo": "Acórdão",
    "anoAcordao": "2024",
    "titulo": "Licitação - Pregão Eletrônico",
    "numeroAcordao": "1234",
    "colegiado": "Plenário",
    "dataSessao": "15/10/2024",
    "relator": "Ministro João Silva",
    "situacao": "Publicado",
    "sumario": "Licitação. Pregão eletrônico. Sistema de Registro de Preços...",
    "urlArquivo": "https://...",
    "urlArquivoPDF": "https://...acordao-1234-2024.pdf",
    "urlAcordao": "https://..."
  }
]
```

---

## 🎯 Proposta de Solução

### 1. Mapeamento para Nosso Sistema

| Campo TCU | Campo Sistema | Transformação |
|-----------|---------------|---------------|
| `numeroAcordao` + `anoAcordao` | `title` | "Acórdão TCU {numero}/{ano} - {titulo}" |
| `sumario` | `description` | Direto (pode ter 500+ caracteres) |
| `urlArquivoPDF` | `url` | PDF preferencial |
| - | `type` | 'pdf' ou 'link' |
| - | `category` | **'acordao'** (já existe!) |
| - | `isPublic` | `true` (acórdãos são públicos) |
| `tipo`, `colegiado`, `relator`, `anoAcordao` | `tags` | Array: ["TCU", "2024", "Plenário", "Min. Silva"] |
| **Classificação automática** | `courseId` | Via análise semântica do sumário |

---

## 🤖 Sistema de Classificação Inteligente

### Problema Principal
**Não podemos importar TODOS os acórdãos do TCU!**
- TCU publica centenas/milhares de acórdãos por ano
- Muitos não são relevantes para licitações/contratos
- Exemplos irrelevantes: aposentadorias, pensões, convênios genéricos

### Solução Proposta: Filtragem Dupla

#### 1️⃣ **Filtro de Relevância** (Pré-classificação)

Acórdão é **relevante** se o sumário contém:

```typescript
const palavrasChaveRelevancia = [
  // Licitação
  'licitação', 'licitacao', 'pregão', 'pregao', 'tomada de preços',
  'concorrência', 'concorrencia', 'registro de preços', 'edital',
  'lei 14.133', 'lei 8.666', 'dispensa', 'inexigibilidade',

  // Contratos
  'contrato', 'contratação', 'contratacao', 'gestão contratual',
  'fiscalização', 'fiscalizacao', 'acompanhamento contratual',

  // Sanções
  'sanção', 'sancao', 'penalidade', 'multa', 'impedimento',
  'declaração de inidoneidade',

  // Planejamento
  'planejamento', 'estudo técnico preliminar', 'ETP', 'DFD',
  'termo de referência', 'projeto básico',

  // Terceirização
  'terceirização', 'tercerizacao', 'mão de obra', 'dedicação exclusiva',
  'formação de preços', 'planilha de custos',

  // Outros
  'alteração contratual', 'reajuste', 'repactuação', 'equilíbrio econômico',
  'BDI', 'orçamento', 'sobrepreço'
];
```

**Taxa de filtragem esperada:**
- Total de acórdãos TCU: ~10.000/ano
- Relevantes para licitações/contratos: ~2.000/ano (20%)
- **Redução de 80% no volume!**

#### 2️⃣ **Classificação por Curso** (Sistema em 2 camadas)

**Para acórdãos relevantes**, classificar por curso:

```typescript
// Camada 1: Análise Básica (rápida)
const classification = classifyDocumentSync(
  `Acórdão TCU ${numero}/${ano} - ${titulo}`,
  sumario
);

// Se confiança < 50%, usa Camada 2
if (classification.confidence < 50) {
  const enhanced = await classifyWithClaude(titulo, sumario);
  // Claude analisa contexto e determina cursos relevantes
}
```

**Mapeamento de temas → cursos:**

| Tema Identificado | Curso Sugerido |
|-------------------|----------------|
| "pregão eletrônico", "sistema de registro de preços" | Nova Lei de Licitações |
| "planejamento", "estudo técnico", "ETP" | Planejamento das Contratações |
| "gestão contratual", "fiscalização" | Gestão e Fiscalização de Contratos |
| "sanção", "penalidade", "multa" | Processo Sancionador |
| "dispensa", "inexigibilidade" | Contratação Direta |
| "terceirização", "mão de obra" | Terceirização e Formação de Preços |
| "reajuste", "repactuação", "equilíbrio" | Revisão, Reajuste e Repactuação |
| "alteração contratual", "aditivo" | Alterações Contratuais |

---

## 🚀 Funcionalidades Propostas

### 1. **Importação Incremental** (como AGU)

```
Primeira importação:
→ Busca últimos 500 acórdãos
→ Filtra relevantes (~100)
→ Classifica por curso
→ Importa para cursos relevantes

Atualizações mensais:
→ Busca últimos 100 acórdãos
→ Detecta novos (por numero+ano)
→ Filtra relevantes (~20)
→ Importa apenas novos
```

### 2. **Filtros Avançados na Interface**

```
┌─────────────────────────────────────────┐
│ Filtros de Importação                   │
├─────────────────────────────────────────┤
│ □ Ano: [2024] [2023] [2022] [Todos]    │
│ □ Tipo: [Acórdão] [Decisão] [Todos]    │
│ □ Colegiado: [Plenário] [1ª Câmara]... │
│ □ Apenas relevantes para licitações    │
│ ☑ Quantidade: [100] (máx: 500)          │
└─────────────────────────────────────────┘
```

### 3. **Preview com Análise de Relevância**

```
┌────────────────────────────────────────────┐
│ Acórdão 1234/2024 - Plenário              │
│ ✅ RELEVANTE (95% confiança)               │
│ 📚 Cursos: Nova Lei | Gestão Contratos    │
│                                            │
│ Sumário: Licitação. Pregão eletrônico...  │
│ Tags: TCU, 2024, Plenário, Licitação      │
│ PDF: ✓ Disponível                         │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ Acórdão 5678/2024 - 2ª Câmara             │
│ ⚠️ IRRELEVANTE (pensão civil)              │
│ ❌ Não será importado                      │
└────────────────────────────────────────────┘
```

### 4. **Estatísticas Detalhadas**

```
┌──────────────────────────────────────────┐
│ 500 acórdãos analisados                  │
├────────────────────┬─────────────────────┤
│ ✅ 95 relevantes   │ 🎯 Multi-curso: 25  │
│ ❌ 405 irrelevantes│ 📄 PDFs: 95/95      │
└────────────────────┴─────────────────────┘

Distribuição por curso:
Nova Lei de Licitações: 45 acórdãos
Gestão e Fiscalização: 38 acórdãos
Processo Sancionador: 22 acórdãos
...
```

---

## 💻 Implementação Técnica

### Estrutura de Arquivos

```
lib/
  tcu-scraper.ts         # Scraper do webservice TCU
  tcu-classifier.ts      # Classificador específico TCU

app/api/admin/tcu-import/
  route.ts               # API GET (preview) e POST (import)

app/admin/tcu-import/
  page.tsx               # Interface de importação

scripts/
  test-tcu-scraper.ts    # Script de teste
```

### Fluxo de Dados

```typescript
// 1. Buscar acórdãos do TCU (paginado)
const acordaos = await fetchAcordaosTCU({
  inicio: 0,
  quantidade: 100,
  anoInicio: 2024
});

// 2. Filtrar por relevância
const relevantes = acordaos.filter(ac =>
  isRelevantForLicitacoes(ac.sumario, ac.titulo)
);

// 3. Classificar por curso
const classified = await Promise.all(
  relevantes.map(ac => classifyAcordao(ac))
);

// 4. Detectar novos
const novos = await detectarNovosAcordaos(classified);

// 5. Importar para cursos relevantes
for (const acordao of novos) {
  for (const courseId of acordao.cursos) {
    await addDocument(courseId, {
      title: `Acórdão TCU ${acordao.numero}/${acordao.ano}`,
      description: acordao.sumario,
      type: 'pdf',
      category: 'acordao',
      url: acordao.urlArquivoPDF,
      tags: [
        'TCU',
        acordao.anoAcordao,
        acordao.colegiado,
        acordao.tipo,
        ...acordao.palavrasChave
      ],
      isPublic: true
    });
  }
}
```

---

## 🎛️ Interface do Usuário

### Tela Principal: `/admin/tcu-import`

```
┌──────────────────────────────────────────────────┐
│ 🏛️ Importação de Acórdãos do TCU                 │
├──────────────────────────────────────────────────┤
│                                                  │
│ ┌─────────────────┐  ┌─────────────────┐        │
│ │ 1. Configurar   │  │ 2. Preview      │        │
│ │                 │  │                 │        │
│ │ □ Ano: 2024     │  │ [Carregar]      │        │
│ │ □ Qtd: 100      │  │                 │        │
│ │ ☑ Só relevantes │  │                 │        │
│ └─────────────────┘  └─────────────────┘        │
│                                                  │
│ ┌──────────────────────────────────────┐        │
│ │ 3. Modo de Importação                │        │
│ │ ○ Incremental (novas apenas)         │        │
│ │ ○ Completo (todas do período)        │        │
│ │                                      │        │
│ │ [Importar 23 acórdãos novos]        │        │
│ └──────────────────────────────────────┘        │
└──────────────────────────────────────────────────┘
```

### Preview Detalhado

```
┌──────────────────────────────────────────────────┐
│ Preview: 100 acórdãos analisados                 │
│ 23 relevantes | 77 irrelevantes                  │
├──────────────────────────────────────────────────┤
│                                                  │
│ ✅ Acórdão 1234/2024 - Plenário   [✨ NOVO]     │
│ 📚 3 cursos: Nova Lei | Gestão | Sancionador     │
│ Licitação. Pregão eletrônico. Sistema de...     │
│ [Ver PDF] [Ver detalhes]                         │
│                                                  │
│ ✅ Acórdão 1235/2024 - 1ª Câmara  [✓ JÁ IMP.]   │
│ 📚 1 curso: Contratação Direta                   │
│ Dispensa de licitação. Contratação emergencial  │
│                                                  │
│ ❌ Acórdão 1236/2024 - 2ª Câmara  [IRRELEVANTE]  │
│ Aposentadoria. Pensão civil. Não relacionado...  │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 📈 Volumetria Estimada

### Cenário Conservador (2024)

```
Total TCU 2024: ~10.000 acórdãos
↓ Filtro de relevância (20%)
2.000 acórdãos relevantes
↓ Média de 2 cursos por acórdão
4.000 documentos no total
```

### Primeira Importação (últimos 500)

```
Busca: 500 acórdãos
↓ Filtro (20%)
100 relevantes
↓ Média 2 cursos
200 documentos criados
Tempo: ~30-60 segundos
```

### Atualizações Mensais (últimos 100)

```
Busca: 100 acórdãos novos
↓ Filtro (20%)
20 relevantes
↓ Detecção de novos (assume 15 realmente novos)
15 novos × 2 cursos = 30 documentos
Tempo: ~5-10 segundos
```

---

## ⚠️ Considerações e Desafios

### 1. Volume de Dados
**Problema:** TCU tem milhares de acórdãos históricos

**Solução:**
- Limitar importação inicial aos últimos 2-3 anos
- Permitir importação histórica sob demanda
- Filtro de relevância agressivo

### 2. Qualidade da Classificação
**Problema:** Sumários podem ser genéricos

**Solução:**
- Usar Claude AI para análise semântica
- Revisar classificação em batch (admin aprova)
- Sistema de feedback (admin pode reclassificar)

### 3. Manutenção de Links
**Problema:** URLs do TCU podem mudar

**Solução:**
- Armazenar também o `key` do acórdão
- Permitir re-sincronização de URLs
- Baixar PDFs localmente (opcional)

### 4. Performance
**Problema:** Analisar 500 acórdãos pode ser lento

**Solução:**
- Processar em lotes de 50
- Usar análise básica primeiro (rápida)
- Claude AI apenas para casos ambíguos
- Cache de classificações

---

## 🎯 Plano de Implementação

### Fase 1: MVP (Mínimo Viável)
- [x] Scraper básico do TCU
- [ ] Filtro de relevância simples
- [ ] Classificação automática (básica)
- [ ] Interface de importação
- [ ] Modo incremental

**Tempo estimado:** 4-6 horas

### Fase 2: Melhorias
- [ ] Classificação com Claude AI
- [ ] Filtros avançados (ano, colegiado, etc.)
- [ ] Preview detalhado com aprovação
- [ ] Download local de PDFs
- [ ] Sistema de feedback

**Tempo estimado:** 3-4 horas

### Fase 3: Otimizações
- [ ] Cache de classificações
- [ ] Processamento em background
- [ ] Estatísticas avançadas
- [ ] Re-sincronização de URLs
- [ ] Exportação de relatórios

**Tempo estimado:** 2-3 horas

---

## 📊 Comparação: TCU vs AGU

| Característica | AGU (ONs) | TCU (Acórdãos) |
|----------------|-----------|----------------|
| **Volume** | ~100 ONs/total | ~10.000 acórdãos/ano |
| **Frequência** | Mensal (~3-5 novas) | Semanal (~20-50 novos) |
| **Relevância** | 100% relevante | ~20% relevante |
| **Classificação** | Simples (todas vão para todos) | Complexa (multi-curso seletivo) |
| **Filtros** | Não necessário | **Essencial** |
| **Primeira Importação** | ~1.280 docs (97×128×10) | ~200 docs (100 relevantes×2 cursos) |
| **Atualização Mensal** | ~30-50 docs | ~30-40 docs |

---

## ✅ Recomendação Final

**IMPLEMENTAR COM FILTROS RIGOROSOS**

1. **Começar conservador:**
   - Importar apenas últimos 500 acórdãos
   - Filtro de relevância ativo por padrão
   - Análise manual do preview antes de importar

2. **Expandir gradualmente:**
   - Após validação da qualidade
   - Importar mais acórdãos históricos
   - Ajustar filtros conforme necessário

3. **Monitorar qualidade:**
   - Feedback de alunos sobre relevância
   - Estatísticas de acesso
   - Ajustar classificador

---

## 🚀 Próximos Passos

Quer que eu implemente?

**Opção A: MVP Rápido (4h)**
- Importação básica
- Filtro de relevância
- Modo incremental

**Opção B: Versão Completa (10-12h)**
- Tudo do MVP +
- Claude AI
- Filtros avançados
- Preview com aprovação

**Opção C: Análise Adicional**
- Teste do webservice primeiro
- Validar qualidade dos dados
- Prototipar classificação

---

**Qual caminho prefere?** 🤔
