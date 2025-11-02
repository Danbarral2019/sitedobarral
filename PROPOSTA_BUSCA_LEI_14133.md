# Proposta: Sistema Avançado de Busca por Artigos da Lei 14.133/2021

## 🎯 Objetivo

Tornar a pesquisa por artigos da Lei 14.133 **intuitiva, visual e eficiente**, permitindo que alunos encontrem rapidamente materiais relacionados a artigos específicos ou temas da lei.

---

## 📋 Propostas de Melhorias (em ordem de prioridade)

### 🌟 PRIORIDADE ALTA - Quick Wins

#### 1. **Filtro Rápido de Artigos na Barra de Busca**

**Como funciona:**
- Campo de busca com **autocomplete** de artigos
- Digite "art 75" → mostra todos documentos sobre Art. 75
- Visual: chips/tags coloridas para cada artigo

**Implementação:**
```tsx
// Exemplo visual
┌─────────────────────────────────────────────┐
│ 🔍 Buscar por artigo da Lei 14.133...      │
│                                              │
│ Sugestões:                                   │
│ • Art. 75 - Dispensa de licitação           │
│ • Art. 28 - Planejamento da contratação     │
│ • Art. 174 - Sanções administrativas        │
└─────────────────────────────────────────────┘
```

**Benefícios:**
- ✅ Busca instantânea
- ✅ Aprende os artigos mais consultados
- ✅ Fácil de implementar (1-2 dias)

---

#### 2. **Navegador Visual da Lei (Estrutura em Árvore)**

**Como funciona:**
- Sidebar com estrutura hierárquica da Lei 14.133
- Expandir/colapsar seções (Títulos, Capítulos, Artigos)
- Contador de documentos por artigo

**Exemplo visual:**
```
📜 Lei 14.133/2021
  └─ 📖 TÍTULO I - Disposições Gerais
      └─ 📑 Capítulo I - Princípios
          • Art. 11 (3 documentos) 🔵
          • Art. 12 (7 documentos) 🔵
      └─ 📑 Capítulo II - Licitações
          • Art. 28 (12 documentos) 🟢
          • Art. 29 (5 documentos) 🔵
  └─ 📖 TÍTULO II - Licitações
      └─ 📑 Capítulo III - Dispensa
          • Art. 75 (28 documentos) 🟢
          • Art. 76 (15 documentos) 🟢
```

**Cores:**
- 🟢 Verde: Muito material (>10 docs)
- 🔵 Azul: Material médio (3-10 docs)
- ⚪ Cinza: Pouco material (<3 docs)

**Benefícios:**
- ✅ Visualização da estrutura completa da lei
- ✅ Identificar artigos com mais/menos material
- ✅ Navegação contextual

---

#### 3. **Tags/Badges de Artigos em Cada Documento**

**Como funciona:**
- Cada documento mostra **visualmente** quais artigos aborda
- Badges clicáveis que filtram por aquele artigo
- Cor diferente para artigo principal vs artigos relacionados

**Exemplo visual:**
```
┌────────────────────────────────────────────────┐
│ 📄 Dispensa de Licitação - Aspectos Práticos  │
│                                                │
│ 🏷️ Art. 75 (principal)  🏷️ Art. 76  🏷️ Art. 72 │
│                                                │
│ Categoria: Apostila | Tipo: PDF               │
└────────────────────────────────────────────────┘
```

**Benefícios:**
- ✅ Identificação visual rápida
- ✅ Descoberta de artigos relacionados
- ✅ Um clique para filtrar

---

### 🚀 PRIORIDADE MÉDIA - Features Avançadas

#### 4. **Página Dedicada: "Pesquisar por Artigos"**

**Localização:** `/artigos` ou `/lei-14133`

**Funcionalidades:**
1. **Mapa de Calor** dos artigos mais consultados
2. **Lista de todos os artigos** com preview
3. **Busca por número ou tema**
4. **Top 10 artigos mais estudados**

**Exemplo de layout:**
```
┌─────────────────────────────────────────────────────┐
│          🏛️ Lei 14.133/2021 - Navegação            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🔥 Artigos Mais Consultados                       │
│  ┌──────────────────────────────────────────┐     │
│  │ 1. Art. 75 - Dispensa (156 visualizações)│     │
│  │ 2. Art. 28 - Planejamento (142 vis.)     │     │
│  │ 3. Art. 174 - Sanções (128 vis.)         │     │
│  └──────────────────────────────────────────┘     │
│                                                     │
│  🔍 Buscar Artigo                                  │
│  ┌──────────────────────────────────────────┐     │
│  │ Digite o número ou tema... 🔎            │     │
│  └──────────────────────────────────────────┘     │
│                                                     │
│  📚 Por Tema                                       │
│  [Planejamento] [Dispensa] [Modalidades]          │
│  [Contratos] [Fiscalização] [Sanções]             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Benefícios:**
- ✅ Hub central para navegação por artigos
- ✅ Gamificação (artigos mais vistos)
- ✅ Orientação por temas

---

#### 5. **Agrupamento Temático de Artigos**

**Como funciona:**
- Criar "grupos" de artigos relacionados
- Ex: "Contratação Direta" = Arts. 72, 74, 75, 76, 77, 78, 79

**Exemplo de grupos:**
```
📦 Grupos Temáticos da Lei 14.133

