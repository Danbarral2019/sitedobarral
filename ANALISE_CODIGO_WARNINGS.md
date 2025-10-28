# Análise de Código e Recomendações de Melhorias

**Data:** 2025-10-28
**Build analisado:** Vercel Deploy Log (commit 75d229a)

## Resumo Executivo

A análise do build revelou **45 warnings do ESLint** distribuídos em 17 arquivos. Nenhum erro crítico foi encontrado, mas há oportunidades significativas de melhoria em:

- **Qualidade do código**: Variáveis não utilizadas e dependências de hooks faltantes
- **Performance**: Uso de `<img>` ao invés de `<Image />` do Next.js
- **Manutenibilidade**: Código duplicado e lógica espalhada

## 📊 Estatísticas de Warnings

| Tipo de Warning | Quantidade | Prioridade |
|----------------|------------|------------|
| Variáveis não utilizadas | 23 | Média |
| Dependências de React Hooks faltantes | 8 | **Alta** |
| Uso de `<img>` ao invés de `<Image />` | 2 | **Alta** |
| Tipos não utilizados | 12 | Baixa |

---

## 🔴 PRIORIDADE ALTA (Impacto em Performance/Bugs)

### 1. Dependências Faltantes em React Hooks

**Impacto:** Pode causar bugs sutis, re-renderizações desnecessárias ou estados desatualizados.

#### Arquivos Afetados:

**`app/admin/documentos/[id]/edit/page.tsx:100`**
```typescript
// ❌ PROBLEMA:
useEffect(() => {
  loadDocument();
}, [documentId]); // Faltando 'loadDocument' nas dependências

// ✅ SOLUÇÃO:
useEffect(() => {
  loadDocument();
}, [documentId, loadDocument]);

// Ou melhor: mover loadDocument para dentro do useEffect
useEffect(() => {
  const loadDocument = async () => {
    // ...lógica de carregamento
  };
  loadDocument();
}, [documentId]);
```

**`app/admin/newsletter/page.tsx:63`**
```typescript
// ❌ PROBLEMA:
const loadSubscribers = useCallback(async () => {
  // ...código
  calculateStats(data.subscribers);
}, [filter, errorToast]); // Faltando 'calculateStats'

// ✅ SOLUÇÃO:
const loadSubscribers = useCallback(async () => {
  // ...código
  calculateStats(data.subscribers);
}, [filter, errorToast, calculateStats]);
```

**`components/DocumentNotesEditor.tsx:44`**
```typescript
// ❌ PROBLEMA:
useEffect(() => {
  loadNotes();
}, [documentId]); // Faltando 'loadNotes'

// ✅ SOLUÇÃO: Mover função para dentro do useEffect
useEffect(() => {
  const loadNotes = async () => {
    // ...código
  };
  loadNotes();
}, [documentId]);
```

**`components/TestimonialsCarousel.tsx:66`**
```typescript
// ❌ PROBLEMA:
useEffect(() => {
  if (!isAutoPlaying) return;
  const interval = setInterval(() => {
    goToNext();
  }, 5000);
  return () => clearInterval(interval);
}, [currentIndex, isAutoPlaying]); // Faltando 'goToNext'

// ✅ SOLUÇÃO:
useEffect(() => {
  if (!isAutoPlaying) return;
  const interval = setInterval(() => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  }, 5000);
  return () => clearInterval(interval);
}, [currentIndex, isAutoPlaying, testimonials.length]);
```

**`app/area-restrita/page.tsx:156`**
```typescript
// ❌ PROBLEMA: Expressão lógica complexa dentro de useMemo
const selectedCourseDocuments = useMemo(
  () => {
    const docs = selectedCourseId && isSelectedCourseEnrolled
      ? (courseDocuments[selectedCourseId] || [])
      : [];
    return docs;
  },
  [selectedCourseId, isSelectedCourseEnrolled, courseDocuments]
);
// Warning: 'userEnrollments' pode mudar a cada render

// ✅ SOLUÇÃO: Garantir que userEnrollments seja estável
const userEnrollments = useMemo(
  () => user?.enrollments || [],
  [user?.enrollments]
);
```

