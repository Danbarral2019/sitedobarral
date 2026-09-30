# Guia de Alimentação - FAQ e Glossário

> **Criado em:** 2025-11-01
> **Status do Sistema:** Backend completo ✅ | Interface Admin pendente ⚠️

---

## 📋 Situação Atual

O sistema de **FAQ** e **Glossário** possui:

✅ **Backend Completo:**
- Modelos no Prisma (`FAQ`, `GlossaryTerm`)
- APIs REST completas (GET, POST, PUT, DELETE)
- Sistema de busca e filtros
- Analytics de visualizações e feedback
- Páginas públicas funcionando (`/faq`, `/glossario`, `/glossario/[slug]`)

⚠️ **Interface Admin Ausente:**
- Não existe painel admin para gerenciar FAQ
- Não existe painel admin para gerenciar Glossário
- Precisa alimentar via Prisma Studio ou API diretamente

---

## 🎯 Opções para Alimentação

### Opção 1: Prisma Studio (Mais Rápida - Recomendada Agora)

**Vantagens:**
- ✅ Disponível imediatamente
- ✅ Interface gráfica simples
- ✅ Ideal para quantidade pequena/média de dados

**Como usar:**

```bash
# Na pasta do projeto
cd "C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral"

# Abrir Prisma Studio
npx prisma studio
```

Isso abrirá o navegador em `http://localhost:5555` com interface para gerenciar o banco.

#### Alimentar FAQ:

1. No Prisma Studio, clique em **"FAQ"** no menu lateral
2. Clique em **"Add record"**
3. Preencha os campos:
   - **question:** Pergunta (ex: "Como posso baixar os materiais do curso?")
   - **answer:** Resposta completa em Markdown
   - **category:** Categoria (ex: "acesso", "curso", "certificado", "pagamento", "suporte")
   - **order:** Ordem de exibição (número - quanto menor, mais no topo)
   - **isPublished:** `true` para visível, `false` para rascunho
   - **tags:** JSON array - ex: `["download", "materiais"]`
   - **relatedDocuments:** (opcional) JSON array de IDs de documentos relacionados
   - **relatedTerms:** (opcional) JSON array de slugs de termos do glossário
4. Clique em **"Save 1 change"**

**Exemplo de registro FAQ:**
```json
{
  "question": "Como posso baixar os materiais do curso?",
  "answer": "Para baixar os materiais:\n\n1. Faça login na [área restrita](/area-restrita)\n2. Selecione o curso desejado no filtro\n3. Clique no botão de download ao lado do documento\n\nSeus downloads são registrados no [histórico](/area-restrita/historico).",
  "category": "acesso",
  "order": 1,
  "isPublished": true,
  "tags": ["download", "materiais", "pdf"],
  "relatedDocuments": [],
  "relatedTerms": ["area-restrita"]
}
```

#### Alimentar Glossário:

1. No Prisma Studio, clique em **"GlossaryTerm"** no menu lateral
2. Clique em **"Add record"**
3. Preencha os campos:
   - **term:** Termo (ex: "Dispensa de Licitação")
   - **slug:** URL amigável (ex: "dispensa-de-licitacao")
   - **shortDef:** Definição curta (1 frase)
   - **longDef:** Definição completa em Markdown
   - **category:** Categoria (ex: "licitacao", "contrato", "fiscalizacao")
   - **tags:** JSON array - ex: `["lei-14133", "contratacao-direta"]`
   - **order:** Ordem alfabética (número)
   - **isPublished:** `true` para visível
   - **relatedDocuments:** (opcional) JSON array de IDs de documentos
   - **relatedTerms:** (opcional) JSON array de slugs de outros termos
   - **legalBasis:** (opcional) Base legal (ex: "Art. 75, Lei 14.133/2021")
4. Clique em **"Save 1 change"**

**Exemplo de registro Glossário:**
```json
{
  "term": "Dispensa de Licitação",
  "slug": "dispensa-de-licitacao",
  "shortDef": "Contratação direta sem licitação nas hipóteses previstas em lei.",
  "longDef": "A dispensa de licitação é uma das modalidades de **contratação direta** prevista na Lei 14.133/2021.\n\nOcorre quando a licitação é **possível juridicamente**, mas a lei autoriza não realizá-la em situações específicas, como:\n\n- Pequeno valor (até R$ 50 mil para obras e R$ 100 mil para compras)\n- Emergência ou calamidade pública\n- Guerra ou grave perturbação da ordem\n- Deserto ou fracassado por 3 vezes\n\nVer também: [Inexigibilidade de Licitação](/glossario/inexigibilidade-licitacao)",
  "category": "licitacao",
  "tags": ["contratacao-direta", "lei-14133", "dispensa"],
  "order": 10,
  "isPublished": true,
  "legalBasis": "Art. 75, Lei 14.133/2021",
  "relatedDocuments": [],
  "relatedTerms": ["inexigibilidade-licitacao", "contratacao-direta"]
}
```

