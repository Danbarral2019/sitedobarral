# 📋 Sistema de Importação Automática - Orientações Normativas da AGU

Este documento descreve o sistema completo de importação automática das Orientações Normativas da Advocacia-Geral da União (AGU) para o site do Prof. Daniel Barral.

## 📊 Visão Geral

O sistema permite importar automaticamente todas as Orientações Normativas disponíveis no site da AGU para **TODOS os 10 cursos** do site, criando documentos públicos categorizados como "Orientação Normativa".

**Fonte oficial:** https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu

---

## ⚡ PADRÃO ATUAL v3 (2025-10-26)

### 🎯 Requisitos Obrigatórios para Novas ONs

**IMPORTANTE:** Todas as novas importações DEVEM seguir este padrão padronizado estabelecido em 2025-10-26.

#### 1. Título Padronizado ✅

**Formato obrigatório:**
```
Orientação Normativa AGU nº XX/XXXX
```

**Exemplos:**
- ✅ `Orientação Normativa AGU nº 1/2009`
- ✅ `Orientação Normativa AGU nº 101/2025`
- ❌ `ON 1/2009` (formato antigo, NÃO usar)
- ❌ `Orientação Normativa 1/2009` (falta "AGU nº")

#### 2. Campos Numéricos para Ordenação ✅

**Obrigatórios:**
```typescript
{
  onNumber: 101,   // Número da ON (inteiro)
  onYear: 2025,    // Ano da ON (inteiro)
}
```

**Motivo:** Garante ordenação numérica correta (ON 101, 100, 99... 2, 1) ao invés de alfabética.

#### 3. Múltiplas Fundamentações ✅

**REGRA CRÍTICA:** Quando uma ON possui múltiplos PDFs de fundamentação, **NÃO** criar documentos duplicados.

**✅ Correto:**
```javascript
{
  title: "Orientação Normativa AGU nº 26/2009",
  url: "https://.../fundamentacao1.pdf",
  alternativeUrls: JSON.stringify([
    "https://.../fundamentacao2.pdf",
    "https://.../fundamentacao3.pdf"
  ]),
  onNumber: 26,
  onYear: 2009
}
// → 1 único registro no banco com 3 URLs
```

**❌ Incorreto (não fazer):**
```javascript
// NÃO criar 3 registros separados:
{ title: "ON 26/2009 (Fundamentação 1)", url: "..." }
{ title: "ON 26/2009 (Fundamentação 2)", url: "..." }
{ title: "ON 26/2009 (Fundamentação 3)", url: "..." }
```

#### 4. Documentos Comuns (isCommon) ✅

**Todas as ONs devem usar:**
```javascript
{
  isCommon: true,    // Disponível para TODOS os cursos
  courseId: null,    // NULL quando isCommon=true
  isPublic: true     // Público para todos
}
```

#### 5. Ordenação Numérica ✅

**Sempre ordenar por:**
```sql
ORDER BY onNumber DESC, onYear DESC, title DESC
```

**Resultado esperado:**
```
ON 101/2025
ON 100/2025
ON 99/2025
...
ON 2/2009
ON 1/2009
```

### 📊 Estado Atual do Banco (2025-10-26)

- **Total de ONs:** 96 únicas
- **ONs com múltiplas fundamentações:** 19
- **Duplicatas removidas:** 14
- **Títulos padronizados:** 100%
- **Ordenação:** Numérica decrescente ✅

### 🔧 Scripts de Verificação

```bash
# Verificar padronização
node scripts/verify-on-standardization.js

# Testar ordenação numérica
node scripts/test-numeric-sorting.js

# Verificar duplicatas
node scripts/check-on-formatting.js

# Padronizar ONs (se necessário)
node scripts/standardize-ons.js

# Popular campos numéricos
node scripts/populate-on-numbers.js
```

---

## ✨ Funcionalidades Implementadas

### 1. **Nova Categoria de Documento**
✅ Adicionada categoria `orientacao-normativa` em todo o sistema:
- Upload individual de documentos
- Upload em lote
- Importação via Excel
- Filtros e busca
- Classificação automática (básica e com Claude AI)

### 2. **Scraper Automatizado**
✅ Sistema que:
- Acessa automaticamente o site da AGU
- Extrai todas as Orientações Normativas publicadas
- Identifica: número, ano, título, descrição
- Localiza links para PDFs e publicações no DOU
- Extrai tags relevantes (licitação, contratos, pregão, etc.)

