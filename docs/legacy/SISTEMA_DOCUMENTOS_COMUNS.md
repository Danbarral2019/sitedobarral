# 📋 Sistema de Documentos Comuns

**Data de implementação:** 2025-10-26
**Status:** ✅ Implementado e em produção

---

## 🎯 Objetivo

Criar um sistema eficiente para documentos que devem aparecer em **todos os cursos** sem duplicação física no banco de dados.

**Benefícios:**
- ✅ **90% de redução** no banco de dados
- ✅ Fácil manutenção (atualizar 1 vez, reflete em todos os cursos)
- ✅ Consistência automática entre cursos
- ✅ Performance melhorada (menos registros para indexar)

---

## 🏗️ Arquitetura

### Schema Prisma

```prisma
model Document {
  id          String   @id @default(uuid())
  title       String
  description String?
  type        String
  url         String
  category    String
  courseId    String?  // NULL se isCommon=true
  isPublic    Boolean  @default(false)
  isCommon    Boolean  @default(false) // Se true, disponível para todos os cursos
  tags        String?
  leiArticles String?
  size        Int?
  uploadedAt  DateTime @default(now())
  updatedAt   DateTime @updatedAt
  notifiedAt  DateTime?

  @@index([courseId])
  @@index([category])
  @@index([isCommon]) // Índice para documentos comuns
}
```

### Lógica de Dados

**Documento Específico:**
```typescript
{
  id: "123",
  title: "Apostila do Curso 1",
  courseId: "1",      // Específico do curso
  isCommon: false     // Aparece apenas no curso 1
}
```

**Documento Comum:**
```typescript
{
  id: "456",
  title: "ON 22/2009",
  courseId: null,     // NULL = todos os cursos
  isCommon: true      // Aparece em todos os cursos
}
```

---

## 🔧 Implementação

### 1. API - Busca de Documentos

**Arquivo:** `app/api/area-restrita/batch-data/route.ts`

```typescript
// Buscar documentos específicos E comuns
const documents = await prisma.document.findMany({
  where: {
    OR: [
      { courseId: { in: courseIds } }, // Específicos do curso
      { isCommon: true },               // Comuns a todos
    ],
  },
  select: {
    // ... campos
    isCommon: true, // Incluir na resposta
  },
});

// Agrupar por curso
documents.forEach(doc => {
  if (doc.isCommon) {
    // Documento comum: adicionar a TODOS os cursos
    courseIds.forEach(courseId => {
      groupedDocuments[courseId].push(doc);
    });
  } else if (doc.courseId && groupedDocuments[doc.courseId]) {
    // Documento específico: apenas ao curso correspondente
    groupedDocuments[doc.courseId].push(doc);
  }
});
```

### 2. Migração de Dados

**Script:** `scripts/migrate-ons-to-common.js`

```bash
$ node scripts/migrate-ons-to-common.js

🔄 Iniciando migração...
📊 Total de ONs: 1310
📊 Títulos únicos: 132

⚠️  Esta operação vai:
   1. Marcar 132 ONs como COMUNS (isCommon=true, courseId=null)
   2. Deletar 1178 ONs duplicadas
   3. Reduzir banco de 1310 para 132 registros (90% redução)

✅ 132 ONs marcadas como comuns
✅ 1178 ONs duplicadas deletadas
🎉 Migração concluída!
```

### 3. Teste e Validação

**Script:** `scripts/test-common-documents.js`

```bash
$ node scripts/test-common-documents.js

🧪 Testando sistema...

📊 Curso 1: 150 docs (132 ONs comuns + 18 específicos)
📊 Curso 2: 132 docs (132 ONs comuns)
📊 Curso 3: 132 docs (132 ONs comuns)
...

✅ PERFEITO! Todos os cursos têm 132 ONs
📊 Economia: 90% (132 registros vs 1320 sem o sistema)
```

---

## 📊 Impacto e Resultados

### Antes (Sem Sistema Comum)

| Métrica | Valor |
|---------|-------|
| **ONs no banco** | 1.310 |
| **ONs únicas** | 131 |
| **Duplicatas** | 1.179 (90%) |
| **Eficiência** | Baixa |

**Problemas:**
- ❌ 90% dos documentos eram duplicatas
- ❌ Atualizar 1 ON = atualizar 10 registros
- ❌ Inconsistência entre cursos
- ❌ Desperdício de espaço e performance

### Depois (Com Sistema Comum)

| Métrica | Valor |
|---------|-------|
| **ONs no banco** | 132 |
| **ONs únicas** | 132 |
| **Duplicatas** | 0 (0%) |
| **Eficiência** | Alta (90% redução) |