---

### Opção 2: API REST Direta (Para Scripts/Importação em Massa)

**Vantagens:**
- ✅ Ideal para importar muitos registros de uma vez
- ✅ Pode ser usado em scripts automatizados
- ✅ Validação de dados automática

**Como usar:**

#### Criar FAQ via API:

```bash
curl -X POST http://localhost:3000/api/admin/faq \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=SEU_TOKEN_ADMIN" \
  -d '{
    "question": "Qual a diferença entre dispensa e inexigibilidade?",
    "answer": "**Dispensa:** Licitação é possível, mas a lei permite não realizar.\n\n**Inexigibilidade:** Licitação é impossível por inviabilidade de competição.",
    "category": "curso",
    "order": 5,
    "isPublished": true,
    "tags": ["licitacao", "conceitos"]
  }'
```

#### Criar Termo do Glossário via API:

```bash
curl -X POST http://localhost:3000/api/admin/glossary \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=SEU_TOKEN_ADMIN" \
  -d '{
    "term": "Estudo Técnico Preliminar",
    "slug": "estudo-tecnico-preliminar",
    "shortDef": "Documento técnico que fundamenta o planejamento da contratação.",
    "longDef": "O ETP é obrigatório para todas as contratações...",
    "category": "planejamento",
    "legalBasis": "Art. 18, §1º, Lei 14.133/2021",
    "isPublished": true
  }'
```

#### Script de Importação em Massa (Node.js):

```javascript
// scripts/import-faq.js
const faqs = [
  {
    question: "Pergunta 1?",
    answer: "Resposta 1",
    category: "acesso",
    order: 1,
    isPublished: true,
    tags: ["tag1", "tag2"]
  },
  {
    question: "Pergunta 2?",
    answer: "Resposta 2",
    category: "curso",
    order: 2,
    isPublished: true,
    tags: ["tag3"]
  },
  // ... mais FAQs
];

for (const faq of faqs) {
  const response = await fetch('http://localhost:3000/api/admin/faq', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `auth-token=${process.env.ADMIN_TOKEN}`
    },
    body: JSON.stringify(faq)
  });

  if (response.ok) {
    console.log(`✅ FAQ criado: ${faq.question}`);
  } else {
    console.error(`❌ Erro ao criar FAQ: ${faq.question}`);
  }
}
```

Executar:
```bash
ADMIN_TOKEN=seu_token node scripts/import-faq.js
```

---

### Opção 3: Interface Admin (Futura - Ideal)

**Status:** Não implementada ainda

**O que precisa ser criado:**
1. `/admin/faq/page.tsx` - Listagem de FAQs
2. `/admin/faq/new/page.tsx` - Criar novo FAQ
3. `/admin/faq/[id]/edit/page.tsx` - Editar FAQ
4. `/admin/glossario/page.tsx` - Listagem de termos
5. `/admin/glossario/new/page.tsx` - Criar novo termo
6. `/admin/glossario/[id]/edit/page.tsx` - Editar termo

**Estimativa de desenvolvimento:** 6-8 horas

**Funcionalidades sugeridas:**
- ✅ Editor Markdown com preview
- ✅ Busca e filtros
- ✅ Ordenação drag-and-drop
- ✅ Publicar/Despublicar toggle
- ✅ Relacionamentos com documentos
- ✅ Analytics de visualizações
- ✅ Tags autocomplete

**Seria como o painel de Blog:** `/admin/blog` (já existe e funciona bem)

---

## 📊 Estrutura de Dados

### FAQ

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `question` | String | ✅ Sim | Pergunta completa |
| `answer` | String (Markdown) | ✅ Sim | Resposta em Markdown |
| `category` | String | ✅ Sim | Categoria para filtros |
| `order` | Integer | Não | Ordem de exibição (padrão: 0) |
| `isPublished` | Boolean | Não | Visível no site (padrão: false) |
| `tags` | String[] | Não | Tags para busca |
| `views` | Integer | Automático | Contador de visualizações |
| `helpfulCount` | Integer | Automático | Votos "útil" |
| `notHelpfulCount` | Integer | Automático | Votos "não útil" |
| `relatedDocuments` | String[] | Não | IDs de documentos relacionados |
| `relatedTerms` | String[] | Não | Slugs de termos do glossário |