🎯 Planejamento da Contratação
   Arts. 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29
   → 45 documentos relacionados

🎯 Contratação Direta (Dispensa e Inexigibilidade)
   Arts. 72, 74, 75, 76, 77, 78, 79
   → 78 documentos relacionados

🎯 Modalidades de Licitação
   Arts. 28, 29, 30, 31, 32, 33
   → 34 documentos relacionados

🎯 Fiscalização e Gestão Contratual
   Arts. 117, 118, 119, 140, 141
   → 56 documentos relacionados
```

**Benefícios:**
- ✅ Estudo contextualizado
- ✅ Descoberta de artigos relacionados
- ✅ Material agrupado por tema

---

#### 6. **Timeline/Linha do Tempo dos Artigos**

**Como funciona:**
- Visualizar documentos cronologicamente por artigo
- Ver evolução da jurisprudência/ONs/pareceres

**Exemplo:**
```
Art. 75 - Dispensa de Licitação
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2021 ●──────────────────────────────────────
     │ ON AGU 01/2021 - Primeira orientação

2022 ●──────────────────────────────────────
     │ Acórdão TCU 123/2022
     │ Parecer CONJUR 45/2022
     │ ON AGU 15/2022 - Atualização

2023 ●──────────────────────────────────────
     │ Acórdão TCU 456/2023
     │ ON AGU 27/2023

2024 ●──────────────────────────────────────
     │ ON AGU 38/2024 - Mais recente
```

**Benefícios:**
- ✅ Contexto histórico
- ✅ Ver evolução do entendimento
- ✅ Identificar material desatualizado

---

### 💎 PRIORIDADE BAIXA - Recursos Premium

#### 7. **IA: "Pergunte sobre o Artigo"**

**Como funciona:**
- Chatbot focado em artigos específicos
- "Quais os casos de dispensa do Art. 75?"
- Responde baseado nos documentos indexados

**Exemplo:**
```
┌────────────────────────────────────────┐
│ 🤖 Assistente do Art. 75               │
├────────────────────────────────────────┤
│ Você: Quais os principais casos?      │
│                                        │
│ 🤖: Baseado em 28 documentos sobre o  │
│     Art. 75, os principais casos são: │
│                                        │
│     1. Emergência ou calamidade       │
│     2. Valor até R$ 100 mil (obras)   │
│     3. Contratação de remanescente    │
│                                        │
│     📚 Ver documentos relacionados     │
└────────────────────────────────────────┘
```

**Benefícios:**
- ✅ Aprendizado interativo
- ✅ Respostas contextualizadas
- ✅ Diferencial competitivo

---

#### 8. **Mapa de Relacionamentos entre Artigos**

**Como funciona:**
- Grafo visual mostrando artigos relacionados
- Baseado em co-ocorrência nos documentos
- Identificar artigos que aparecem juntos

**Exemplo visual:**
```
          Art. 28 ●─────────● Art. 29
              │               │
              │               │
              └──● Art. 18 ●──┘
                     │
                  Art. 19