**`components/WordUploader.tsx:109, 116`**
```typescript
// ❌ PROBLEMA:
const onDrop = useCallback((acceptedFiles: File[]) => {
  processFile(acceptedFiles[0]);
}, []); // Faltando 'processFile'

// ✅ SOLUÇÃO:
const onDrop = useCallback((acceptedFiles: File[]) => {
  processFile(acceptedFiles[0]);
}, [processFile]);
```

---

### 2. Uso de `<img>` ao invés de `<Image />` do Next.js

**Impacto:** Performance ruim (LCP alto, mais bandwidth, sem otimização automática)

#### Arquivos Afetados:

**`app/admin/videos/page.tsx:200`**
```typescript
// ❌ PROBLEMA:
<img src={getThumbnailUrl(video)} alt={video.title} />

// ✅ SOLUÇÃO:
import Image from 'next/image';

<Image
  src={getThumbnailUrl(video)}
  alt={video.title}
  width={640}
  height={360}
  className="w-full h-full object-cover"
  loading="lazy"
/>
```

**`components/CourseVideos.tsx:75`**
```typescript
// ❌ PROBLEMA:
<img
  src={getThumbnailUrl(video)}
  alt={video.title}
  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
/>

// ✅ SOLUÇÃO:
import Image from 'next/image';

<Image
  src={getThumbnailUrl(video)}
  alt={video.title}
  width={640}
  height={360}
  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
  loading="lazy"
/>
```

---

## 🟡 PRIORIDADE MÉDIA (Qualidade do Código)

### 3. Variáveis Não Utilizadas

Estas variáveis poluem o código e podem causar confusão. Recomendação: **Remover todas**.

#### Arquivos Afetados:

**`app/admin/documentos/[id]/edit/page.tsx`**
- Linha 7: `Upload` (importado mas não usado)
- Linha 81: `uploadingFile`, `setUploadingFile` (estado declarado mas não usado)

**`app/admin/tcu-manager/page.tsx`**
- Linha 127: `convertedData` (atribuído mas não usado)
- Linha 135: `setIsEnriching` (não usado)
- Linha 137: `setEnrichmentProgress` (não usado)

**`app/api/admin/tcu-manager/classify/route.ts`**
- Linha 6: `TCUClassificationResult` (tipo não usado)
- Linha 58: `processedCount` (atribuído mas não usado)
- Linha 61: `result` (não usado no loop)

**`app/api/admin/tcu-manager/enrich/route.ts`**
- Linha 6: `TCUEnrichmentResult` (tipo não usado)
- Linha 52: `processedCount` (atribuído mas não usado)
- Linha 56: `result` (não usado no loop)

**`app/api/admin/tcu-manager/validate/route.ts`**
- Linha 202: `err` (parâmetro do catch não usado)

**`app/api/export-pdf/route.ts`**
- Linha 26: `userEmail` (atribuído mas não usado)
- Linha 235: `e` (parâmetro do catch não usado)

**`components/BatchClassifyPanel.tsx`**
- Linha 151: `getConfidenceColor` (função declarada mas não usada)

**`components/CoursesSidebar.tsx`**
- Linha 26: `isOpen` (estado não usado)

**`components/SummaryGenerator.tsx`**
- Linha 4: `Edit2` (importado mas não usado)
- Linha 25: `documentTitle` (prop não usada)

**`components/RecommendedSites.tsx`**
- Linha 24: `getDomain` (função não usada)

**`components/ui/toast.tsx`**
- Linhas 12, 57, 69, 84, 96: `_className` (parâmetros não usados em múltiplos componentes)

**`lib/claude-classifier.ts`**
- Linha 46: `LEI_14133_KEY_ARTICLES` (constante não usada)