**Categorias sugeridas para FAQ:**
- `acesso` - Questões sobre acesso à plataforma
- `curso` - Questões sobre os cursos
- `certificado` - Questões sobre certificação
- `pagamento` - Questões sobre pagamento
- `suporte` - Questões de suporte técnico
- `geral` - Questões gerais

---

### Glossário

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `term` | String | ✅ Sim | Nome do termo |
| `slug` | String | ✅ Sim | URL única (auto-gerada se vazio) |
| `shortDef` | String | Não | Definição curta (1 frase) |
| `longDef` | String (Markdown) | ✅ Sim | Definição completa |
| `category` | String | ✅ Sim | Categoria do termo |
| `tags` | String[] | Não | Tags para busca |
| `order` | Integer | Não | Ordem alfabética (padrão: 0) |
| `isPublished` | Boolean | Não | Visível no site (padrão: false) |
| `legalBasis` | String | Não | Base legal (ex: artigo de lei) |
| `views` | Integer | Automático | Contador de visualizações |
| `relatedDocuments` | String[] | Não | IDs de documentos relacionados |
| `relatedTerms` | String[] | Não | Slugs de outros termos |

**Categorias sugeridas para Glossário:**
- `licitacao` - Termos sobre licitação
- `contrato` - Termos sobre contratos
- `fiscalizacao` - Termos sobre fiscalização
- `planejamento` - Termos sobre planejamento
- `sancionamento` - Termos sobre processo sancionador
- `conceitos-gerais` - Conceitos gerais de direito administrativo

---

## 🚀 Workflow Recomendado (Atual)

### Para criar conteúdo agora (sem interface admin):

1. **Prepare os dados em Excel/Planilha**
   - Coluna A: question/term
   - Coluna B: answer/shortDef
   - Coluna C: longDef (só glossário)
   - Coluna D: category
   - Coluna E: tags (separadas por vírgula)
   - Coluna F: legalBasis (só glossário)

2. **Converta para JSON** (pode usar ChatGPT/Claude)
   - Copie os dados da planilha
   - Peça: "Converta para JSON no formato do FAQ"

3. **Importe via Prisma Studio**
   - Abra `npx prisma studio`
   - Cole os dados um por vez
   - Ou use script de importação

4. **Valide no site**
   - Acesse `/faq` ou `/glossario`
   - Verifique se está exibindo corretamente
   - Teste a busca e filtros

---

## 📝 Exemplos Completos

### Exemplo 1: FAQ sobre Download de Materiais

```json
{
  "question": "Como faço para baixar os materiais do curso?",
  "answer": "Para baixar os materiais do curso:\n\n1. **Faça login** na [área restrita](/area-restrita)\n2. **Selecione o curso** no filtro superior\n3. **Encontre o documento** que deseja baixar\n4. **Clique no ícone de download** 📥 ao lado do título\n\nO arquivo será baixado automaticamente para seu computador.\n\n**Observações:**\n- Apenas alunos matriculados podem baixar materiais privados\n- Seus downloads ficam registrados no [histórico de acessos](/area-restrita/historico)\n- Alguns documentos podem ser apenas visualizados online",
  "category": "acesso",
  "order": 1,
  "isPublished": true,
  "tags": ["download", "materiais", "area-restrita", "documentos"],
  "relatedDocuments": [],
  "relatedTerms": ["area-restrita"]
}
```

### Exemplo 2: Termo do Glossário - Dispensa

