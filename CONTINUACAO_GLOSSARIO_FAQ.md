# 🚀 Continuação: Glossário e FAQ - Frontend

**Branch:** `feature/glossario-faq`
**Status Backend:** ✅ 100% Completo (commit dcf728f)
**Faltam:** Páginas públicas + Admin UI

---

## ✅ O QUE JÁ ESTÁ PRONTO

### Backend Completo:
- ✅ Schema Prisma (3 models)
- ✅ 16 APIs funcionais
- ✅ Sistema de busca
- ✅ Sistema de feedback
- ✅ Analytics completo
- ✅ Autenticação e autorização

---

## 📝 O QUE FALTA IMPLEMENTAR

### 1. Páginas Públicas (2-3 dias)

#### A. `/app/glossario/page.tsx`
Página principal do glossário com:
- Hero com título "Glossário de Licitações"
- Busca em tempo real
- Navegação alfabética A-Z
- Filtros por categoria
- Grid de cards de termos
- Componentes necessários:
  - `GlossarySearch.tsx`
  - `AlphabeticalNav.tsx`
  - `CategoryFilter.tsx`
  - `GlossaryTermCard.tsx`

#### B. `/app/glossario/[slug]/page.tsx`
Página individual do termo com:
- Breadcrumb
- Título e categoria
- Definição completa (markdown)
- Artigos da Lei 14.133 relacionados
- Documentos relacionados
- Termos relacionados
- Link externo (se houver)
- Botão compartilhar

#### C. `/app/faq/page.tsx`
Página de FAQs com:
- Hero com título "Perguntas Frequentes"
- Busca em perguntas/respostas
- Navegação por categorias (tabs)
- Accordion para cada pergunta
- Sistema de feedback em cada resposta
- Componentes necessários:
  - `FAQSearch.tsx`
  - `FAQCategoryNav.tsx`
  - `FAQAccordion.tsx`
  - `FAQFeedback.tsx`

---

### 2. Admin UI (3-4 dias)

#### A. `/app/admin/glossario/page.tsx`
Lista de termos do glossário:
- Tabela com todos os termos
- Filtros (categoria, publicado/não publicado)
- Busca
- Ações: editar, deletar, novo
- Ordenação
- Componente: `GlossaryAdminTable.tsx`

#### B. `/app/admin/glossario/novo/page.tsx`
Formulário para criar termo:
- Campo: Termo (obrigatório)
- Campo: Definição completa (textarea, markdown)
- Campo: Definição curta (opcional)
- Select: Categoria
- Multiselect: Artigos da Lei 14.133
- Autocomplete: Termos relacionados
- Autocomplete: Documentos relacionados
- Campo: URL externa (opcional)
- Checkbox: Público
- Botões: Salvar, Cancelar

#### C. `/app/admin/glossario/editar/[id]/page.tsx`
Mesmo formulário de criação, preenchido com dados existentes

#### D. `/app/admin/faq/page.tsx`
Lista de perguntas:
- Tabela com todas as FAQs
- Filtros (categoria, publicado/não publicado)
- Busca
- Colunas: Pergunta, Categoria, Views, Útil/Não útil, Fixada
- Ações: editar, deletar, novo, fixar/desafixar
- Reordenação drag-and-drop (opcional)
- Componente: `FAQAdminTable.tsx`

#### E. `/app/admin/faq/novo/page.tsx`
Formulário para criar FAQ:
- Campo: Pergunta (obrigatório)
- Textarea: Resposta (markdown, obrigatório)
- Select: Categoria (obrigatório)
- Campo numérico: Ordem de exibição
- Checkbox: Fixar no topo
- Checkbox: Publicado
- Multiselect: FAQs relacionadas
- Multiselect: Documentos relacionados
- Tags: Palavras-chave
- Botões: Salvar, Cancelar

#### F. `/app/admin/faq/editar/[id]/page.tsx`
Mesmo formulário de criação, preenchido

