# Admin Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar o admin do site do Barral em ~16 entradas de menu (de 21), tornar o LMS visível, criar Hub TCU com UI nova de revisão de classificações editoriais pendentes, criar Hub Lei 14.133, deletar páginas mortas.

**Architecture:** Reusar padrão hub já estabelecido (Tabs de `@/components/ui/Tabs` + `useTabFromUrl` + `dynamic` import lazy). Páginas antigas ficam na codebase como sub-páginas e ganham redirect em `next.config.ts` (consistência com consolidações anteriores). Cada fase = 1 commit pequeno em main.

**Tech Stack:** Next.js 15 (App Router), React, TypeScript, Tailwind, lucide-react, Prisma, Tabs/useTabFromUrl existentes em `components/ui/Tabs.tsx` e `hooks/use-tab-from-url.ts`.

**Estado de partida (2026-05-04):**
- 62 páginas admin, 21 entradas de menu (`components/AdminLayout.tsx:86-216`)
- Hubs já existentes: `/admin/importacao`, `/admin/analytics-hub`, `/admin/docs`, `/admin/blog-social`, `/admin/recursos`
- Redirects: `next.config.ts:38-52`
- 353 acórdãos TCU classificados em 2026-05-04 com `tcuRevisadoPorAdmin = false`, sem UI pra revisar
- LMS funcional mas invisível no menu (6 telas)

**Decisões já tomadas com o user:**
1. Manter páginas antigas + redirect
2. Deletar órfãs com **zero referência** após grep final (autorizado)
3. Ordem: quick wins → Hub TCU → Hub Lei 14.133 → limpeza
4. Main, commits pequenos por fase

---

## Mapa de arquivos do plano

**Criar:**
- `app/admin/tcu/page.tsx` — Hub TCU (server component delegando ao client)
- `app/admin/tcu/TcuHubClient.tsx` — wrapper com 4 abas
- `app/admin/tcu/AcordaosTab.tsx` — aba "Acórdãos" com sub-abas (Lista geral / Pendentes de revisão)
- `app/admin/tcu/PendingReviewPanel.tsx` — UI nova de revisão de classificações (filtros, tabela, edit inline)
- `app/api/admin/tcu/pending-classifications/route.ts` — GET lista paginada
- `app/api/admin/tcu/classifications/[id]/route.ts` — PATCH (editar area/tema/subtema), POST `/mark-reviewed`
- `app/admin/lei-14133/page.tsx` — Hub Lei 14.133 (substitui página atual ou wrapper)
- `app/admin/lei-14133/Lei14133HubClient.tsx` — wrapper com abas
- `docs/ADMIN_NAVIGATION.md` — mapa do admin novo

**Modificar:**
- `components/AdminLayout.tsx:86-216` — reagrupar menu em 6 seções, adicionar LMS + Hub TCU + Hub Lei 14.133 + Search Analytics
- `app/admin/analytics-hub/page.tsx` — adicionar aba "Busca IA" delegando ao `search-analytics`
- `next.config.ts:38-52` — adicionar redirects pras rotas consolidadas

**Deletar (após verificação de zero referências):**
- `app/admin/planejamento/matriz/` (toda a pasta)
- `app/admin/planejamento/trilhas/` (toda a pasta)
- `app/admin/legislative-relations/` (toda a pasta)
- Demais órfãs identificadas durante Fase 4

---

## Fase 1 — Quick Wins (1 commit)

Pequenas mudanças no menu pra ganhar visibilidade rápida.

### Task 1.1: Reagrupar menu em 6 seções e adicionar LMS

**Files:**
- Modify: `components/AdminLayout.tsx:86-216`

- [ ] **Step 1: Ler estado atual e o ícone de LMS disponível**

```bash
grep -n "GraduationCap\|BookOpen\|Award" "C:\Projeto de site do Barral\sitedobarral-stripe\components\AdminLayout.tsx"
```

Confirmar que `GraduationCap` ou ícone equivalente está importado de `lucide-react`. Se não, adicionar ao import.

- [ ] **Step 2: Substituir bloco do menu (linhas 86-216) pelo novo agrupamento**