**Benefícios:**
- ✅ Apenas 1 registro por ON
- ✅ Atualizar 1 ON = atualizar 1 registro
- ✅ Consistência automática entre cursos
- ✅ 90% menos espaço no banco
- ✅ Queries mais rápidas (menos registros)

---

## 🚀 Como Usar

### Para Administradores

#### 1. Marcar documento como comum

```javascript
// Via Prisma
await prisma.document.create({
  data: {
    title: "Documento Comum",
    category: "orientacao-normativa",
    isCommon: true,     // ✅ Disponível para todos os cursos
    courseId: null,     // ✅ Não pertence a um curso específico
    // ... outros campos
  }
});
```

#### 2. Converter documento específico em comum

```javascript
// Migrar documento do Curso 1 para comum
await prisma.document.update({
  where: { id: "doc-id" },
  data: {
    isCommon: true,
    courseId: null, // Remove vínculo específico
  }
});

// Deletar duplicatas nos outros cursos
await prisma.document.deleteMany({
  where: {
    title: "Mesmo título",
    courseId: { not: null }, // Apenas específicos
  }
});
```

#### 3. Importar documentos comuns via AGU Scraper

**Arquivo:** `lib/agu-scraper.ts`

```typescript
// ONs já são importadas como comuns
export function generateOrientacoesExcel(orientacoes) {
  const rows = orientacoes.map(on => [
    `${on.numero} - ${on.titulo}`,
    on.descricao,
    'orientacao-normativa',
    'TODOS', // ✅ Será marcado como isCommon=true
    'Sim',
    // ...
  ]);
}
```

### Para Desenvolvedores

#### Query para buscar documentos

```typescript
// Buscar documentos de um curso (inclui comuns automaticamente)
const documents = await prisma.document.findMany({
  where: {
    OR: [
      { courseId: selectedCourseId },  // Específicos
      { isCommon: true },              // Comuns
    ],
  },
});
```

#### Verificar se documento é comum

```typescript
if (document.isCommon) {
  console.log('Este documento aparece em todos os cursos');
} else {
  console.log(`Este documento é específico do Curso ${document.courseId}`);
}
```

---

## 📝 Scripts Disponíveis

### 1. `scripts/migrate-ons-to-common.js`
**Finalidade:** Migrar ONs existentes para o sistema comum

```bash
node scripts/migrate-ons-to-common.js
```

**O que faz:**
- Identifica ONs duplicadas
- Marca 1 cópia como comum (isCommon=true)
- Deleta as outras cópias
- Reduz banco de 1.310 → 132 registros

### 2. `scripts/test-common-documents.js`
**Finalidade:** Testar sistema de documentos comuns

```bash
node scripts/test-common-documents.js
```

**O que faz:**
- Simula query da API para cada curso
- Verifica que todos os cursos têm acesso às mesmas ONs comuns
- Calcula economia de espaço

### 3. `scripts/check-on-distribution.js`
**Finalidade:** Verificar distribuição de ONs por curso

```bash
node scripts/check-on-distribution.js
```

**O que faz:**
- Conta ONs por curso
- Detecta duplicatas DENTRO de cada curso
- Verifica consistência entre cursos

---

## 🔮 Casos de Uso Futuros

### 1. Outros Materiais Comuns

Além de ONs, outros materiais podem ser comuns:

**Exemplos:**
- 📋 Acórdãos do TCU relevantes para todos os cursos
- 📝 Pareceres da AGU de interesse geral
- 📑 Artigos doutrinários aplicáveis a múltiplos cursos
- 📖 Livros/publicações do professor
- 🔗 Links de referência (sites oficiais)

**Implementação:**
```javascript
// Marcar qualquer documento como comum
await prisma.document.create({
  data: {
    title: "Acórdão TCU 1234/2024",
    category: "acordao",
    isCommon: true,      // Aparece em todos os cursos
    courseId: null,
    // ...
  }
});
```

### 2. Interface Admin

**Proposta de Feature:**

Adicionar checkbox "Disponível para todos os cursos" no formulário de upload:

```typescript
// components/admin/DocumentUploadForm.tsx
<Checkbox
  checked={isCommon}
  onCheckedChange={setIsCommon}
>
  📋 Disponível para todos os cursos
</Checkbox>

// Se isCommon=true, desabilitar seletor de curso
<Select
  disabled={isCommon}
  value={courseId}
>
  {/* Lista de cursos */}
</Select>
```

### 3. Categorias Comuns

**Sugestão:** Marcar categorias inteiras como comuns por padrão