**`lib/tcu-classifier.ts`**
- Linha 61: `enrichment` (atribuído mas não usado)

**`lib/tcu-scraper.ts`**
- Linha 480: `enunciado` (atribuído mas não usado)
- Linha 588: `tryEnrichFromWebsite` (função não usada)
- Linha 590: `enunciadoExistente` (não usado)

---

## 🟢 PRIORIDADE BAIXA (Limpeza)

### 4. Parâmetros Não Utilizados em Catches

Alguns blocos `catch` declaram o erro mas não o usam. Considere:
- Usar `catch {}` se não precisa do erro
- Ou usar o erro para logging adequado

**Exemplo:**
```typescript
// ❌ PROBLEMA:
try {
  // ...
} catch (err) { // 'err' não usado
  console.log('Erro genérico');
}

// ✅ SOLUÇÃO 1: Usar o erro
try {
  // ...
} catch (err) {
  console.error('Erro específico:', err);
}

// ✅ SOLUÇÃO 2: Remover parâmetro
try {
  // ...
} catch {
  console.log('Erro genérico');
}
```

---

## 🏗️ RECOMENDAÇÕES DE ARQUITETURA

### 1. ✅ Performance - Batch Requests (JÁ IMPLEMENTADO)

**Localização:** `app/area-restrita/page.tsx:111-149`

**Análise:** Excelente otimização! O código usa um único request batch para buscar documentos, vídeos e sites de todos os cursos matriculados, reduzindo de 15+ requests para 1 único request.

```typescript
// ANTES: ~15-20 requests individuais
for (const courseId of enrolledCourseIds) {
  await fetch(`/api/documents?courseId=${courseId}`);
  await fetch(`/api/course-videos?courseId=${courseId}`);
  await fetch(`/api/recommended-sites?courseId=${courseId}`);
}

// AGORA: 1 único request batch ✅
const courseIdsParam = enrolledCourseIds.join(',');
const response = await fetch(`/api/area-restrita/batch-data?courseIds=${courseIdsParam}`);
```

**Impacto:** Redução drástica no tempo de carregamento inicial da área restrita.

---

### 2. ⚠️ Duplicação de Lógica de Autenticação

**Problema:** Lógica de autenticação e verificação de matrícula está espalhada em múltiplos componentes.

**Arquivos afetados:**
- `app/area-restrita/page.tsx`
- `app/area-restrita/favoritos/page.tsx`
- `app/area-restrita/historico/page.tsx`

**Recomendação:** Criar um hook customizado `useEnrollmentGuard`:

```typescript
// hooks/use-enrollment-guard.ts
export function useEnrollmentGuard(requiredCourseId?: string) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }

    if (requiredCourseId && user && !isEnrolledInCourse(user, requiredCourseId)) {
      router.push(`/area-restrita/curso-bloqueado?courseId=${requiredCourseId}`);
    }
  }, [isLoading, user, requiredCourseId, router]);

  return { user, isLoading, isEnrolled: /* ... */ };
}
```

---

### 3. 🔄 State Management - React Query (Opcional)

**Problema:** Múltiplas chamadas fetch manuais com estado local (`useState`, `useEffect`).

**Recomendação:** Considerar usar **React Query (TanStack Query)** para:
- Cache automático de dados
- Refetch em background
- Estados de loading/error unificados
- Menos código boilerplate

**Exemplo de refatoração:**

```typescript
// ANTES:
const [documents, setDocuments] = useState([]);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  async function fetchDocs() {
    setIsLoading(true);
    const res = await fetch(`/api/documents?courseId=${courseId}`);
    const data = await res.json();
    setDocuments(data.documents);
    setIsLoading(false);
  }
  fetchDocs();
}, [courseId]);

// DEPOIS (com React Query):
const { data: documents, isLoading } = useQuery(
  ['documents', courseId],
  () => fetch(`/api/documents?courseId=${courseId}`).then(r => r.json())
);
```

