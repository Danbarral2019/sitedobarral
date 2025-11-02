# Fases 2 e 3 - Otimizações de Performance Futuras

> **Status:** Planejado para implementação futura
> **Referência:** ANALISE_PERFORMANCE_VERCEL.md
> **Fase 1:** ✅ Concluída em 2025-11-01

---

## 📋 Fase 2 - Melhorias Adicionais (8-12 horas)

**Quando implementar:** Se os scores das páginas não atingirem 70+ após deploy da Fase 1

### 2.1. Code Splitting em `/area-restrita`

**Problema:**
- Componentes pesados carregados de uma vez
- Video.js bundle muito grande (~150KB)
- Filtros complexos carregados mesmo se não usados

**Solução:**
```typescript
// Dynamic imports para componentes pesados
const VideoPlayer = dynamic(() => import('@/components/VideoPlayer'), {
  loading: () => <div>Carregando player...</div>,
  ssr: false
});

const DocumentFilters = dynamic(() => import('@/components/DocumentFilters'), {
  loading: () => <div>Carregando filtros...</div>
});

// Lazy load de bibliotecas pesadas
import('video.js').then(videojs => {
  // Usar apenas quando necessário
});
```

**Ganho esperado:** +15 pontos no score
**Tempo estimado:** 3-4 horas

---

### 2.2. Otimização de Imagens QR Code

**Problema:**
- QR codes armazenados como base64 no banco
- Transferidos em TODAS as requisições
- Não podem ser cacheados pelo browser
- ~10-15KB por QR code

**Solução:**
1. **Converter base64 para arquivos PNG**
   ```typescript
   // No momento da geração do QR
   const qrCodeBuffer = await qrcode.toBuffer(code, { width: 300 });
   const filename = `qr-${code}.png`;
   await fs.writeFile(`public/qrcodes/${filename}`, qrCodeBuffer);

   // Salvar apenas URL no banco
   await prisma.qRCode.create({
     data: {
       code,
       qrCodeUrl: `/qrcodes/${filename}`, // Ao invés de base64
       // ...
     }
   });
   ```

2. **Servir via URL estática**
   ```typescript
   // Na listagem de QR codes
   <img
     src={qrCode.qrCodeUrl}
     alt="QR Code"
     loading="lazy"
     width={200}
     height={200}
   />
   ```

3. **Adicionar cache headers**
   ```typescript
   // next.config.js
   async headers() {
     return [
       {
         source: '/qrcodes/:path*',
         headers: [
           {
             key: 'Cache-Control',
             value: 'public, max-age=31536000, immutable',
           },
         ],
       },
     ];
   }
   ```

**Ganho esperado:** +10 pontos no /admin
**Tempo estimado:** 2-3 horas

**Migração de dados existentes:**
```javascript
// scripts/migrate-qrcodes-to-files.js
const qrCodes = await prisma.qRCode.findMany();

for (const qr of qrCodes) {
  if (qr.qrCodeImage) {
    // Converter base64 para buffer
    const base64Data = qr.qrCodeImage.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Salvar como arquivo
    const filename = `qr-${qr.code}.png`;
    await fs.writeFile(`public/qrcodes/${filename}`, buffer);

    // Atualizar banco
    await prisma.qRCode.update({
      where: { id: qr.id },
      data: {
        qrCodeUrl: `/qrcodes/${filename}`,
        qrCodeImage: null, // Remover base64
      }
    });
  }
}
```

---

### 2.3. Cache Headers Otimizados

**Problema:**
- Páginas estáticas sem cache adequado
- Revalidações desnecessárias
- CDN não aproveitado

**Solução:**
```typescript
// app/cursos/[slug]/page.tsx
export const revalidate = 3600; // ISR: 1 hora

// app/blog/[slug]/page.tsx
export const revalidate = 7200; // ISR: 2 horas

// app/publicacoes/page.tsx
export const revalidate = 86400; // ISR: 24 horas

// next.config.js
async headers() {
  return [
    {
      source: '/cursos/:slug',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      ],
    },
    {
      source: '/blog/:slug',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=7200, stale-while-revalidate=14400',
        },
      ],
    },
  ];
}
```

**Ganho esperado:** +5-10 pontos globalmente
**Tempo estimado:** 2-3 horas

---

