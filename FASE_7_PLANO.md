# 📋 Fase 7: Refatoração Client → Server Components
## Estratégia: Hybrid (Server Container + URL State)

**Recomendação do Gemini:** ⭐ **APROVADA**

### Por que Híbrido?
1. ✅ **Baixo risco:** Implementação incremental, página por página
2. ✅ **Performance:** Server-side data fetching + URL state eliminam waterfalls
3. ✅ **UX melhorada:** Estados bookmarkable, shareable, persistentes
4. ✅ **Código limpo:** Uma única fonte de verdade para dados (servidor)
5. ✅ **Manutenibilidade:** Elimina `useEffect` redundantes

---

## 🎯 Páginas Prioritárias (26 páginas admin)

### Grupo 1: ALTA PRIORIDADE (Muito usadas, filtros complexos)
| Página | useEffect | Complexidade | Impacto |
|--------|-----------|--------------|---------|
| `app/admin/documentos/page.tsx` | 4 | 🔴 Alta | Crítica |
| `app/admin/documentos-pendentes/page.tsx` | 2 | 🟡 Média | Alta |
| `app/admin/publicacoes/page.tsx` | 3 | 🟡 Média | Média |
| `app/admin/assistente-social/page.tsx` | 3 | 🟡 Média | Média |

**Total Grupo 1:** 4 páginas

### Grupo 2: MÉDIA PRIORIDADE (Listas CRUD)
| Página | useEffect | Complexidade | Impacto |
|--------|-----------|--------------|---------|
| `app/admin/page.tsx` (QR Codes) | 2 | 🟡 Média | Alta |
| `app/admin/blog/page.tsx` | 2 | 🟢 Baixa | Média |
| `app/admin/legislacao/page.tsx` | 2 | 🟢 Baixa | Média |
| `app/admin/glossario/page.tsx` | 2 | 🟢 Baixa | Média |
| `app/admin/faq/page.tsx` | 2 | 🟢 Baixa | Média |
| `app/admin/sites/page.tsx` | 2 | 🟢 Baixa | Baixa |
| `app/admin/contatos/page.tsx` | 2 | 🟢 Baixa | Baixa |
| `app/admin/depoimentos/page.tsx` | 2 | 🟢 Baixa | Baixa |
| `app/admin/newsletter/page.tsx` | 2 | 🟢 Baixa | Baixa |

**Total Grupo 2:** 9 páginas

### Grupo 3: BAIXA PRIORIDADE (Utilitários, pages simples)
| Página | useEffect | Complexidade | Impacto |
|--------|-----------|--------------|---------|
| `app/admin/analytics/page.tsx` | 2 | 🟢 Baixa | Baixa |
| `app/admin/analytics-documentos/page.tsx` | 2 | 🟢 Baixa | Baixa |
| `app/admin/videos/page.tsx` | 2 | 🟢 Baixa | Baixa |
| `app/admin/tcu-manager/page.tsx` | - | 🟢 Baixa | Baixa |
| `app/admin/tcu-import/page.tsx` | - | 🟢 Baixa | Baixa |
| `app/admin/tcu-converter/page.tsx` | - | 🟢 Baixa | Baixa |
| `app/admin/agu-import/page.tsx` | - | 🟢 Baixa | Baixa |
| `app/admin/scraper-agu/page.tsx` | - | 🟢 Baixa | Baixa |
| `app/admin/dou-filtros/page.tsx` | - | 🟢 Baixa | Baixa |
| `app/admin/importar/page.tsx` | 2 | 🟢 Baixa | Baixa |

**Total Grupo 3:** 10 páginas

### Grupo 4: EDIT/NEW PAGES (Formulários - manter Client)
| Página | Ação |
|--------|------|
| `app/admin/*/new/page.tsx` | ⏸️ **MANTER CLIENT** (forms precisam de estado) |
| `app/admin/*/[id]/edit/page.tsx` | ⏸️ **MANTER CLIENT** (forms precisam de estado) |
| `app/admin/blog/upload-word/page.tsx` | ⏸️ **MANTER CLIENT** (upload) |

**Total Grupo 4:** 3 páginas (não refatorar)

---

## 📦 Arquitetura da Solução

### 1. Helper: URL State Management (`lib/url-state.ts`)
```typescript
import { ReadonlyURLSearchParams } from 'next/navigation';

export function buildSearchParams(
  current: ReadonlyURLSearchParams,
  updates: Record<string, string | number | null>
): string {
  const params = new URLSearchParams(current);

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  });

  return params.toString();
}

export function getSearchParam(
  searchParams: ReadonlyURLSearchParams,
  key: string,
  defaultValue: string = ''
): string {
  return searchParams.get(key) || defaultValue;
}

export function getNumberParam(
  searchParams: ReadonlyURLSearchParams,
  key: string,
  defaultValue: number = 1
): number {
  const value = searchParams.get(key);
  const parsed = value ? parseInt(value, 10) : defaultValue;
  return isNaN(parsed) ? defaultValue : parsed;
}
```