**Benefícios:**
- Cache inteligente (evita refetch desnecessário)
- Sincronização automática entre componentes
- Retry automático em caso de erro
- Menos código para escrever

---

### 4. 📝 Type Safety - Schemas Compartilhados

**Problema:** Interfaces TypeScript duplicadas entre frontend e API routes.

**Exemplo:** Interface `Document` definida em vários lugares:
- `app/admin/documentos/[id]/edit/page.tsx`
- `app/area-restrita/page.tsx`
- `types/document.ts`

**Recomendação:** Centralizar tipos em `types/` e usar Zod para validação:

```typescript
// types/schemas/document.ts
import { z } from 'zod';

export const DocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: z.enum(['pdf', 'doc', 'link', 'video']),
  category: z.enum(['apostila', 'acordao', 'parecer', /* ... */]),
  // ...resto dos campos
});

export type Document = z.infer<typeof DocumentSchema>;

// Usar nos API routes:
const body = DocumentSchema.parse(await request.json());
```

---

### 5. 🎨 Componente `<img>` Customizado (Workaround)

Se houver problemas com `next/image` em URLs externas (ex: YouTube thumbnails), criar wrapper:

```typescript
// components/OptimizedImage.tsx
import Image from 'next/image';

export function OptimizedImage({
  src,
  alt,
  className,
  fallbackToImg = false
}: Props) {
  // Tenta usar next/image, mas fallback para <img> se necessário
  if (fallbackToImg || isExternalUrl(src)) {
    return <img src={src} alt={alt} className={className} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={640}
      height={360}
      className={className}
    />
  );
}
```

---

## 📋 Plano de Ação Recomendado

### Fase 1: Correções Críticas (1-2 horas)
1. ✅ Corrigir todas as dependências de React Hooks
2. ✅ Substituir `<img>` por `<Image />` (ou wrapper customizado)
3. ✅ Remover variáveis não utilizadas

### Fase 2: Limpeza de Código (30 min)
4. ✅ Remover imports não usados
5. ✅ Adicionar `eslint-disable-next-line` comentários onde necessário
6. ✅ Rodar `npm run lint -- --fix` para auto-correções

### Fase 3: Melhorias Arquiteturais (Opcional, 2-4 horas)
7. ⚪ Extrair lógica de autenticação para hook customizado
8. ⚪ Avaliar adoção de React Query (se o time concordar)
9. ⚪ Centralizar schemas TypeScript com Zod

---

## 🎯 Impacto Esperado

Após implementar as correções da **Fase 1 e 2**:

- ✅ **Build limpo** sem warnings do ESLint
- ✅ **Performance melhorada** com otimização de imagens
- ✅ **Código mais confiável** com dependências de hooks corretas
- ✅ **Manutenibilidade aumentada** com menos código morto

Após **Fase 3** (opcional):

- ✅ **Menos código duplicado**
- ✅ **Melhor experiência de desenvolvimento**
- ✅ **Carregamento mais rápido com cache inteligente**

---

## 📊 Métricas Atuais vs. Esperadas

| Métrica | Atual | Após Correções |
|---------|-------|----------------|
| Warnings ESLint | 45 | 0 |
| Imports não usados | 23 | 0 |
| Problemas de hooks | 8 | 0 |
| Performance LCP (estimado) | ~3.5s | ~2.0s |

---

## 🚀 Próximos Passos

1. **Revisar este documento** com a equipe
2. **Priorizar correções** (Fase 1 é obrigatória, Fase 3 é opcional)
3. **Criar branch** para implementação: `fix/eslint-warnings-cleanup`
4. **Implementar correções** gradualmente
5. **Testar build** após cada lote de mudanças
6. **Fazer PR** com resumo das melhorias

---

**Gerado por:** Claude Code
**Data:** 2025-10-28
**Build analisado:** Vercel (commit 75d229a)
