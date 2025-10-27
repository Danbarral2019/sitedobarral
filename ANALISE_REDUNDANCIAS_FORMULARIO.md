# 🔍 Análise de Redundâncias no Formulário de Documentos

## ❌ REDUNDÂNCIAS IDENTIFICADAS

### 1. **Instituição vs Entidade** (DUPLICADO)

**Campo Existente (linhas 804-840):**
```typescript
// Aparece quando category === 'enunciados'
entityType: 'IBDA' | 'INCP' | 'CJF'
enunciadoNumber: string (opcional)
```

**Campo Novo no Modo Manual (linhas 891-906):**
```typescript
institution: 'IBDA' | 'INCP' | 'CJF' | 'outro'
```

**Problema:** São exatamente a mesma coisa! Um é chamado `entityType`, outro `institution`.

---

### 2. **Tipo de Documento** (REDUNDANTE COM CATEGORIA)

**Campo Novo no Modo Manual (linhas 876-889):**
```typescript
documentType: 'enunciado' | 'sumula'
```

**Problema:** A categoria já tem `enunciados`. O tipo "súmula" poderia ser apenas mais uma categoria.

---

### 3. **Texto vs Descrição** (CONFUSO)

**Campo Existente:**
```typescript
description: string (textarea, 3 rows)
```

**Campo Novo no Modo Manual:**
```typescript
textContent: string (textarea, 6 rows) - "Texto completo"
```

**Problema:** No modo manual, temos "Descrição" + "Texto completo" + "Observações". Isso é confuso e redundante.

---

### 4. **Observações vs Notes** (CAMPO JÁ EXISTE)

O sistema já tem um campo `notes` no documento. O campo "Observações" no modo manual está apenas duplicando isso.

---

## ✅ SOLUÇÃO PROPOSTA

### Simplificação do Formulário:

#### **Campos Comuns (sempre visíveis):**
1. **Curso** (select)
2. **Título** (input text)
3. **Categoria** (select) - incluir "Súmula" como nova opção
4. **Descrição/Resumo** (textarea pequeno)

#### **Campos Condicionais:**

**Se categoria === 'enunciados' OU 'sumula':**
- **Instituição** (select): IBDA, INCP, CJF, Outro
  - Unificar `entityType` e `institution`
- **Número** (input text, opcional)
  - Manter `enunciadoNumber`

#### **Modo Manual - Campos Adicionais:**
- **Texto Completo** (textarea grande)
  - Só aparece no modo manual
  - Será salvo no campo `notes`
- **Observações Adicionais** (textarea pequeno, opcional)
  - Também vai para `notes`, concatenado

---

## 🎯 Estrutura Simplificada

### Formulário Unificado:

```
┌─────────────────────────────────────────┐
│ [Com Arquivo] [Manual]                  │ ← Modo
├─────────────────────────────────────────┤
│ Curso: [select] *                       │
│ Título: [input] *                       │
│ Descrição: [textarea pequeno]           │
│ Categoria: [select] *                   │
│   - Apostila                            │
│   - Acórdão                             │
│   - Parecer                             │
│   - Enunciados                          │
│   - Súmula                              │ ← NOVO
│   - Orientação Normativa                │
│   - Edital                              │
│   - Artigo                              │
│   - Outro                               │
│                                         │
│ ┌─ SE categoria = enunciados/súmula ─┐ │
│ │ Instituição: [select] *            │ │
│ │   - IBDA                           │ │
│ │   - INCP                           │ │
│ │   - CJF                            │ │
│ │   - Outro                          │ │
│ │ Número: [input] (opcional)         │ │
│ └────────────────────────────────────┘ │
│                                         │
│ ┌─ SE modo = arquivo ────────────────┐ │
│ │ Arquivo: [dropzone] *              │ │
│ └────────────────────────────────────┘ │
│                                         │
│ ┌─ SE modo = manual ─────────────────┐ │
│ │ Texto Completo: [textarea] *       │ │
│ │ Observações: [textarea] (opcional) │ │
│ └────────────────────────────────────┘ │
│                                         │
│ [ ] Documento público                   │
│ Artigos Lei 14.133: [selector]          │
│ Tags: [input]                           │
│                                         │
│ [Salvar Documento]                      │
└─────────────────────────────────────────┘
```

---

## 🔄 MUDANÇAS NECESSÁRIAS

### 1. Remover Campos Redundantes do Modo Manual
- ❌ Remover campo "Tipo" (enunciado/súmula)
- ❌ Remover campo "Instituição" duplicado
- ✅ Usar os campos condicionais já existentes

### 2. Adicionar "Súmula" na Lista de Categorias
```typescript
<option value="sumula">Súmula</option>
```

### 3. Ajustar Condição de Campos Específicos
```typescript
// De:
{formData.category === 'enunciados' && ...}

// Para:
{(formData.category === 'enunciados' || formData.category === 'sumula') && ...}
```

### 4. Unificar entityType/institution
- Usar apenas `entityType` em todo lugar
- Remover `institution` do formData

### 5. Simplificar Modo Manual
- Manter apenas 2 campos extras:
  - Texto Completo (obrigatório)
  - Observações (opcional)
- Ambos vão para o campo `notes`, concatenados

---

## 📊 Comparação: Antes vs Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Campos no modo manual** | 6 campos | 2 campos |
| **Campos redundantes** | 3 duplicados | 0 |
| **Categorias** | 8 | 9 (+ Súmula) |
| **Clareza** | Confusa | Clara |
| **Complexidade** | Alta | Baixa |

---

## ✅ BENEFÍCIOS

1. **Menos confusão** - um campo para cada coisa
2. **Mais simples** - menos campos para preencher
3. **Mais consistente** - mesmos campos em ambos os modos
4. **Mais flexível** - súmula como categoria própria
5. **Mais manutenível** - menos código duplicado

---

## 🚀 Implementação

### Passo 1: Adicionar Súmula às Categorias
- Adicionar opção no select de categoria

### Passo 2: Atualizar Type
```typescript
type DocumentCategory =
  'apostila' | 'acordao' | 'parecer' | 'edital' |
  'artigo' | 'orientacao-normativa' | 'enunciados' |
  'sumula' | // NOVO
  'outro';
```

### Passo 3: Ajustar Condição de Campos Específicos
- Mostrar campos de instituição/número para enunciados E súmulas

### Passo 4: Remover Campos Redundantes do Modo Manual
- Manter apenas "Texto Completo" e "Observações"
- Remover "Tipo" e "Instituição" do modo manual

### Passo 5: Remover do formData
```typescript
// Remover:
documentType?: 'enunciado' | 'sumula';
institution?: 'IBDA' | 'INCP' | 'CJF' | 'outro';

// Usar apenas:
entityType?: string; // Já existe
```

### Passo 6: Atualizar API
- Usar `entityType` em vez de `institution`
- Montar `notes` com textContent + notes do form
