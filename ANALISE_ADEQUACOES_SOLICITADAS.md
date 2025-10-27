# 📋 Análise de Adequações Solicitadas

## 1. ✅ Páginas Públicas dos Cursos - Bibliografia

### Problema Identificado
As páginas públicas dos cursos (`/cursos/[slug]`) ainda exibem a bibliografia como lista de strings (linhas 314-340), mas agora a bibliografia deve ser um documento PDF anexado, não informações inline no site.

### Arquivos Afetados
- `app/cursos/[slug]/page.tsx` (linhas 314-340)
- `data/courses.ts` (campo `bibliography` como array de strings)

### Solução Proposta
1. **Remover seção de bibliografia das páginas públicas** - não faz sentido mostrar lista inline
2. **Manter apenas referência** - indicar que bibliografia está disponível como documento na área restrita
3. **Ou tornar a bibliografia documento público** - adicionar link de download direto se for um PDF público

### Alterações Necessárias
```typescript
// Opção A: Remover completamente a seção de bibliografia das páginas públicas
// (Recomendado, já que é material da área restrita)

// Opção B: Substituir por card informativo
<div className="bg-white rounded-2xl shadow-lg p-8">
  <h2>Bibliografia Recomendada</h2>
  <p>O material bibliográfico completo está disponível em PDF para alunos matriculados na área restrita.</p>
  <Link href="/login">Acessar Área Restrita</Link>
</div>
```

---

## 2. ✅ Remover Aba de Importação de Enunciados

### Problema Identificado
No `AdminLayout.tsx` (linhas 120-127), ainda existe a aba "Enunciados - Importar" que não é mais necessária após simplificação.

### Arquivo Afetado
- `components/AdminLayout.tsx` (linhas 120-127)

### Solução
Remover o item do menu:
```typescript
// REMOVER estas linhas:
{
  path: '/admin/enunciados-import',
  label: 'Enunciados - Importar',
  icon: (props: Record<string, unknown>) => (...),
},
```

---

## 3. ✅ Adicionar Edição no Preview do TCU Scraper

### Problema Identificado
Na página `app/admin/tcu-import/page.tsx`, o preview dos acórdãos permite:
- ✅ Editar cursos associados
- ❌ **FALTA:** Editar comentários/notas/descrição

O usuário quer poder adicionar comentários durante o preview, especialmente os campos de observações que foram incluídos na página de documentos.

### Arquivo Afetado
- `app/admin/tcu-import/page.tsx`

### Campos do Documento Disponíveis
Consultando o schema do Prisma, os documentos têm:
- `title` - já vem do título do acórdão
- `description` - sumário do acórdão (pode ser editável)
- `notes` - campo de notas/observações (DEVE SER EDITÁVEL)
- `category` - tem edição em lote, mas não individual

### Solução Proposta

#### Interface AcordaoPreview (adicionar campos)
```typescript
interface AcordaoPreview {
  // ... campos existentes
  notes?: string;           // NOVO - campo de observações
  customDescription?: string; // NOVO - descrição customizada
}
```

#### Estado de Edição (adicionar)
```typescript
const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
const [editingDescriptions, setEditingDescriptions] = useState<Record<string, string>>({});
```

#### UI no Preview (adicionar dentro de cada card)
```typescript
{/* Após a edição de cursos, adicionar: */}
<div className="mt-4 space-y-2">
  {/* Campo de Descrição */}
  <div>
    <label className="text-xs font-semibold text-gray-700">
      Descrição Customizada (opcional)
    </label>
    <textarea
      value={editingDescriptions[key] || acordao.sumario}
      onChange={(e) => setEditingDescriptions({
        ...editingDescriptions,
        [key]: e.target.value
      })}
      placeholder="Edite a descrição do acórdão..."
      rows={2}
      className="w-full px-2 py-1 text-sm border rounded"
    />
  </div>

  {/* Campo de Observações/Comentários */}
  <div>
    <label className="text-xs font-semibold text-gray-700">
      Observações/Comentários
    </label>
    <textarea
      value={editingNotes[key] || ''}
      onChange={(e) => setEditingNotes({
        ...editingNotes,
        [key]: e.target.value
      })}
      placeholder="Adicione observações, contexto, trechos importantes..."
      rows={3}
      className="w-full px-2 py-1 text-sm border rounded"
    />
  </div>
</div>
```

#### Envio na Importação (modificar)
```typescript
const response = await fetch('/api/admin/tcu/import-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    acordaos: acordaosToImport.map(ac => ({
      ...ac,
      suggestedCourses: editingCourses[key] || ac.suggestedCourses,
      customDescription: editingDescriptions[key], // NOVO
      notes: editingNotes[key],                   // NOVO
    }))
  }),
});
```

#### API de Importação (atualizar)
Modificar `app/api/admin/tcu/import-batch/route.ts` para aceitar e usar `customDescription` e `notes`:
```typescript
description: acordao.customDescription || acordao.sumario,
notes: acordao.notes || null,
```

---

## 📊 Resumo das Alterações

| # | Descrição | Arquivo Principal | Complexidade | Prioridade |
|---|-----------|-------------------|--------------|------------|
| 1 | Adequar páginas públicas dos cursos (bibliografia) | `app/cursos/[slug]/page.tsx` | Baixa | Alta |
| 2 | Remover aba de enunciados do admin | `components/AdminLayout.tsx` | Trivial | Alta |
| 3 | Adicionar edição de comentários no TCU preview | `app/admin/tcu-import/page.tsx` + API | Média | Alta |

---

## 🎯 Ordem de Implementação Recomendada

1. **Remover aba de enunciados** (mais rápido, 1 minuto)
2. **Adequar páginas públicas** (rápido, 5 minutos)
3. **Adicionar edição no TCU preview** (mais complexo, 15 minutos)

---

## 📝 Decisões Necessárias

### Para a Bibliografia:
**Decisão necessária:** Como tratar a bibliografia nas páginas públicas?

**Opção A** (recomendada): Remover completamente a seção de bibliografia inline
- ✅ Mais limpo
- ✅ Evita duplicação (já está como PDF)
- ❌ Menos conteúdo público

**Opção B**: Manter como está e criar um documento "Bibliografia" para cada curso
- ✅ Mantém referência pública
- ❌ Trabalho extra de criar PDFs
- ❌ Manutenção duplicada

**Sua escolha?**