### 3. **Interface Admin Dedicada**
✅ Página exclusiva em `/admin/agu-import` com:
- **Preview:** Visualiza orientações antes de importar
- **Importação em 1 clique:** Adiciona todas a todos os cursos
- **Estatísticas detalhadas:** Documentos criados, erros, etc.
- **Visualização de resultados:** Confirmação do que foi importado

### 4. **Importação Automatizada**
✅ Processo totalmente automatizado:
- Busca todas as Orientações no site da AGU
- Cria documento em cada um dos 10 cursos
- Marca como público automaticamente
- Adiciona tags relevantes
- Categoriza como "Orientação Normativa"

## 🚀 Como Usar

### Opção 1: Importação Automática (Recomendado)

**1. Acesse a página de importação:**
```
http://localhost:3000/admin/agu-import
```

**2. Clique em "Carregar Preview"**
- Sistema busca todas as orientações do site da AGU
- Mostra preview das primeiras 10
- Exibe total de orientações encontradas

**3. Revise o preview**
- Verifique número, título e descrição
- Confira tags extraídas
- Veja links para PDFs quando disponíveis

**4. Clique em "Importar"**
- Confirme a importação
- Sistema cria documentos em todos os 10 cursos
- Aguarde conclusão (pode levar alguns segundos)

**5. Veja o resultado**
- Estatísticas: orientações encontradas, documentos criados, erros
- Confirmação de sucesso
- Links para documentos criados

### Opção 2: Upload Manual

Se preferir controle individual:

**1. Acesse:** `/admin/documentos`

**2. Selecione:**
- Curso: **"⭐ TODOS OS CURSOS"**
- Categoria: **"Orientação Normativa (AGU)"**
- Arquivo: PDF baixado do site da AGU
- Público: Marque como público

**3. Faça upload normalmente**

### Opção 3: Importação via Excel

**1. Crie planilha com:**
```csv
Titulo,Descricao,Categoria,Curso,Publico,Tags,Artigos,URL,Arquivo
"ON 1/2009 - Título",Descrição,orientacao-normativa,TODOS,Sim,"AGU, Licitação",,https://link.pdf,
```

**2. Importe:** `/admin/importar`

## 📁 Arquivos Criados/Modificados

### Novos Arquivos

1. **`lib/agu-scraper.ts`** - Scraper principal
   - Funções para buscar e parsear orientações
   - Extração de tags
   - Conversão para formato de documento

2. **`app/api/admin/agu-import/route.ts`** - API de importação
   - `GET /api/admin/agu-import` - Preview
   - `POST /api/admin/agu-import` - Importação

3. **`app/admin/agu-import/page.tsx`** - Interface admin
   - UI completa para importação
   - Preview de orientações
   - Estatísticas e resultados

4. **`AGU_ORIENTACOES_NORMATIVAS.md`** - Esta documentação

### Arquivos Modificados

1. **`lib/types.ts`** - Adicionado tipo `orientacao-normativa`
2. **`lib/documents.ts`** - Suporte à nova categoria
3. **`lib/auto-classifier.ts`** - Detecção automática
4. **`lib/claude-classifier.ts`** - Classificação com IA
5. **`lib/excel-processor.ts`** - Import Excel
6. **`app/admin/documentos/page.tsx`** - UI de upload
7. **`app/api/admin/upload/route.ts`** - API de upload
8. **`components/AdminLayout.tsx`** - Menu admin

## 🎯 Como o Scraper Funciona

### 1. Busca da Página
```typescript
fetch('https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu')
```

### 2. Parsing do HTML
- Regex para encontrar padrão `ON XX/YYYY`
- Divide HTML em blocos por orientação
- Extrai informações de cada bloco

### 3. Extração de Dados
```typescript
{
  numero: "ON 1/2009",
  ano: "2009",
  titulo: "Título da orientação",
  descricao: "Descrição completa...",
  linkDOU: "https://...",
  linkFundamentacao: "https://...pdf",
  tags: ["AGU", "Licitação", ...]
}
```

### 4. Tags Automáticas
O sistema detecta automaticamente:
- ✅ Licitação
- ✅ Contratos
- ✅ Contratação Direta
- ✅ Pregão
- ✅ Registro de Preços
- ✅ Lei 14.133/2021
- ✅ Lei 8.666/93
- ✅ Convênios
- ✅ Fiscalização
- ✅ Gestão
- ✅ Terceirização

## 📊 Exemplo de Documento Criado

Quando você importa, cada orientação vira um documento assim:

```typescript
{
  title: "ON 1/2009 - Pregão Eletrônico",
  description: "Orientação sobre a realização de pregão eletrônico...",
  category: "orientacao-normativa",
  type: "link",
  url: "https://www.gov.br/agu/.../fundamentacao-on-01-2009.pdf",
  courseId: "1", // (e também 2, 3, 4, ..., 10)
  isPublic: true,
  tags: ["AGU", "ON 1/2009", "Pregão", "Licitação"],
  leiArticles: []
}
```

**Resultado:**
- Se há 50 Orientações Normativas
- E você importa para 10 cursos
- **Total:** 500 documentos criados (50 × 10)

## 🔍 Como Verificar se Funcionou

### 1. Pelo Admin Panel

**Documentos:**
```
http://localhost:3000/admin/documentos
```
- Filtrar por: Categoria = "Orientação Normativa (AGU)"
- Deve aparecer todos os documentos importados

### 2. Pela Área Restrita (Student)

Faça login como aluno e vá em:
```
http://localhost:3000/area-restrita
```
- Selecione qualquer curso
- Filtre por: Categoria = "Orientação Normativa"
- Deve ver todas as orientações

### 3. Pelo Banco de Dados

```bash
npx prisma studio
```
- Abra tabela `Document`
- Filtrar: `category = "orientacao-normativa"`

## ⚠️ Observações Importantes

### Estrutura do Site da AGU
- ✅ Todas orientações em uma única página
- ✅ Sem paginação (facilita scraping)
- ⚠️ Formato não estruturado (parsing baseado em regex)
- ⚠️ Possível mudança futura na estrutura

### Recomendações
1. **Teste primeiro:** Use o preview antes de importar
2. **Revise resultados:** Verifique se tudo foi importado corretamente
3. **Manualmente se necessário:** Se scraper falhar, use Excel
4. **Backup:** Faça backup do banco antes de importações grandes

### Limitações
- Scraper depende da estrutura HTML atual do site
- Links externos podem quebrar se AGU mudar URLs
- PDFs são linkados (não hospedados no site)
- Atualizações futuras requerem nova importação

## 🔄 Atualizando Orientações

Se a AGU publicar novas orientações:

**Opção 1: Reimportar tudo**
1. Delete orientações antigas
2. Execute nova importação
3. Sistema puxa todas novamente

**Opção 2: Adicionar manualmente**
1. Identifique novas orientações
2. Use upload manual
3. Selecione "TODOS OS CURSOS"

## 🐛 Troubleshooting

### Erro: "Erro ao buscar página"
**Causa:** Site da AGU offline ou bloqueando scraping
**Solução:**
1. Verifique se site está acessível: https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu
2. Tente novamente mais tarde
3. Use importação manual via Excel

### Erro: "Nenhuma orientação encontrada"
**Causa:** Estrutura HTML mudou
**Solução:**
1. Verifique logs do console
2. Ajuste regex em `lib/agu-scraper.ts`
3. Use importação manual

### Documentos não aparecem na área restrita
**Causa:** Falta de matrícula no curso
**Solução:**
1. Verifique se orientações estão marcadas como PÚBLICAS
2. Confirme matrícula do aluno
3. Verifique filtros aplicados

## 📈 Estatísticas de Uso

Após importação, você pode ver:

**Analytics de Catalogação:**
```
http://localhost:3000/admin/analytics-documentos
```
- Total de documentos por categoria
- Orientações Normativas por curso
- Documentos mais acessados

## 🎓 Benefícios Acadêmicos

### Para os Alunos
- ✅ Acesso centralizado a todas as orientações
- ✅ Organizado por curso relevante
- ✅ Tags para busca facilitada
- ✅ Links diretos para PDFs oficiais
- ✅ Público (sem necessidade de QR)

### Para o Professor
- ✅ Atualização rápida (1 clique)
- ✅ Disponível em todos os cursos
- ✅ Categorização automática
- ✅ Rastreamento de acessos
- ✅ Material sempre atualizado

## 📝 Próximos Passos

### Melhorias Futuras
- [ ] Agendamento automático (cron job mensal)
- [ ] Notificação quando novas ONs são publicadas
- [ ] Download e hospedagem local dos PDFs
- [ ] Sistema de diff para detectar apenas novas
- [ ] Histórico de alterações nas ONs

### Manutenção
- Testar scraper mensalmente
- Atualizar regex se estrutura HTML mudar
- Verificar links quebrados
- Backup regular do banco de dados

---

**Implementado em:** 2025-10-26
**Versão:** 1.0.0
**Status:** ✅ Funcional e testado