```

**Benefícios:**
- ✅ Visualização de conexões
- ✅ Estudo holístico da lei
- ✅ Descoberta de relações não óbvias

---

#### 9. **Comparador de Artigos**

**Como funciona:**
- Selecionar 2-3 artigos para comparar
- Ver materiais que abordam todos eles
- Tabela comparativa de características

**Exemplo:**
```
┌──────────────────────────────────────────────┐
│ Comparar Artigos                             │
├──────────────────────────────────────────────┤
│ Selecionados: Art. 75 | Art. 76 | Art. 74   │
│                                              │
│ 📄 Documentos que abordam todos (12):       │
│ • Apostila Contratação Direta               │
│ • ON AGU 05/2023 - Dispensa e Inexig.       │
│ • Parecer CONJUR 123/2024                   │
│                                              │
│ 📄 Somente Art. 75 (28 documentos)          │
│ 📄 Somente Art. 76 (15 documentos)          │
└──────────────────────────────────────────────┘
```

---

## 🎨 Melhorias de UX/UI Gerais

### A. **Cores por Seção da Lei**

- 🟦 Azul: Disposições Gerais (Arts. 1-17)
- 🟩 Verde: Licitações (Arts. 18-71)
- 🟨 Amarelo: Contratação Direta (Arts. 72-79)
- 🟧 Laranja: Contratos (Arts. 91-143)
- 🟥 Vermelho: Sanções (Arts. 155-163)

### B. **Ícones Contextuais**

- 📋 Planejamento
- 🏛️ Modalidades
- ⚡ Dispensa/Inexigibilidade
- 📝 Contratos
- 👁️ Fiscalização
- ⚖️ Sanções

### C. **Tooltips Informativos**

Ao passar o mouse sobre um artigo:
```
┌─────────────────────────────────┐
│ Art. 75 - Dispensa de Licitação│
│                                 │
│ 28 documentos disponíveis       │
│ • 12 Apostilas                  │
│ • 8 ONs AGU                     │
│ • 5 Acórdãos TCU                │
│ • 3 Pareceres                   │
│                                 │
│ 👁️ 156 visualizações este mês   │
│ 🔥 Artigo mais consultado        │
└─────────────────────────────────┘
```

---

## 🏗️ Plano de Implementação Sugerido

### Fase 1 - MVP (1-2 semanas)
✅ **Quick Wins de Alto Impacto**

1. **Filtro de artigos na busca** (2 dias)
   - Autocomplete simples
   - Busca por número de artigo

2. **Tags de artigos nos documentos** (1 dia)
   - Badges visuais
   - Clicáveis para filtrar

3. **Seção "Artigos Mais Consultados"** (1 dia)
   - Top 10 no dashboard
   - Analytics básico

### Fase 2 - Expansão (2-3 semanas)
📈 **Features Médias**

4. **Página dedicada /artigos** (3 dias)
   - Lista completa de artigos
   - Busca e filtros

5. **Navegador em árvore** (4 dias)
   - Estrutura hierárquica
   - Contadores de docs

6. **Grupos temáticos** (2 dias)
   - Criar grupos padrão
   - Interface de navegação

### Fase 3 - Diferenciação (1 mês)
🚀 **Features Avançadas**

7. **Timeline por artigo** (5 dias)
8. **IA assistente** (7 dias) - Requer API Claude
9. **Mapa de relacionamentos** (5 dias)

---

## 📊 Impacto Esperado

### Benefícios para os Alunos
- ✅ **Redução de 70%** no tempo de busca
- ✅ **Descoberta** de materiais relacionados
- ✅ **Aprendizado contextualizado** da lei
- ✅ **Navegação intuitiva** por temas

### Benefícios para Você
- ✅ **Diferencial competitivo** único
- ✅ **Valorização** do trabalho de indexação
- ✅ **Analytics** sobre artigos mais estudados
- ✅ **Feedback** para criar novos materiais

### Métricas de Sucesso
- Tempo médio de busca < 30 segundos
- Taxa de sucesso na busca > 90%
- Documentos por artigo acessados +50%
- NPS (satisfação) com busca > 9/10

---

## 💰 Estimativa de Esforço

| Prioridade | Feature | Tempo | Dificuldade |
|---|---|---|---|
| 🌟 Alta | Filtro artigos (autocomplete) | 2 dias | Média |
| 🌟 Alta | Tags nos documentos | 1 dia | Baixa |
| 🌟 Alta | Top artigos consultados | 1 dia | Baixa |
| 🚀 Média | Página /artigos | 3 dias | Média |
| 🚀 Média | Navegador árvore | 4 dias | Alta |
| 🚀 Média | Grupos temáticos | 2 dias | Média |
| 💎 Baixa | Timeline | 5 dias | Média |
| 💎 Baixa | IA Assistente | 7 dias | Alta |
| 💎 Baixa | Mapa relacionamentos | 5 dias | Alta |

**Total MVP (Fase 1):** ~4 dias
**Total Completo (Todas fases):** ~30 dias

---

## 🎯 Recomendação Final

**Comece com a Fase 1 (MVP):**

1. ✅ Filtro de artigos na busca
2. ✅ Tags visuais nos documentos
3. ✅ Top 10 artigos

**Motivo:**
- Maior impacto com menor esforço
- Valida a ideia com os alunos
- Pode implementar em 1 semana

Após validar com alunos reais, expanda para Fase 2 com base no feedback!

---

## 🤔 Próximos Passos

1. **Você decide:** Qual fase implementar primeiro?
2. **Priorizamos juntos:** Quais features são essenciais vs nice-to-have?
3. **Implementamos:** Posso começar agora mesmo pela Fase 1!

**Quer que eu implemente a Fase 1 (MVP) agora?**

São apenas 3 features mas com **impacto enorme** na experiência dos alunos! 🚀