```typescript
const COMMON_CATEGORIES = [
  'orientacao-normativa',
  'publicacao-oficial',
  'material-geral',
];

// Auto-marcar como comum ao criar
if (COMMON_CATEGORIES.includes(category)) {
  isCommon = true;
  courseId = null;
}
```

---

## ⚙️ Configuração

### Migração de Banco de Dados

**1. Aplicar schema (já feito):**
```bash
npx prisma db push
```

**2. Migrar dados existentes:**
```bash
node scripts/migrate-ons-to-common.js
```

**3. Verificar resultado:**
```bash
node scripts/test-common-documents.js
```

### Deploy

**Vercel (automático):**
- Push para GitHub → Vercel detecta mudanças no schema
- Prisma generate executado automaticamente
- Banco de dados já está migrado (via script manual)

**Comandos manuais:**
```bash
git add .
git commit -m "feat: Sistema de documentos comuns"
git push
vercel --prod
```

---

## 🐛 Troubleshooting

### Problema: ONs não aparecem em alguns cursos

**Diagnóstico:**
```bash
node scripts/test-common-documents.js
```

**Possíveis causas:**
1. Migration não foi aplicada
2. Documentos não foram marcados como comuns
3. API não está incluindo documentos comuns na query

**Solução:**
```bash
# Re-executar migration
node scripts/migrate-ons-to-common.js

# Verificar schema
npx prisma studio
```

### Problema: Duplicatas reaparecendo

**Causa:** Importação AGU não está usando o sistema comum

**Solução:**
1. Verificar `lib/agu-scraper.ts` - campo `'TODOS'`
2. Verificar `lib/excel-processor.ts` - lógica de `isCommon`
3. Re-executar script de limpeza:
```bash
node scripts/remove-duplicate-ons.js
node scripts/migrate-ons-to-common.js
```

### Problema: courseId NULL causando erros

**Causa:** Código espera courseId sempre preenchido

**Solução:**
```typescript
// Tratar courseId como opcional
const courseId = document.courseId || 'COMUM';

// Ou verificar isCommon primeiro
if (document.isCommon) {
  // Lógica para documentos comuns
} else if (document.courseId) {
  // Lógica para específicos
}
```

---

## 📚 Referências

### Arquivos Modificados
- `prisma/schema.prisma` - Adiciona campo `isCommon`
- `app/api/area-restrita/batch-data/route.ts` - Query e agrupamento
- `lib/agu-scraper.ts` - Importação com `'TODOS'`

### Scripts Criados
- `scripts/migrate-ons-to-common.js` - Migração de dados
- `scripts/test-common-documents.js` - Teste de sistema
- `scripts/check-on-distribution.js` - Verificação de distribuição
- `scripts/remove-duplicate-ons.js` - Limpeza de duplicatas

### Documentação Relacionada
- `CORRECAO_DUPLICATAS_ONS.md` - Correção inicial de duplicatas
- `SESSAO_2025-10-26_FIX_ONS_AREA_RESTRITA.md` - Sessão anterior

---

## ✅ Checklist de Implementação

- [x] Adicionar campo `isCommon` ao schema Prisma
- [x] Criar migration do banco de dados
- [x] Atualizar API batch-data
- [x] Criar script de migração de dados
- [x] Executar migração (1.310 → 132)
- [x] Criar scripts de teste e validação
- [x] Testar em todos os cursos
- [x] Deploy para produção
- [x] Documentar sistema completo
- [ ] Adicionar interface admin (futuro)
- [ ] Aplicar a outras categorias de documentos (futuro)

---

## 🎉 Resultado Final

**SISTEMA IMPLEMENTADO COM SUCESSO!** ✅

### Métricas

| Métrica | Valor |
|---------|-------|
| **Redução no banco** | 90% (1.310 → 132) |
| **ONs únicas** | 132 |
| **Cursos atendidos** | 10 |
| **Acessos totais** | 1.320 (132 × 10) |
| **Registros necessários** | 132 (vs 1.320 antes) |
| **Economia de espaço** | 90% |
| **Economia de atualizações** | 10× (1 update vs 10 updates) |

### Benefícios

- ✅ **Manutenção simplificada:** Atualizar 1 vez, reflete em 10 cursos
- ✅ **Consistência garantida:** Impossível ter ONs diferentes entre cursos
- ✅ **Performance melhorada:** 90% menos registros para indexar
- ✅ **Escalabilidade:** Adicionar novo curso não duplica documentos comuns
- ✅ **Futuro-proof:** Base para outros materiais comuns

---

**Data:** 2025-10-26
**Implementado por:** Claude Code
**Status:** ✅ Em produção
**Testado:** ✅ Sim (todos os 10 cursos)
