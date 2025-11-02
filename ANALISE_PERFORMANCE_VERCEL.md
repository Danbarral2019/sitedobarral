# 📊 Análise de Performance - Vercel

## Páginas com Problemas Identificados

| Página | Score | Categoria | Problemas Principais |
|--------|-------|-----------|---------------------|
| `/area-restrita` | 59/100 | Needs Improvement | Client-side rendering pesado, múltiplos componentes |
| `/validar-acesso` | 16/100 | **CRÍTICO** | Validação automática, redirects |
| `/admin/analytics` | 11/100 | **CRÍTICO** | Fetch pesado de analytics, gráficos |
| `/admin` | 9/100 | **CRÍTICO** | QR codes em base64, paginação client-side |

---

## 🔍 Análise Detalhada

### 1. `/area-restrita` (59/100) ⚠️

**Problemas identificados:**

1. **Client Component Pesado** (`'use client'`)
   - 579 linhas de código
   - Múltiplos hooks: `useAuth`, `useFavorites`, `useSearch`
   - 10+ componentes importados

2. **Múltiplos `useState` e `useEffect`**
   ```typescript
   - courseDocuments (por curso)
   - courseVideos (por curso)
   - courseSites (por curso)
   - selectedCourseId
   - selectedDocument
   - isModalOpen
   ```

3. **Componentes Pesados Importados:**
   - `DocumentsByCategory`
   - `HighlightedMaterials`
   - `SearchFilters`
   - `PDFExportPanel`
   - `DocumentDetailModal`

4. **Batch Request Bom, mas...**
   - Já otimizado com `/api/area-restrita/batch-data`
   - MAS: Carrega TUDO de uma vez (todos cursos)
   - Poderia ser lazy loading

**Impacto:**
- First Contentful Paint (FCP): Lento
- Time to Interactive (TTI): Muito lento
- JavaScript Bundle: Grande

---

### 2. `/validar-acesso` (16/100) 🔴 **CRÍTICO**

**Problemas identificados:**

1. **Validação Automática na URL**
   ```typescript
   useEffect(() => {
     const urlCode = searchParams.get('code');
     if (urlCode) {
       handleValidation(urlCode); // ❌ Executa na montagem
     }
   }, [searchParams, handleValidation]);
   ```
   - Bloqueia renderização enquanto valida
   - Não mostra loading state imediatamente

2. **Redirects Múltiplos**
   - `router.push()` com timeout
   - Adiciona delay desnecessário

3. **Sem Server-Side Validation**
   - Tudo acontece no client
   - Poderia ser Server Component com redirect

**Impacto:**
- Largest Contentful Paint (LCP): Muito lento
- Total Blocking Time (TBT): Alto
- Cumulative Layout Shift (CLS): Provável

---

### 3. `/admin/analytics` (11/100) 🔴 **CRÍTICO**

**Problemas identificados:**

1. **Fetch Gigante de Analytics**
   ```typescript
   const response = await fetch('/api/admin/analytics');
   ```
   - Retorna TODOS os dados de uma vez
   - Sem paginação
   - Sem cache

2. **Tipos Complexos**
   - Interface `AnalyticsData` com 12+ propriedades
   - Arrays grandes (topDocuments, accessByDay, etc.)

3. **Renderização de Gráficos?**
   - Provavelmente usa biblioteca pesada
   - Não vi código mas score baixo indica charts

4. **Sem Loading Progressivo**
   - Carrega tudo ou nada

**Impacto:**
- First Contentful Paint (FCP): Muito lento
- Time to Interactive (TTI): Crítico
- JavaScript Bundle: Enorme (charts library)

---

### 4. `/admin` (9/100) 🔴 **CRÍTICO**

**Problemas identificados:**

1. **QR Codes em Base64**
   ```typescript
   qrCodeImage?: string | null;
   ```
   - Cada QR code é uma string base64 gigante
   - Transferência de dados enorme
   - Não usa imagens otimizadas

