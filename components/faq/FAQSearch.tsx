'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface FAQSearchProps {
  initialSearch?: string;
  initialCategory?: string;
  categories: string[];
}

export function FAQSearch({ initialSearch = '', initialCategory = '', categories }: FAQSearchProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);

  const submit = (newSearch: string, newCategory: string) => {
    const params = new URLSearchParams();
    if (newSearch.trim()) params.set('search', newSearch.trim());
    if (newCategory) params.set('category', newCategory);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/faq?${qs}` : '/faq');
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-3 mb-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(search, category);
        }}
        className="flex-1 relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar perguntas..."
          className="w-full pl-10 pr-4 py-3 border border-border-strong rounded-[3px] focus:ring-2 focus:ring-amber-accent focus:border-brand-600"
        />
      </form>

      <select
        value={category}
        onChange={(e) => {
          setCategory(e.target.value);
          submit(search, e.target.value);
        }}
        className="px-4 py-3 border border-border-strong rounded-[3px] focus:ring-2 focus:ring-amber-accent bg-surface-page text-ink-primary"
        disabled={isPending}
      >
        <option value="">Todas as categorias</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
    </div>
  );
}
