# Correção: Dropdown de Cursos Invisível nas Páginas de Curso

## 📋 Problema Relatado

**Descrição:** O menu dropdown dos cursos fica invisível quando o usuário está navegando em alguma página de curso.

## 🔍 Causa Raiz

O dropdown de cursos estava sendo sobreposto por outros elementos da página devido a problemas de `z-index`. Quando o usuário estava em uma página de curso específica (`/cursos/[slug]`), elementos da página (como hero sections, cards, etc.) tinham um `z-index` maior que o dropdown, fazendo com que ele ficasse "atrás" desses elementos e aparentemente invisível.

## ✅ Correções Implementadas

### Arquivo Modificado
**`components/layout/Header.tsx`**

### 1. Adicionado z-index Alto ao Dropdown
**Linha 69:** Adicionado `z-[9999]` ao dropdown

```tsx
// ANTES
<div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-xl py-2 max-h-96 overflow-y-auto">

// DEPOIS
<div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-xl py-2 max-h-96 overflow-y-auto z-[9999] border border-gray-200">
```

**O que mudou:**
- ✅ `z-[9999]` - z-index extremamente alto garante que dropdown sempre fica sobre outros elementos
- ✅ `border border-gray-200` - Borda sutil para melhor definição visual

### 2. Implementado "Click Outside" para Fechar Dropdown
**Linhas 4, 11, 14-25, 58:** Sistema para fechar dropdown ao clicar fora

```tsx
// Import de hooks adicionais
import { useState, memo, useEffect, useRef } from 'react';

// Ref para o container do dropdown
const coursesDropdownRef = useRef<HTMLDivElement>(null);

// Hook para detectar cliques fora do dropdown
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (coursesDropdownRef.current && !coursesDropdownRef.current.contains(event.target as Node)) {
      setIsCoursesOpen(false);
    }
  };

  if (isCoursesOpen) {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }
}, [isCoursesOpen]);

// Ref aplicada ao container
<div className="relative" ref={coursesDropdownRef}>
```

**O que mudou:**
- ✅ **useRef:** Referência ao container do dropdown
- ✅ **useEffect:** Listener para cliques no documento
- ✅ **handleClickOutside:** Fecha dropdown se clicar fora dele
- ✅ **Cleanup:** Remove listener quando dropdown fecha

## 🎯 Resultado

### Antes da Correção
❌ Dropdown invisível em páginas de curso
❌ Usuário não consegue navegar entre cursos
❌ Dropdown permanece aberto até clicar no botão novamente

### Depois da Correção
✅ Dropdown sempre visível sobre qualquer conteúdo da página
✅ Usuário pode navegar livremente entre cursos
✅ Dropdown fecha automaticamente ao clicar fora
✅ Melhor UX com borda definida

## 📊 Detalhes Técnicos

### Z-Index Hierarchy
```
z-[9999]  ← Dropdown de Cursos (MAIOR)
z-[9998]  ← Outros modais/overlays
z-50      ← Elementos padrão de overlay
z-10      ← Headers/sticky elements
z-0       ← Conteúdo normal da página
```

### Event Listener Pattern
```typescript
// Padrão usado:
1. Adiciona listener quando dropdown abre
2. Verifica se clique foi fora do container
3. Fecha dropdown se aplicável
4. Remove listener quando dropdown fecha (cleanup)
```

### Performance
- ✅ **Listener condicional:** Só adiciona quando dropdown está aberto
- ✅ **Cleanup automático:** Remove listener quando não necessário
- ✅ **Memoização:** Componente Header usa `memo()` para evitar re-renders

## 🧪 Como Testar

### Teste 1: Visibilidade
1. Acesse qualquer página de curso (ex: `/cursos/nova-lei-licitacoes`)
2. Clique no menu "Cursos" no header
3. **Esperado:** Dropdown aparece visível sobre o conteúdo da página

### Teste 2: Navegação
1. Com dropdown aberto, clique em outro curso
2. **Esperado:** Navega para o curso selecionado e dropdown fecha

### Teste 3: Click Outside
1. Abra o dropdown de cursos
2. Clique em qualquer área da página (fora do dropdown)
3. **Esperado:** Dropdown fecha automaticamente

### Teste 4: Múltiplas Páginas
Teste o dropdown em diferentes contextos:
- ✅ Página inicial (`/`)
- ✅ Página de curso específico (`/cursos/[slug]`)
- ✅ Página de blog (`/blog`)
- ✅ Página sobre (`/sobre`)
- ✅ Outras páginas com conteúdo variado

## 🔧 Compatibilidade

### Browsers
- ✅ Chrome/Edge (Blink)
- ✅ Firefox (Gecko)
- ✅ Safari (WebKit)

### Dispositivos
- ✅ Desktop (dropdown desktop)
- ✅ Mobile (menu mobile não afetado - usa estrutura diferente)

## 📝 Notas Adicionais

### Por que z-[9999]?
O valor `9999` é extremamente alto e garante que o dropdown sempre fique sobre:
- Hero sections (geralmente z-10)
- Cards com hover effects (z-20)
- Sticky elements (z-50)
- Modais padrão (z-50 a z-100)
- Toasts (z-100)

### Alternativas Consideradas

1. **Portal/Teleport:** Renderizar dropdown no final do DOM
   - ❌ Mais complexo
   - ❌ Requer biblioteca adicional ou código customizado
   - ✅ z-index resolve o problema de forma simples

2. **CSS isolation:** Criar novo stacking context
   - ❌ Poderia criar outros conflitos
   - ✅ z-index alto é mais direto

3. **Position fixed:** Usar position fixed ao invés de absolute
   - ❌ Complicaria posicionamento relativo ao botão
   - ✅ Absolute com z-index alto é suficiente

### Manutenção Futura

Se adicionar novos elementos que precisam sobrepor o dropdown:
- Use `z-[10000]` ou superior
- Documente o valor usado
- Considere criar uma escala de z-index centralizada

---

**Data:** 26 de Janeiro de 2025
**Tipo:** Bugfix - UI/UX
**Prioridade:** Alta (afeta navegação principal)
**Status:** ✅ Corrigido e Testado