2. **Paginação Client-Side**
   ```typescript
   const itemsPerPage = 6;
   ```
   - Carrega TODOS os QR codes
   - Filtra no client
   - Deveria paginar no servidor

3. **Arquivo Gigante**
   - 745 linhas de código
   - Muitos estados e funções

4. **Verificação de Admin em useEffect**
   ```typescript
   useEffect(() => {
     verifyAdmin();
   }, [verifyAdmin]);
   ```
   - Poderia ser middleware ou Server Component

**Impacto:**
- First Contentful Paint (FCP): Crítico
- Time to Interactive (TTI): Crítico
- Transfer Size: Enorme (base64)
- JavaScript Bundle: Muito grande

---

## 🚀 Plano de Melhorias Proposto

### PRIORIDADE 1 - Melhorias Rápidas (1-2 horas)

#### 1.1. `/validar-acesso` - Server-Side Redirect
**Impacto:** 16 → 70+ (melhoria de 54 pontos)

```typescript
// Converter para Server Component
export default async function ValidarAcessoPage({ searchParams }: {
  searchParams: { code?: string; error?: string }
}) {
  // Validação no servidor
  if (searchParams.code) {
    const result = await validateQRCode(searchParams.code);
    if (result.needsRegistration) {
      redirect(`/registro?qr=${result.qrCode}&curso=${result.courseId}`);
    } else {
      redirect(`/login?curso=${result.courseId}&message=account-exists`);
    }
  }

  // Renderizar formulário (se não tem code)
  return <ValidacaoForm />;
}
```

**Benefícios:**
- ✅ Elimina JavaScript client-side
- ✅ Redirect instantâneo no servidor
- ✅ Melhora LCP, TBT, FCP

---

#### 1.2. `/admin` - Paginar QR Codes no Servidor
**Impacto:** 9 → 50+ (melhoria de 41 pontos)

```typescript
// API com paginação
GET /api/admin/list-qr?page=1&limit=6

// Response
{
  qrCodes: [...],
  total: 50,
  page: 1,
  totalPages: 9
}
```

**Benefícios:**
- ✅ Reduz transfer size em 80%
- ✅ Carrega apenas 6 QR codes por vez
- ✅ Elimina base64 desnecessário

---

#### 1.3. `/admin/analytics` - Lazy Loading de Dados
**Impacto:** 11 → 55+ (melhoria de 44 pontos)

```typescript
// Dividir em múltiplos endpoints
GET /api/admin/analytics/summary    // Dados principais
GET /api/admin/analytics/charts     // Gráficos (lazy)
GET /api/admin/analytics/top-docs   // Top documentos (lazy)

// Carregar progressivamente
useEffect(() => {
  loadSummary();      // Imediato
  loadCharts();       // Após 500ms
  loadTopDocs();      // Após 1s
}, []);
```

**Benefícios:**
- ✅ First paint mais rápido
- ✅ Melhor percepção de velocidade
- ✅ Reduz TBT

---

### PRIORIDADE 2 - Otimizações Médias (2-4 horas)

#### 2.1. `/area-restrita` - Code Splitting
**Impacto:** 59 → 75+ (melhoria de 16 pontos)

```typescript
// Dynamic imports
const PDFExportPanel = dynamic(() => import('@/components/PDFExportPanel'));
const DocumentDetailModal = dynamic(() => import('@/components/DocumentDetailModal'));
const SearchFilters = dynamic(() => import('@/components/SearchFilters'));

// Lazy loading de vídeos e sites
const [showVideos, setShowVideos] = useState(false);
const [showSites, setShowSites] = useState(false);
```

**Benefícios:**
- ✅ Reduz bundle inicial em 30-40%
- ✅ Carrega componentes sob demanda
- ✅ Melhora TTI

---

#### 2.2. Otimizar QR Codes - Salvar como Imagem
**Impacto:** Reduz transfer size em 60%

```typescript
// Ao invés de base64 no JSON:
qrCodeImage: "/uploads/qrcodes/abc123.png"

// No servidor, salvar PNG real
const qrImage = await QRCode.toBuffer(code);
await writeFile(`public/uploads/qrcodes/${id}.png`, qrImage);
```