```json
{
  "term": "Dispensa de Licitação",
  "slug": "dispensa-de-licitacao",
  "shortDef": "Contratação direta sem licitação quando esta é juridicamente possível mas a lei autoriza não realizá-la.",
  "longDef": "## Conceito\n\nA **dispensa de licitação** é uma das modalidades de contratação direta prevista na Lei 14.133/2021.\n\nOcorre quando a licitação é **juridicamente possível** (há viabilidade de competição), mas a lei **autoriza não realizá-la** em situações específicas de interesse público.\n\n## Hipóteses Principais\n\n### 1. Dispensa por Pequeno Valor\n- **Obras e serviços de engenharia:** até R$ 100.000,00\n- **Compras e outros serviços:** até R$ 50.000,00\n\n### 2. Dispensa por Emergência\n- Situação de emergência ou calamidade pública\n- Necessidade de pronta intervenção\n- Prazo máximo: 180 dias (prorrogável por mais 180)\n\n### 3. Dispensa por Deserto/Fracassado\n- Licitação deserta ou fracassada por 3 vezes consecutivas\n- Mantidas as condições preestabelecidas\n\n### 4. Outras Hipóteses\n- Guerra ou grave perturbação da ordem\n- Contratação de remanescente de obra/serviço\n- Compra ou locação de imóvel\n\n## Diferença: Dispensa vs Inexigibilidade\n\n| Aspecto | Dispensa | Inexigibilidade |\n|---------|----------|------------------|\n| Competição | Possível | Impossível |\n| Rol legal | Taxativo | Exemplificativo |\n| Exemplo | Pequeno valor | Artista consagrado |\n\n## Procedimento\n\n1. Caracterização da hipótese legal\n2. Justificativa fundamentada\n3. Estimativa de preço\n4. Razão de escolha do contratado\n5. Parecer jurídico (quando exigível)\n6. Publicação (extrato da dispensa)\n\n## Ver Também\n\n- [Inexigibilidade de Licitação](/glossario/inexigibilidade-licitacao)\n- [Contratação Direta](/glossario/contratacao-direta)\n- [Licitação](/glossario/licitacao)",
  "category": "licitacao",
  "legalBasis": "Art. 75, Lei 14.133/2021",
  "tags": ["contratacao-direta", "lei-14133", "dispensa", "licitacao"],
  "order": 50,
  "isPublished": true,
  "relatedDocuments": [],
  "relatedTerms": ["inexigibilidade-licitacao", "contratacao-direta", "licitacao"]
}
```

---

## ⚙️ APIs Disponíveis

### FAQ

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/faq` | Listar todas FAQs (admin) |
| POST | `/api/admin/faq` | Criar nova FAQ (admin) |
| GET | `/api/admin/faq/[id]` | Buscar FAQ por ID (admin) |
| PUT | `/api/admin/faq/[id]` | Atualizar FAQ (admin) |
| DELETE | `/api/admin/faq/[id]` | Deletar FAQ (admin) |
| GET | `/api/faq` | Listar FAQs publicadas (público) |
| GET | `/api/faq/[id]` | Buscar FAQ por ID (público) |
| POST | `/api/faq/[id]/feedback` | Registrar feedback útil/não útil |
| POST | `/api/faq/[id]/view` | Registrar visualização |
| GET | `/api/faq/search?q=termo` | Buscar FAQs |

### Glossário

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/glossary` | Listar todos termos (admin) |
| POST | `/api/admin/glossary` | Criar novo termo (admin) |
| GET | `/api/admin/glossary/[id]` | Buscar termo por ID (admin) |
| PUT | `/api/admin/glossary/[id]` | Atualizar termo (admin) |
| DELETE | `/api/admin/glossary/[id]` | Deletar termo (admin) |
| GET | `/api/glossary` | Listar termos publicados (público) |
| GET | `/api/glossary/[slug]` | Buscar termo por slug (público) |
| GET | `/api/glossary/search?q=termo` | Buscar termos |

---

## 🎯 Recomendação Imediata

**Para começar a alimentar FAQ e Glossário HOJE:**

1. **Use Prisma Studio** - É o caminho mais rápido
   ```bash
   npx prisma studio
   ```

2. **Comece pequeno** - Crie 5-10 itens para testar

3. **Valide no site público:**
   - FAQ: http://localhost:3000/faq
   - Glossário: http://localhost:3000/glossario

4. **Se precisar de interface admin:**
   - Posso criar a interface completa (6-8 horas)
   - Seria igual ao painel de Blog que já existe
   - Com editor Markdown, preview, filtros, etc.

---

## 📞 Precisa de Ajuda?

Se quiser que eu implemente a **interface admin para FAQ/Glossário**, posso fazer agora. Seria uma interface similar ao `/admin/blog` com:

- ✅ Listagem com busca e filtros
- ✅ Criar/Editar com editor Markdown
- ✅ Preview em tempo real
- ✅ Publicar/Despublicar toggle
- ✅ Ordenação drag-and-drop
- ✅ Analytics de visualizações
- ✅ Relacionamentos com documentos

**Quer que eu implemente a interface admin agora? Ou prefere usar Prisma Studio por enquanto?**