### 2.4. Prefetch de Recursos Críticos

**Problema:**
- Fonts e ícones carregados tarde
- CSS crítico não inline
- LCP bloqueado por recursos externos

**Solução:**
```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {/* Preconnect para domínios externos */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />

        {/* Preload de fonts críticas */}
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

        {/* Inline critical CSS */}
        <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Ganho esperado:** +5 pontos no FCP/LCP
**Tempo estimado:** 2 horas

---

## 📋 Fase 3 - Refatoração Profunda (20-30 horas)

**Quando implementar:** Para atingir scores 90+ (excelência)

### 3.1. Server Components Migration - `/area-restrita`

**Problema:**
- Página inteira é Client Component
- Busca de documentos no client-side
- Bundle JavaScript muito pesado
- Hooks desnecessários no servidor

**Solução:**
```typescript
// app/area-restrita/page.tsx (Server Component)
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AreaRestritaClient from './AreaRestritaClient';

export default async function AreaRestritaPage() {
  // Autenticação no servidor
  const token = cookies().get('auth-token')?.value;
  if (!token) redirect('/login');

  const user = await verifyToken(token);
  if (!user) redirect('/login');

  // Buscar documentos no servidor
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.userId },
    include: { qrCode: true }
  });

  const courseIds = enrollments.map(e => e.qrCode.courseId);

  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { isPublic: true },
        { courseId: { in: courseIds } }
      ]
    },
    orderBy: { uploadedAt: 'desc' }
  });

  // Passar dados prontos para Client Component
  return (
    <AreaRestritaClient
      user={user}
      documents={documents}
      enrollments={enrollments}
    />
  );
}

// app/area-restrita/AreaRestritaClient.tsx (Client Component)
'use client';