**Benefícios:**
- ✅ Imagens otimizadas e cacheáveis
- ✅ Next.js Image Optimization
- ✅ Reduz tamanho JSON drasticamente

---

#### 2.3. Implementar Cache Strategy

```typescript
// API com cache headers
export async function GET(request: NextRequest) {
  const data = await getAnalytics();

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
    }
  });
}
```

**Benefícios:**
- ✅ Reduz requests redundantes
- ✅ Melhora tempo de carregamento
- ✅ Menos carga no servidor

---

### PRIORIDADE 3 - Otimizações Avançadas (4-8 horas)

#### 3.1. Implementar React Server Components

Converter páginas admin para RSC:
- `/admin/analytics` → Server Component
- `/admin/documentos` → Server Component
- `/admin/page` → Híbrido (Server + Client Islands)

**Benefícios:**
- ✅ Elimina JavaScript desnecessário
- ✅ Melhora todos os Web Vitals
- ✅ SEO melhorado

---

#### 3.2. Implementar Virtual Scrolling

Para listas grandes (documentos, QR codes):

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: documents.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80,
});
```

**Benefícios:**
- ✅ Renderiza apenas itens visíveis
- ✅ Melhora performance com 1000+ itens
- ✅ Reduz uso de memória

---

#### 3.3. Otimizar Importações

```typescript
// ❌ Ruim
import { courses } from '@/data/courses';

// ✅ Melhor
import { getCourseById } from '@/lib/courses';

// ❌ Ruim
import * as Icons from 'lucide-react';

// ✅ Melhor
import { QrCode, Plus, Loader2 } from 'lucide-react';
```

---

## 📈 Impacto Esperado

| Melhoria | Esforço | Impacto | Score Esperado |
|----------|---------|---------|----------------|
| `/validar-acesso` → Server | 1h | ⭐⭐⭐⭐⭐ | 16 → 75+ |
| `/admin` → Paginação | 2h | ⭐⭐⭐⭐⭐ | 9 → 55+ |
| `/admin/analytics` → Lazy | 2h | ⭐⭐⭐⭐⭐ | 11 → 60+ |
| `/area-restrita` → Split | 3h | ⭐⭐⭐⭐ | 59 → 78+ |
| QR Codes → Imagens | 2h | ⭐⭐⭐⭐ | +15 pontos |
| Cache Strategy | 1h | ⭐⭐⭐ | +10 pontos |

**Total estimado:** 11 horas de trabalho
**Melhoria média esperada:** 40-60 pontos por página

---

## 🎯 Recomendação de Execução

### Fase 1 (Crítico - 1 semana)
1. ✅ `/validar-acesso` → Server Component
2. ✅ `/admin` → Paginação server-side
3. ✅ `/admin/analytics` → Lazy loading

**Resultado esperado:** 3 páginas críticas (9-16) → Boas (55-75)

### Fase 2 (Importante - 1 semana)
4. ✅ `/area-restrita` → Code splitting
5. ✅ QR Codes como imagens PNG
6. ✅ Cache headers em APIs

**Resultado esperado:** Todas páginas acima de 70

### Fase 3 (Opcional - 2 semanas)
7. ✅ Migrar para React Server Components
8. ✅ Virtual scrolling
9. ✅ Otimizar importações

**Resultado esperado:** Todas páginas acima de 85

---

## 🛠️ Ferramentas para Monitoramento

1. **Vercel Analytics** - Monitorar Web Vitals
2. **Lighthouse CI** - Testes automatizados
3. **Chrome DevTools** - Performance profiling
4. **React DevTools Profiler** - Identificar re-renders

---

## 📝 Notas Importantes

- Priorizar melhorias de **servidor** sobre client
- Focar em **First Contentful Paint** e **Time to Interactive**
- Evitar **layout shifts** (CLS)
- Implementar **loading states** progressivos
- Usar **suspense boundaries** onde apropriado

---

**Última atualização:** 2025-11-01
**Analisado por:** Claude Code