#### G. `/app/admin/faq/analytics/page.tsx`
Dashboard de analytics:
- Cards com números gerais (total FAQs, views, feedbacks)
- Gráfico: FAQs mais visualizadas
- Gráfico: FAQs mais úteis
- Lista: FAQs que precisam revisão (muitos feedbacks negativos)
- Tabela: Feedbacks por categoria
- Lista: Comentários recentes

---

### 3. Navegação e Links (30 min)

#### Adicionar no Header (`components/layout/Header.tsx`):
```tsx
<Link href="/glossario">Glossário</Link>
<Link href="/faq">FAQ</Link>
```

#### Adicionar no Footer:
```tsx
<Link href="/glossario">Glossário de Termos</Link>
<Link href="/faq">Perguntas Frequentes</Link>
```

#### Adicionar no Menu Admin (`components/AdminLayout.tsx`):
```tsx
<Link href="/admin/glossario">Glossário</Link>
<Link href="/admin/faq">FAQ</Link>
```

---

### 4. Componentes Reutilizáveis

#### `/components/glossary/GlossarySearch.tsx`
```tsx
'use client';
import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

export function GlossarySearch({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar termo..."
        className="w-full px-4 py-3 pl-10 border rounded-lg"
      />
      <SearchIcon className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
    </div>
  );
}
```

#### `/components/glossary/AlphabeticalNav.tsx`
```tsx
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function AlphabeticalNav({
  activeLetter,
  onLetterClick,
  availableLetters
}: {
  activeLetter?: string;
  onLetterClick: (letter: string) => void;
  availableLetters: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {LETTERS.map((letter) => (
        <button
          key={letter}
          onClick={() => onLetterClick(letter)}
          disabled={!availableLetters.includes(letter)}
          className={`
            w-10 h-10 rounded-md font-semibold
            ${activeLetter === letter ? 'bg-blue-600 text-white' : ''}
            ${availableLetters.includes(letter)
              ? 'bg-gray-100 hover:bg-gray-200'
              : 'bg-gray-50 text-gray-300 cursor-not-allowed'
            }
          `}
        >
          {letter}
        </button>
      ))}
    </div>
  );
}
```

#### `/components/faq/FAQAccordion.tsx`
```tsx
'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FAQFeedback } from './FAQFeedback';

export function FAQAccordion({ faqs }: { faqs: any[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setOpenId(openId === id ? null : id);

    // Registrar visualização
    if (openId !== id) {
      fetch(`/api/faq/${id}/view`, { method: 'POST' });
    }
  };

  return (
    <div className="space-y-4">
      {faqs.map((faq) => (
        <div key={faq.id} className="border rounded-lg">
          <button
            onClick={() => toggleFAQ(faq.id)}
            className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50"
          >
            <span className="font-medium text-lg flex items-center gap-2">
              {faq.isPinned && <PinIcon className="h-4 w-4 text-blue-600" />}
              {faq.question}
            </span>
            <ChevronIcon className={`h-5 w-5 transition-transform ${
              openId === faq.id ? 'rotate-180' : ''
            }`} />
          </button>

          {openId === faq.id && (
            <div className="px-6 py-4 border-t bg-gray-50">
              <div className="prose max-w-none">
                <ReactMarkdown>{faq.answer}</ReactMarkdown>
              </div>

              <FAQFeedback faqId={faq.id} />

              <div className="text-sm text-gray-500 mt-4">
                {faq.viewCount} visualizações •
                {faq.helpfulCount} acharam útil •
                {faq.notHelpfulCount} não acharam útil
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

#### `/components/faq/FAQFeedback.tsx`
```tsx
'use client';
import { useState } from 'react';
import { ThumbsUpIcon, ThumbsDownIcon } from 'lucide-react';