export default function AreaRestritaClient({ user, documents, enrollments }) {
  // Apenas interatividade: filtros, favoritos, download
  const [filteredDocs, setFilteredDocs] = useState(documents);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Filtros client-side (dados já no cliente)
  useEffect(() => {
    const filtered = documents.filter(doc => {
      if (selectedCategory === 'all') return true;
      return doc.category === selectedCategory;
    });
    setFilteredDocs(filtered);
  }, [selectedCategory, documents]);

  return (
    <div>
      <DocumentFilters
        category={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />
      <DocumentList documents={filteredDocs} />
    </div>
  );
}
```

**Benefícios:**
- ✅ Redução de 60% no bundle JavaScript
- ✅ Dados buscados no servidor (mais rápido)
- ✅ SEO melhorado (conteúdo renderizado)
- ✅ Menos re-renders no cliente

**Ganho esperado:** +20 pontos no score
**Tempo estimado:** 8-10 horas

---

### 3.2. Virtual Scrolling para Listas Longas

**Problema:**
- Listas de 100+ documentos renderizam todos de uma vez
- DOM pesado, scroll lento
- Memória desperdiçada

**Solução:**
```typescript
// Instalar react-window
npm install react-window

// components/VirtualDocumentList.tsx
import { FixedSizeList as List } from 'react-window';

export default function VirtualDocumentList({ documents }) {
  const Row = ({ index, style }) => {
    const doc = documents[index];
    return (
      <div style={style}>
        <DocumentCard document={doc} />
      </div>
    );
  };

  return (
    <List
      height={600}
      itemCount={documents.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

**Ganho esperado:** +15 pontos em listas longas
**Tempo estimado:** 4-6 horas

---

### 3.3. Bundle Analyzer e Tree Shaking

**Problema:**
- Dependências não usadas incluídas no bundle
- Imports completos de bibliotecas grandes
- Código duplicado entre chunks

**Solução:**
```bash
# Analisar bundle atual
npm install --save-dev @next/bundle-analyzer

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // ... config
});

# Rodar análise
ANALYZE=true npm run build
```

**Otimizações identificadas:**
```typescript
// ❌ ANTES: Import completo
import * as Icons from 'lucide-react';

// ✅ DEPOIS: Import específico
import { Download, Eye, Users } from 'lucide-react';

// ❌ ANTES: Import completo do Lodash
import _ from 'lodash';
const unique = _.uniq(array);

// ✅ DEPOIS: Import específico
import uniq from 'lodash/uniq';
const unique = uniq(array);

// ❌ ANTES: Moment.js (pesado)
import moment from 'moment';

// ✅ DEPOIS: date-fns (leve)
import { format } from 'date-fns';
```

**Ganho esperado:** Redução de 30-40% no bundle
**Tempo estimado:** 4-6 horas

---

### 3.4. Image Optimization

**Problema:**
- Imagens não otimizadas
- Formatos pesados (PNG, JPG sem compressão)
- Sem lazy loading adequado

**Solução:**
```typescript
// Usar Next.js Image component
import Image from 'next/image';

// ❌ ANTES
<img src="/images/curso.jpg" alt="Curso" />

// ✅ DEPOIS
<Image
  src="/images/curso.jpg"
  alt="Curso"
  width={800}
  height={600}
  quality={80}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  loading="lazy"
/>

// next.config.js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};
```

**Ganho esperado:** +10 pontos no LCP
**Tempo estimado:** 3-4 horas

---

### 3.5. Service Worker e Offline Support

**Problema:**
- Sem caching de assets
- Experiência ruim em conexões lentas
- Sem suporte offline

**Solução:**
```bash
# Instalar Workbox
npm install workbox-webpack-plugin

# next.config.js
const WorkboxPlugin = require('workbox-webpack-plugin');

module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new WorkboxPlugin.GenerateSW({
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 dias
                },
              },
            },
          ],
        })
      );
    }
    return config;
  },
};
```

**Ganho esperado:** PWA score 90+, +10 pontos em Performance
**Tempo estimado:** 6-8 horas

---

## 📊 Resumo de Ganhos Estimados

### Fase 2 (8-12 horas)
| Melhoria | Ganho | Tempo |
|----------|-------|-------|
| Code Splitting | +15 pontos | 3-4h |
| QR Code em arquivos | +10 pontos | 2-3h |
| Cache Headers | +5-10 pontos | 2-3h |
| Prefetch recursos | +5 pontos | 2h |
| **TOTAL FASE 2** | **+35-40 pontos** | **9-12h** |

### Fase 3 (20-30 horas)
| Melhoria | Ganho | Tempo |
|----------|-------|-------|
| Server Components | +20 pontos | 8-10h |
| Virtual Scrolling | +15 pontos | 4-6h |
| Bundle Optimization | -30-40% bundle | 4-6h |
| Image Optimization | +10 pontos | 3-4h |
| Service Worker | +10 pontos PWA | 6-8h |
| **TOTAL FASE 3** | **+55-65 pontos** | **25-34h** |

### Resultado Final Esperado

| Página | Atual | Fase 1 | Fase 2 | Fase 3 |
|--------|-------|--------|--------|--------|
| /validar-acesso | 16 | 75+ | 85+ | 90+ |
| /admin | 9 | 55+ | 70+ | 85+ |
| /admin/analytics | 11 | 60+ | 75+ | 90+ |
| /area-restrita | 59 | 59 | 75+ | 90+ |

---

## ✅ Checklist para Implementação Futura

### Antes de Começar Fase 2
- [ ] Validar que Fase 1 foi deployada com sucesso
- [ ] Verificar scores reais no Vercel após deploy
- [ ] Confirmar que scores não atingiram 70+ naturalmente
- [ ] Priorizar melhorias por ROI (ganho/tempo)

### Antes de Começar Fase 3
- [ ] Validar que Fase 2 foi concluída
- [ ] Scores devem estar em 70+ mas não em 90+
- [ ] Analisar bundle atual com Bundle Analyzer
- [ ] Documentar baseline de performance

### Durante Implementação
- [ ] Implementar uma melhoria por vez
- [ ] Testar localmente antes de commit
- [ ] Validar no Vercel Preview antes de merge
- [ ] Documentar mudanças em SESSAO_*.md

---

## 📝 Notas Importantes

1. **Não implementar tudo de uma vez** - Validar cada fase antes da próxima
2. **Medir antes e depois** - Usar Lighthouse e Vercel Analytics
3. **Testar em dispositivos reais** - Mobile, tablet, desktop
4. **Considerar custo/benefício** - Fase 3 é opcional se Fase 2 atingir metas
5. **Backup antes de grandes refatorações** - Especialmente Server Components

---

**Criado em:** 2025-11-01
**Última atualização:** 2025-11-01
**Status:** Planejado (não implementado)