```tsx
// Menus ORGANIZADOS POR CATEGORIA — Consolidado (16 itens)
const menuItems = [
  // === VISÃO GERAL ===
  { divider: true, label: '\u{1F4CA} Visao geral' },
  {
    path: '/admin',
    label: 'Dashboard (QR Codes)',
    icon: QrCode,
  },
  {
    path: '/admin/monitoring',
    label: 'Monitoramento',
    icon: Activity,
  },

  // === JURISPRUDÊNCIA ===
  { divider: true, label: '\u{2696}\u{FE0F} Jurisprudencia' },
  {
    path: '/admin/tcu',
    label: 'TCU (Acordaos + Destaques)',
    icon: Scale,
    badge: unreadCounts.tcuHighlights,
  },
  {
    path: '/admin/lei-14133',
    label: 'Lei 14.133',
    icon: Sparkles,
  },
  {
    path: '/admin/legislacao',
    label: 'Legislacao',
    icon: BookOpen,
  },
  {
    path: '/admin/importacao',
    label: 'Importacao (TCU/AGU)',
    icon: FileSpreadsheet,
  },
  {
    path: '/admin/dou-filtros',
    label: 'DOU Filtros',
    icon: Filter,
    badge: unreadCounts.douPending,
  },
  {
    path: '/admin/clipping-dou',
    label: 'Clipping DOU',
    icon: Inbox,
  },
  {
    path: '/admin/pareceres-revisao',
    label: 'Pareceres CONUNI',
    icon: FileText,
  },

  // === DOCUMENTOS ===
  { divider: true, label: '\u{1F4C1} Documentos' },
  {
    path: '/admin/docs',
    label: 'Documentos',
    icon: FileText,
    badge: unreadCounts.documentos,
  },

  // === LMS ===
  { divider: true, label: '\u{1F393} LMS' },
  {
    path: '/admin/lms',
    label: 'Cursos & Licoes',
    icon: GraduationCap,
  },

  // === CONTEÚDO ===
  { divider: true, label: '\u{270D}\u{FE0F} Conteudo' },
  {
    path: '/admin/blog-social',
    label: 'Blog & Social',
    icon: PenSquare,
  },
  {
    path: '/admin/publicacoes',
    label: 'Publicacoes',
    icon: BookOpen,
  },
  {
    path: '/admin/glossario',
    label: 'Glossario',
    icon: BookOpen,
  },
  {
    path: '/admin/recursos',
    label: 'Recursos Externos',
    icon: Globe,
  },

  // === GESTÃO & ANALYTICS ===
  { divider: true, label: '\u{2699}\u{FE0F} Gestao' },
  {
    path: '/admin/analytics-hub',
    label: 'Analytics',
    icon: BarChart3,
  },
  {
    path: '/admin/contatos',
    label: 'Contatos',
    icon: Mail,
    badge: unreadCounts.contatos,
  },
  {
    path: '/admin/depoimentos',
    label: 'Depoimentos',
    icon: MessageSquare,
    badge: unreadCounts.depoimentos,
  },
  {
    path: '/admin/newsletter',
    label: 'Newsletter',
    icon: Send,
  },
];
```

Garantir que o ícone `GraduationCap` está no import:
```tsx
import { /* ...existentes..., */ GraduationCap } from 'lucide-react';
```

- [ ] **Step 3: Smoke test no navegador**

```bash
cd "C:\Projeto de site do Barral\sitedobarral-stripe" && npm run dev
```

Abrir `http://localhost:3000/admin`, conferir que:
- 6 seções aparecem com dividers
- LMS aparece e clica abre `/admin/lms`
- Tribunal-decisions, tcu-highlights, tribunal-highlights, search-analytics ficaram fora do menu (vão pra hubs nas próximas fases)

Esperado: menu carrega sem erro, badges seguem funcionando.

- [ ] **Step 4: Commit**

```bash
git add components/AdminLayout.tsx
git commit -m "$(cat <<'EOF'
admin: reorganizar menu em 6 secoes, tornar LMS visivel

Reagrupa entradas em Visao Geral / Jurisprudencia / Documentos / LMS /
Conteudo / Gestao. Adiciona LMS (6 telas que estavam invisiveis).
Remove tcu-highlights, tribunal-highlights, tribunal-decisions do menu
(serao consolidados no Hub TCU em fase seguinte).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Fase 2 — Hub TCU + UI de classificações pendentes (3 commits)

A frente principal: cria `/admin/tcu` consolidando 4 telas (acórdãos, destaques TCU, destaques TCE, decisões de tribunais) + entrega a UI nova de revisão de classificações editoriais.

### Task 2.1: Criar API de pendentes e edição inline

**Files:**
- Create: `app/api/admin/tcu/pending-classifications/route.ts`
- Create: `app/api/admin/tcu/classifications/[id]/route.ts`

- [ ] **Step 1: Criar GET /api/admin/tcu/pending-classifications**

`app/api/admin/tcu/pending-classifications/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 50;