### 2. Pattern: Server Container + Client UI

**ANTES:**
```typescript
'use client';
export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch(`/api/users?filter=${filter}`)
      .then(r => r.json())
      .then(data => setUsers(data));
  }, [filter]);

  return <UserList users={users} onFilterChange={setFilter} />;
}
```

**DEPOIS:**
```typescript
// app/users/page.tsx (Server Component)
import { fetchUsers } from '@/lib/data';
import UsersPageClient from './UsersPageClient';

export default async function UsersPage({ searchParams }) {
  const filter = searchParams.filter || '';
  const page = parseInt(searchParams.page || '1');

  const users = await fetchUsers({ filter, page });

  return <UsersPageClient users={users} />;
}

// app/users/UsersPageClient.tsx (Client Component)
'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { buildSearchParams } from '@/lib/url-state';

export default function UsersPageClient({ users }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilterChange = (filter: string) => {
    const query = buildSearchParams(searchParams, { filter, page: null });
    router.replace(`${pathname}?${query}`);
  };

  return <UserList users={users} onFilterChange={handleFilterChange} />;
}
```

---

## 🚀 Plano de Implementação

### Sprint 1: Fundação (30 min)
- [x] ✅ Criar `lib/url-state.ts`
- [ ] ⏳ Refatorar `app/admin/documentos-pendentes/page.tsx` (exemplo piloto)
- [ ] ⏳ Testar padrão e validar abordagem

### Sprint 2: Alta Prioridade (2h)
- [ ] ⏳ Refatorar `app/admin/documentos/page.tsx`
- [ ] ⏳ Refatorar `app/admin/publicacoes/page.tsx`
- [ ] ⏳ Refatorar `app/admin/assistente-social/page.tsx`

### Sprint 3: Média Prioridade (3h)
- [ ] ⏳ Refatorar 9 páginas do Grupo 2 (CRUD listas)

### Sprint 4: Baixa Prioridade (2h)
- [ ] ⏳ Refatorar 10 páginas do Grupo 3 (utilitários)

### Sprint 5: Validação (1h)
- [ ] ⏳ Testar todas as páginas refatoradas
- [ ] ⏳ Verificar performance (Lighthouse)
- [ ] ⏳ Criar checkpoint

**Tempo total estimado:** 8-10 horas

---

## ✅ Checklist de Refatoração (Por Página)

### Passo 1: Análise
- [ ] Identificar estado que vai para URL (`useState` de filtros/paginação)
- [ ] Identificar estado que fica cliente (`useState` de modais, loading local)
- [ ] Listar `useEffect` que fazem fetch (remover)
- [ ] Listar `useEffect` legítimos (manter)

### Passo 2: Server Component
- [ ] Criar função de data fetching em `lib/` (se não existir)
- [ ] Converter `page.tsx` para async Server Component
- [ ] Ler `searchParams` e passar para data fetching
- [ ] Passar dados como props para Client Component

### Passo 3: Client Component
- [ ] Renomear componente original para `*PageClient.tsx`
- [ ] Adicionar `'use client'`
- [ ] Receber dados via props (não mais `useState` + `useEffect`)
- [ ] Usar `useRouter`, `usePathname`, `useSearchParams` para URL state
- [ ] Substituir `setState` por `router.replace()` com `buildSearchParams()`
- [ ] Manter estado local para modais, toasts, etc.

### Passo 4: Teste
- [ ] Build local (`npm run build`)
- [ ] Testar filtros, paginação, busca
- [ ] Testar modais, toasts, ações
- [ ] Verificar hydration warnings no console

---

## 📊 Métricas de Sucesso

### Performance
- **Antes:** TTI ~2.5s, LCP ~2.0s, JS bundle ~800KB
- **Meta:** TTI <1.5s, LCP <1.2s, JS bundle <600KB

### Código
- **Antes:** 56 `useEffect` em páginas admin
- **Meta:** <20 `useEffect` (apenas interatividade legítima)

### Arquitetura
- **Antes:** 100% Client Components
- **Meta:** ~60% Server Components, 40% Client islands

---

## 🚨 Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Hydration mismatch | Média | Alto | Usar `searchParams` como SSoT, testar intensamente |
| Quebrar autenticação | Baixa | Crítico | Middleware já protege, não tocar em auth |
| Performance pior (latência) | Baixa | Médio | Next.js soft navigation + caching |
| Estado perdido em modais | Média | Médio | Manter modals 100% client-side com `useState` |

---

**Criado:** 2025-11-04
**Estratégia:** Gemini-approved Hybrid Pattern
**Status:** 🚀 Pronto para implementação