export function FAQFeedback({ faqId }: { faqId: string }) {
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');

  const handleFeedback = async (wasHelpful: boolean) => {
    setFeedback(wasHelpful);

    if (!wasHelpful) {
      setShowComment(true);
    } else {
      await submitFeedback(wasHelpful);
    }
  };

  const submitFeedback = async (wasHelpful: boolean, commentText?: string) => {
    try {
      await fetch(`/api/faq/${faqId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wasHelpful,
          comment: commentText || null,
        }),
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const handleCommentSubmit = async () => {
    await submitFeedback(false, comment);
    setShowComment(false);
  };

  if (feedback !== null && !showComment) {
    return (
      <div className="text-green-600 text-sm mt-4">
        Obrigado pelo feedback!
      </div>
    );
  }

  return (
    <div className="mt-4 border-t pt-4">
      {!feedback && (
        <>
          <p className="text-sm text-gray-600 mb-2">Esta resposta foi útil?</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleFeedback(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 rounded-md"
            >
              <ThumbsUpIcon className="h-4 w-4" />
              Sim
            </button>
            <button
              onClick={() => handleFeedback(false)}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-md"
            >
              <ThumbsDownIcon className="h-4 w-4" />
              Não
            </button>
          </div>
        </>
      )}

      {showComment && (
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">
            O que podemos melhorar nesta resposta?
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Seu comentário (opcional)"
            className="w-full px-3 py-2 border rounded-md"
            rows={3}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleCommentSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Enviar
            </button>
            <button
              onClick={() => {
                submitFeedback(false);
                setShowComment(false);
              }}
              className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Pular
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 🎨 Design Sugerido

### Cores:
- Primária: Azul #1e40af (já usado no site)
- Sucesso: Verde #10b981
- Erro: Vermelho #ef4444
- Neutro: Cinza #6b7280

### Fontes:
- Usar as mesmas do site atual (Inter ou similar)

### Espaçamento:
- Usar Tailwind classes padrão
- Mobile-first design

---

## ✅ Checklist de Implementação

### Páginas Públicas:
- [ ] `/app/glossario/page.tsx`
- [ ] `/app/glossario/[slug]/page.tsx`
- [ ] `/app/faq/page.tsx`
- [ ] Componente: `GlossarySearch.tsx`
- [ ] Componente: `AlphabeticalNav.tsx`
- [ ] Componente: `CategoryFilter.tsx`
- [ ] Componente: `GlossaryTermCard.tsx`
- [ ] Componente: `FAQSearch.tsx`
- [ ] Componente: `FAQCategoryNav.tsx`
- [ ] Componente: `FAQAccordion.tsx`
- [ ] Componente: `FAQFeedback.tsx`

### Admin:
- [ ] `/app/admin/glossario/page.tsx`
- [ ] `/app/admin/glossario/novo/page.tsx`
- [ ] `/app/admin/glossario/editar/[id]/page.tsx`
- [ ] `/app/admin/faq/page.tsx`
- [ ] `/app/admin/faq/novo/page.tsx`
- [ ] `/app/admin/faq/editar/[id]/page.tsx`
- [ ] `/app/admin/faq/analytics/page.tsx`
- [ ] Componente: `GlossaryAdminTable.tsx`
- [ ] Componente: `FAQAdminTable.tsx`

### Navegação:
- [ ] Adicionar links no Header
- [ ] Adicionar links no Footer
- [ ] Adicionar links no menu Admin

### Testes:
- [ ] Testar busca no glossário
- [ ] Testar navegação alfabética
- [ ] Testar busca no FAQ
- [ ] Testar sistema de feedback
- [ ] Testar CRUD admin (glossário)
- [ ] Testar CRUD admin (FAQ)
- [ ] Testar analytics
- [ ] Testar responsividade mobile

### Conteúdo Inicial:
- [ ] Popular 30-50 termos no glossário
- [ ] Popular 20-30 perguntas no FAQ
- [ ] Categorizar termos
- [ ] Categorizar FAQs
- [ ] Adicionar relacionamentos

### Final:
- [ ] Atualizar CLAUDE.md com novas features
- [ ] Criar PR para main
- [ ] Testar em produção

---

## 🚀 Como Continuar

1. **Criar as páginas públicas primeiro** (glossário e FAQ)
2. **Testar as funcionalidades públicas**
3. **Criar o admin UI**
4. **Popular conteúdo inicial**
5. **Testar tudo**
6. **Merge para main**

---

**Estimativa de tempo restante:** 5-7 dias de desenvolvimento
**Complexity:** Média (principalmente UI/UX, backend já está pronto)

Bom trabalho! 🎉