export const GET = withAdminAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const area = searchParams.get('area') || undefined;
  const onlyNewTerms = searchParams.get('onlyNewTerms') === 'true';

  const where = {
    category: 'acordao',
    tcuNumeroAcordao: { not: null },
    tcuRevisadoPorAdmin: false,
    tcuClassificadoEm: { not: null },
    ...(area ? { tcuArea: area } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      select: {
        id: true,
        tcuNumeroAcordao: true,
        title: true,
        tcuArea: true,
        tcuTema: true,
        tcuSubtema: true,
        tcuRelator: true,
        tcuOrgaoJulgador: true,
        tcuDataJulgamento: true,
        tcuClassificadoEm: true,
        tcuLinkPDF: true,
        summary: true,
      },
      orderBy: [{ tcuClassificadoEm: 'desc' }, { tcuDataJulgamento: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  // Filtro novosTermos: marca quem tem tema/subtema fora da taxonomia
  let filteredItems = items;
  if (onlyNewTerms) {
    const fs = await import('fs');
    const path = await import('path');
    const taxonomy = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'data', 'tcu-taxonomy.json'), 'utf-8')
    ) as Record<string, Record<string, string[]>>;
    filteredItems = items.filter(d => {
      if (!d.tcuArea || !d.tcuTema) return false;
      const temaExiste = !!taxonomy[d.tcuArea]?.[d.tcuTema];
      const subtemaExiste = d.tcuSubtema
        ? (taxonomy[d.tcuArea]?.[d.tcuTema] || []).includes(d.tcuSubtema)
        : true;
      return !temaExiste || !subtemaExiste;
    });
  }

  return NextResponse.json({
    items: filteredItems,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
});
```

- [ ] **Step 2: Criar PATCH e POST /mark-reviewed em /api/admin/tcu/classifications/[id]**

`app/api/admin/tcu/classifications/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export const PATCH = withAdminAuth(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await request.json();
  const { area, tema, subtema, markReviewed } = body as {
    area?: string;
    tema?: string;
    subtema?: string | null;
    markReviewed?: boolean;
  };

  if (!area || !tema) {
    return NextResponse.json({ error: 'area e tema sao obrigatorios' }, { status: 400 });
  }

  const data: Record<string, unknown> = {
    tcuArea: area,
    tcuTema: tema,
    tcuSubtema: subtema ?? null,
  };
  if (markReviewed) {
    data.tcuRevisadoPorAdmin = true;
  }

  await prisma.$transaction([
    prisma.document.update({ where: { id }, data }),
    prisma.documentMetaTcu.upsert({
      where: { documentId: id },
      create: {
        documentId: id,
        area,
        tema,
        subtema: subtema ?? null,
        revisadoPorAdmin: !!markReviewed,
      },
      update: {
        area,
        tema,
        subtema: subtema ?? null,
        ...(markReviewed ? { revisadoPorAdmin: true } : {}),
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
});
```

- [ ] **Step 3: Smoke test ambas as rotas**

```bash
cd "C:\Projeto de site do Barral\sitedobarral-stripe" && npm run dev
```

Em outro terminal (com cookie admin válido):
```bash
curl -s "http://localhost:3000/api/admin/tcu/pending-classifications?page=1" | jq '.total, .items[0]'
```
Esperado: `total >= 353`, primeiro item com tcuArea/tema preenchidos e `tcuRevisadoPorAdmin = false`.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/tcu/pending-classifications/route.ts app/api/admin/tcu/classifications/[id]/route.ts
git commit -m "$(cat <<'EOF'
api: endpoints de revisao de classificacoes editoriais TCU

GET /api/admin/tcu/pending-classifications: lista paginada com filtros
por area e onlyNewTerms (temas/subtemas fora da taxonomia oficial).
PATCH /api/admin/tcu/classifications/[id]: edita area/tema/subtema,
opcionalmente marca como revisado (Document + DocumentMetaTcu).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.2: Criar Hub TCU com 4 abas

**Files:**
- Create: `app/admin/tcu/page.tsx`
- Create: `app/admin/tcu/TcuHubClient.tsx`
- Create: `app/admin/tcu/PendingReviewPanel.tsx`

- [ ] **Step 1: Criar entrypoint server-side**

`app/admin/tcu/page.tsx`:

```tsx
import { Metadata } from 'next';
import TcuHubClient from './TcuHubClient';

export const metadata: Metadata = {
  title: 'Hub TCU — Admin',
};

export default function Page() {
  return <TcuHubClient />;
}
```

- [ ] **Step 2: Criar wrapper de abas reusando hubs existentes**

`app/admin/tcu/TcuHubClient.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import { Loader2, Scale } from 'lucide-react';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { useTabFromUrl } from '@/hooks/use-tab-from-url';

const PendingReviewPanel = dynamic(() => import('./PendingReviewPanel'), {
  loading: () => <LoaderBlock />,
});
const TribunalDecisionsContent = dynamic(() => import('../tribunal-decisions/page'), {
  loading: () => <LoaderBlock />,
});
const TcuHighlightsContent = dynamic(() => import('../tcu-highlights/page'), {
  loading: () => <LoaderBlock />,
});
const TribunalHighlightsContent = dynamic(() => import('../tribunal-highlights/page'), {
  loading: () => <LoaderBlock />,
});
const ImportacaoContent = dynamic(() => import('../importacao/page'), {
  loading: () => <LoaderBlock />,
});

function LoaderBlock() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );
}

export default function TcuHubClient() {
  const { activeTab, setTab } = useTabFromUrl('acordaos');

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6 flex items-center gap-3">
        <Scale className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hub TCU</h1>
          <p className="text-sm text-gray-600">Acordaos, destaques editoriais, importacao e tribunais</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabList>
          <Tab value="acordaos">Acordaos</Tab>
          <Tab value="destaques">Destaques editoriais</Tab>
          <Tab value="tribunais">Tribunais (TCEs)</Tab>
          <Tab value="importar">Importar</Tab>
        </TabList>

        <TabPanel value="acordaos">
          <PendingReviewPanel />
        </TabPanel>
        <TabPanel value="destaques">
          <TcuHighlightsContent />
        </TabPanel>
        <TabPanel value="tribunais">
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold mb-3">Decisoes</h2>
              <TribunalDecisionsContent />
            </section>
            <section>
              <h2 className="text-lg font-semibold mb-3">Destaques</h2>
              <TribunalHighlightsContent />
            </section>
          </div>
        </TabPanel>
        <TabPanel value="importar">
          <ImportacaoContent />
        </TabPanel>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Criar PendingReviewPanel**

`app/admin/tcu/PendingReviewPanel.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, ExternalLink, Check, AlertCircle } from 'lucide-react';

interface PendingItem {
  id: string;
  tcuNumeroAcordao: string;
  title: string;
  tcuArea: string;
  tcuTema: string;
  tcuSubtema: string | null;
  tcuRelator: string | null;
  tcuOrgaoJulgador: string | null;
  tcuDataJulgamento: string | null;
  tcuLinkPDF: string | null;
  summary: string | null;
}

interface ApiResponse {
  items: PendingItem[];
  page: number;
  totalPages: number;
  total: number;
}

const AREAS = [
  'Competencia do TCU',
  'Contrato Administrativo',
  'Convenio',
  'Desestatizacao',
  'Direito Processual',
  'Financas Publicas',
  'Gestao Administrativa',
  'Licitacao',
  'Pessoal',
  'Responsabilidade',
];

export default function PendingReviewPanel() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [areaFilter, setAreaFilter] = useState<string>('');
  const [onlyNewTerms, setOnlyNewTerms] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ area: string; tema: string; subtema: string }>({ area: '', tema: '', subtema: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page) });
    if (areaFilter) qs.set('area', areaFilter);
    if (onlyNewTerms) qs.set('onlyNewTerms', 'true');
    const r = await fetch(`/api/admin/tcu/pending-classifications?${qs}`);
    setData(await r.json());
    setLoading(false);
  }, [page, areaFilter, onlyNewTerms]);

  useEffect(() => { load(); }, [load]);

  function startEdit(item: PendingItem) {
    setEditingId(item.id);
    setEditForm({ area: item.tcuArea, tema: item.tcuTema, subtema: item.tcuSubtema || '' });
  }

  async function save(id: string, markReviewed: boolean) {
    const r = await fetch(`/api/admin/tcu/classifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area: editForm.area,
        tema: editForm.tema,
        subtema: editForm.subtema || null,
        markReviewed,
      }),
    });
    if (r.ok) {
      setEditingId(null);
      await load();
    } else {
      alert('Falha ao salvar');
    }
  }

  async function markReviewedOnly(id: string, item: PendingItem) {
    const r = await fetch(`/api/admin/tcu/classifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area: item.tcuArea,
        tema: item.tcuTema,
        subtema: item.tcuSubtema,
        markReviewed: true,
      }),
    });
    if (r.ok) await load();
  }

  if (loading && !data) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <strong>{data?.total ?? 0} acordao(s) classificado(s) por IA aguardando revisao editorial.</strong>
          {' '}Confirme ou edite area/tema/subtema. Marque como revisado quando aprovar.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={areaFilter} onChange={e => { setAreaFilter(e.target.value); setPage(1); }} className="border rounded px-2 py-1 text-sm">
          <option value="">Todas as areas</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <label className="text-sm flex items-center gap-1">
          <input type="checkbox" checked={onlyNewTerms} onChange={e => { setOnlyNewTerms(e.target.checked); setPage(1); }} />
          Somente com termos fora da taxonomia oficial
        </label>
      </div>

      <div className="space-y-3">
        {data?.items.map(item => (
          <div key={item.id} className="border rounded p-4 bg-white">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="min-w-0">
                <div className="font-mono text-sm text-blue-600">{item.tcuNumeroAcordao}</div>
                <div className="text-sm text-gray-600">
                  {item.tcuRelator} {item.tcuOrgaoJulgador && `• ${item.tcuOrgaoJulgador}`}
                  {item.tcuDataJulgamento && ` • ${new Date(item.tcuDataJulgamento).toLocaleDateString('pt-BR')}`}
                </div>
              </div>
              {item.tcuLinkPDF && (
                <a href={item.tcuLinkPDF} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 shrink-0">
                  PDF <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            {item.summary && <p className="text-sm text-gray-700 mb-3">{item.summary}</p>}

            {editingId === item.id ? (
              <div className="space-y-2 bg-gray-50 p-3 rounded">
                <div className="grid grid-cols-3 gap-2">
                  <select value={editForm.area} onChange={e => setEditForm({ ...editForm, area: e.target.value })} className="border rounded px-2 py-1 text-sm">
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <input value={editForm.tema} onChange={e => setEditForm({ ...editForm, tema: e.target.value })} placeholder="Tema" className="border rounded px-2 py-1 text-sm" />
                  <input value={editForm.subtema} onChange={e => setEditForm({ ...editForm, subtema: e.target.value })} placeholder="Subtema (opcional)" className="border rounded px-2 py-1 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => save(item.id, true)} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">Salvar e marcar revisado</button>
                  <button onClick={() => save(item.id, false)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">Salvar</button>
                  <button onClick={() => setEditingId(null)} className="text-sm px-3 py-1 hover:bg-gray-200 rounded">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-semibold">{item.tcuArea}</span>
                  {' › '}{item.tcuTema}
                  {item.tcuSubtema && <> {' › '}<span className="text-gray-600">{item.tcuSubtema}</span></>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(item)} className="text-sm px-2 py-1 border rounded hover:bg-gray-50">Editar</button>
                  <button onClick={() => markReviewedOnly(item.id, item)} className="text-sm px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Aprovar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50">Anterior</button>
          <span className="px-3 py-1">Pagina {page} de {data.totalPages}</span>
          <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="px-3 py-1 border rounded disabled:opacity-50">Proxima</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Smoke test no navegador**

```bash
cd "C:\Projeto de site do Barral\sitedobarral-stripe" && npm run dev
```

Abrir `http://localhost:3000/admin/tcu`, verificar:
- 4 abas aparecem (Acordaos / Destaques / Tribunais / Importar)
- Aba "Acordaos" carrega lista de pendentes (>=353 itens)
- Filtros (area, novos termos) funcionam
- Editar inline → "Salvar e marcar revisado" remove item da lista
- "Aprovar" sem editar move item pra revisado

- [ ] **Step 5: Commit**

```bash
git add app/admin/tcu/page.tsx app/admin/tcu/TcuHubClient.tsx app/admin/tcu/PendingReviewPanel.tsx
git commit -m "$(cat <<'EOF'
admin: criar Hub TCU com 4 abas + UI de revisao de classificacoes

Novo /admin/tcu consolida acordaos pendentes de revisao editorial
(353 acordaos classificados por IA em 2026-05-04 com
tcuRevisadoPorAdmin=false), destaques TCU, decisoes/destaques de
tribunais (TCEs) e importacao. Padrao Tabs+useTabFromUrl reusando
componentes existentes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.3: Adicionar redirects de rotas TCU antigas

**Files:**
- Modify: `next.config.ts:38-52`

- [ ] **Step 1: Adicionar redirects no array de redirects()**

Inserir antes do fechamento do array em `next.config.ts:51`:

```typescript
{ source: '/admin/tcu-highlights', destination: '/admin/tcu?tab=destaques', permanent: false },
{ source: '/admin/tribunal-highlights', destination: '/admin/tcu?tab=tribunais', permanent: false },
{ source: '/admin/tribunal-decisions', destination: '/admin/tcu?tab=tribunais', permanent: false },
```

- [ ] **Step 2: Smoke test redirects**

```bash
cd "C:\Projeto de site do Barral\sitedobarral-stripe" && npm run dev
```

Abrir `http://localhost:3000/admin/tcu-highlights` no navegador. Esperado: redireciona pra `/admin/tcu?tab=destaques`.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "$(cat <<'EOF'
admin: redirects das rotas TCU antigas pro Hub TCU

tcu-highlights, tribunal-highlights, tribunal-decisions agora
redirecionam pras abas correspondentes em /admin/tcu.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Fase 3 — Hub Lei 14.133 (1 commit)

Tornar visíveis as 4 telas de Lei 14.133 via hub único.

### Task 3.1: Criar Hub Lei 14.133

**Files:**
- Modify (or replace): `app/admin/lei-14133/page.tsx`
- Create: `app/admin/lei-14133/Lei14133HubClient.tsx`
- Modify: `next.config.ts` (adicionar redirects)

- [ ] **Step 1: Inspecionar página atual**

```bash
cat "C:\Projeto de site do Barral\sitedobarral-stripe\app\admin\lei-14133\page.tsx"
```

Se for uma página simples (não-hub), substituir; se for hub já existente, adaptar. O passo seguinte assume substituição completa.

- [ ] **Step 2: Substituir page.tsx por wrapper de hub**

`app/admin/lei-14133/page.tsx` (sobrescrever):

```tsx
import { Metadata } from 'next';
import Lei14133HubClient from './Lei14133HubClient';

export const metadata: Metadata = {
  title: 'Lei 14.133 — Admin',
};

export default function Page() {
  return <Lei14133HubClient />;
}
```

- [ ] **Step 3: Criar wrapper de abas**

`app/admin/lei-14133/Lei14133HubClient.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import { Loader2, Sparkles } from 'lucide-react';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { useTabFromUrl } from '@/hooks/use-tab-from-url';

const ComentadaContent = dynamic(() => import('./comentada/page'), {
  loading: () => <LoaderBlock />,
});
const AnalyticsContent = dynamic(() => import('./analytics/page'), {
  loading: () => <LoaderBlock />,
});
const BulkLinkerContent = dynamic(() => import('./bulk-linker/page'), {
  loading: () => <LoaderBlock />,
});

function LoaderBlock() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );
}

export default function Lei14133HubClient() {
  const { activeTab, setTab } = useTabFromUrl('comentada');

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6 flex items-center gap-3">
        <Sparkles className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lei 14.133/2021</h1>
          <p className="text-sm text-gray-600">Editorial, vinculacoes e analytics</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabList>
          <Tab value="comentada">Comentada (editorial)</Tab>
          <Tab value="bulk-linker">Vinculacoes em massa</Tab>
          <Tab value="analytics">Analytics</Tab>
        </TabList>

        <TabPanel value="comentada"><ComentadaContent /></TabPanel>
        <TabPanel value="bulk-linker"><BulkLinkerContent /></TabPanel>
        <TabPanel value="analytics"><AnalyticsContent /></TabPanel>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 4: Adicionar redirects pras rotas antigas**

Em `next.config.ts`, dentro do array de redirects:

```typescript
{ source: '/admin/lei-14133/comentada', destination: '/admin/lei-14133?tab=comentada', permanent: false },
{ source: '/admin/lei-14133/analytics', destination: '/admin/lei-14133?tab=analytics', permanent: false },
{ source: '/admin/lei-14133/bulk-linker', destination: '/admin/lei-14133?tab=bulk-linker', permanent: false },
```

**Atenção:** se `comentada/page.tsx` for importada como dynamic no hub, o redirect pode causar loop. Solução: o redirect só acontece em request direto; o hub importa o módulo, não navega. Mas pra garantir, testar que abrir `/admin/lei-14133/comentada` redireciona, e que dentro do hub a aba carrega o conteúdo.

Se houver loop, remover esses 3 redirects e deixar URLs antigas funcionarem em paralelo (não-ideal, mas seguro).

- [ ] **Step 5: Smoke test**

```bash
cd "C:\Projeto de site do Barral\sitedobarral-stripe" && npm run dev
```

Verificar:
- `http://localhost:3000/admin/lei-14133` mostra hub com 3 abas
- Cada aba carrega o conteúdo correto
- `/admin/lei-14133/comentada` redireciona pra hub aba comentada (ou abre direto, se redirect for desabilitado)

- [ ] **Step 6: Commit**

```bash
git add app/admin/lei-14133/page.tsx app/admin/lei-14133/Lei14133HubClient.tsx next.config.ts
git commit -m "$(cat <<'EOF'
admin: criar Hub Lei 14.133 com 3 abas

Consolida lei-14133/comentada, analytics e bulk-linker em
/admin/lei-14133 com tabs. Padrao consistente com Hub TCU e
demais hubs do admin.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Fase 4 — Search Analytics no hub Analytics (1 commit)

Tornar a página órfã `/admin/search-analytics` visível como aba no Analytics-hub.

### Task 4.1: Adicionar aba Busca IA no Analytics-hub

**Files:**
- Modify: `app/admin/analytics-hub/page.tsx`
- Modify: `next.config.ts` (adicionar redirect)

- [ ] **Step 1: Adicionar terceira aba no analytics-hub**

Editar `app/admin/analytics-hub/page.tsx`. Adicionar import dynamic do search-analytics e nova aba:

```tsx
const SearchAnalyticsContent = dynamic(() => import('../search-analytics/page'), {
  loading: () => <LoaderBlock />,
});
```

Adicionar novo `<Tab value="busca-ia">Busca IA</Tab>` no TabList e novo `<TabPanel value="busca-ia"><SearchAnalyticsContent /></TabPanel>`.

- [ ] **Step 2: Adicionar redirect**

Em `next.config.ts`, dentro de redirects():
```typescript
{ source: '/admin/search-analytics', destination: '/admin/analytics-hub?tab=busca-ia', permanent: false },
```

- [ ] **Step 3: Smoke test**

Abrir `http://localhost:3000/admin/analytics-hub`. Confirmar 3 abas (Geral / Catalogacao / Busca IA). Cada aba carrega.

- [ ] **Step 4: Commit**

```bash
git add app/admin/analytics-hub/page.tsx next.config.ts
git commit -m "$(cat <<'EOF'
admin: adicionar Busca IA como aba do Analytics-hub

search-analytics estava orfao apesar de ter doc proprio
(docs/ADMIN_SEARCH_ANALYTICS.md). Vira terceira aba do hub.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Fase 5 — Limpeza de páginas mortas (1 commit)

Remover páginas com **zero referências em href** após verificação final.

### Task 5.1: Verificar e deletar órfãs confirmadas

**Files:**
- Delete: `app/admin/planejamento/matriz/` (toda a pasta)
- Delete: `app/admin/planejamento/trilhas/` (toda a pasta)
- Delete: `app/admin/legislative-relations/` (toda a pasta)
- Verify: `app/admin/tcu-import/`, `app/admin/tcu-converter/`

- [ ] **Step 1: Grep final pra confirmar zero referência**

```bash
cd "C:\Projeto de site do Barral\sitedobarral-stripe"
grep -rE "href=.*admin/(planejamento|legislative-relations|tcu-import|tcu-converter)" app components --include="*.tsx" --include="*.ts" 2>&1
```

Se zero linhas → pode deletar. Se aparecer alguma referência, **NÃO deletar** essa página, perguntar ao user.

Atenção especial: `tcu-import` e `tcu-converter` podem estar em `lib/`, `data/`, `scripts/`. Repetir grep com escopo amplo:

```bash
grep -rE "/admin/(tcu-import|tcu-converter)" app components lib scripts --include="*.tsx" --include="*.ts" 2>&1
```

- [ ] **Step 2: Deletar pastas confirmadas**

Para cada órfã confirmada, remover a pasta inteira. Exemplo:

```bash
cd "C:\Projeto de site do Barral\sitedobarral-stripe"
rm -rf app/admin/planejamento
rm -rf app/admin/legislative-relations
# tcu-import e tcu-converter: deletar APENAS se grep do Step 1 confirmou zero ref
```

Também buscar e remover APIs órfãs correspondentes:

```bash
grep -rE "/api/admin/(legislative-relations|planejamento)" app components lib --include="*.tsx" --include="*.ts" 2>&1
```

Se algumas API routes só forem usadas pelas páginas deletadas, remover também `app/api/admin/legislative-relations/` etc. Mas conservador: se tiver TESTE (`__tests__/`), preservar a API.

- [ ] **Step 3: Rodar typecheck e build**

```bash
cd "C:\Projeto de site do Barral\sitedobarral-stripe" && npx tsc --noEmit -p . 2>&1 | grep -v "__tests__\|test.ts" | tail -20
```

Esperado: zero erros relacionados a paths deletados. Se aparecerem imports quebrados, ajustar o caller (não restaurar a página).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
admin: deletar paginas orfas confirmadas (zero referencias)

Remove app/admin/planejamento (matriz + trilhas),
app/admin/legislative-relations e — se grep confirmou — tcu-import
e tcu-converter. Sem href em nenhum componente da app.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Fase 6 — Documentação + memória (1 commit)

### Task 6.1: Criar mapa do admin novo

**Files:**
- Create: `docs/ADMIN_NAVIGATION.md`

- [ ] **Step 1: Documentar nova estrutura**

`docs/ADMIN_NAVIGATION.md`:

```markdown
# Admin — Mapa de navegacao (atualizado 2026-05-04)

Reorganizacao consolidada em 6 secoes / 16 entradas de menu.

## Visao geral
- `/admin` — Dashboard principal (QR Codes, metricas)
- `/admin/monitoring` — Saude do sistema (cron + scrapers)

## Jurisprudencia
- `/admin/tcu` — Hub TCU (Acordaos pendentes / Destaques / Tribunais TCEs / Importar)
- `/admin/lei-14133` — Hub Lei 14.133 (Comentada / Bulk linker / Analytics)
- `/admin/legislacao` — CRUD legislacao geral
- `/admin/importacao` — Importacao TCU+AGU (planilhas e scrapers)
- `/admin/dou-filtros` — Filtros DOU com approve/reject
- `/admin/clipping-dou` — Clipping diario DOU
- `/admin/pareceres-revisao` — Revisao CONUNI

## Documentos
- `/admin/docs` — Hub documentos (central + gerenciar)

## LMS
- `/admin/lms` — Cursos / Licoes / Quizzes / Certificados / Analytics

## Conteudo
- `/admin/blog-social` — Blog + Social
- `/admin/publicacoes` — CRUD publicacoes
- `/admin/glossario` — CRUD glossario
- `/admin/recursos` — Recursos externos (videos + sites)

## Gestao
- `/admin/analytics-hub` — Geral / Catalogacao / Busca IA
- `/admin/contatos` — Inbox contatos
- `/admin/depoimentos` — CRUD depoimentos
- `/admin/newsletter` — Newsletter + subscribers

## Rotas redirecionadas
Ver `next.config.ts` redirects(). Todas as URLs antigas foram preservadas
e redirecionam pras consolidacoes acima.

## Paginas removidas (2026-05-04)
- /admin/planejamento/matriz, /admin/planejamento/trilhas — sem uso
- /admin/legislative-relations — sem uso
- /admin/tcu-import, /admin/tcu-converter — superados por /admin/importacao
```

- [ ] **Step 2: Atualizar memoria (Claude memory)**

```bash
# Editar manualmente:
# C:\Users\Administrador\.claude\projects\C--Users-Administrador\memory\MEMORY.md
# Adicionar entrada: "Admin consolidacao 2026-05-04 - Hub TCU + Hub Lei 14.133 + LMS no menu + 6 secoes / 16 entradas. Mapa: docs/ADMIN_NAVIGATION.md"
```

- [ ] **Step 3: Commit**

```bash
git add docs/ADMIN_NAVIGATION.md
git commit -m "$(cat <<'EOF'
docs: mapa de navegacao do admin pos-consolidacao

Nova estrutura: 6 secoes / 16 entradas. Documenta hubs TCU e Lei 14.133,
LMS visivel no menu, paginas removidas e rotas redirecionadas.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Resumo de commits esperados

1. `admin: reorganizar menu em 6 secoes, tornar LMS visivel` (Fase 1)
2. `api: endpoints de revisao de classificacoes editoriais TCU` (Fase 2.1)
3. `admin: criar Hub TCU com 4 abas + UI de revisao de classificacoes` (Fase 2.2)
4. `admin: redirects das rotas TCU antigas pro Hub TCU` (Fase 2.3)
5. `admin: criar Hub Lei 14.133 com 3 abas` (Fase 3)
6. `admin: adicionar Busca IA como aba do Analytics-hub` (Fase 4)
7. `admin: deletar paginas orfas confirmadas (zero referencias)` (Fase 5)
8. `docs: mapa de navegacao do admin pos-consolidacao` (Fase 6)

Total: 8 commits pequenos e isolados em main. Cada um deploya independentemente e é reversível.

## Riscos conhecidos

- **Loop de redirect na Fase 3**: se o `dynamic` import de uma sub-rota disparar request HTTP que vira redirect, pode haver loop. Mitigação: testar e remover esses 3 redirects se necessário.
- **Fase 5 deleção**: se algum link interno usar pattern não-grepable (ex: variável construída), a deleção quebra a navegação. Mitigação: rodar build completo após delete e verificar runtime errors no dev.
- **Fase 2 — UI de revisão**: testar com `tcuRevisadoPorAdmin = false` reais. Confirmar que o counter no header (badge) reflete pendências; se quiser badge no menu, integrar com `unreadCounts` em AdminLayout (não incluído no plano por padrão).
