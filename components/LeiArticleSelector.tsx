'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Search, Hash } from 'lucide-react';
import type { LeiArticle } from '@/data/lei-14133-artigos';
import { useLeiArticles } from '@/hooks/useLeiArticles';

// Inline para evitar pesar bundle com import do data/lei-14133-artigos.ts (~329 KB)
const formatArticleNumber = (numero: string) => `Art. ${numero}º`;
const ARTIGOS_POPULARES = [
  '5', '6', '8', '12', '18', '22', '29', '30',
  '72', '74', '75', '124', '137', '155', '160', '191',
];

interface LeiArticleSelectorProps {
  selectedArticles: string[]; // Array de números de artigos (ex: ["1", "6", "30"])
  onChange: (articles: string[]) => void;
  maxArticles?: number;
  placeholder?: string;
  label?: string;
  showPopularArticles?: boolean;
}

export default function LeiArticleSelector({
  selectedArticles,
  onChange,
  maxArticles = 10,
  placeholder = "Digite o número do artigo (ex: 1, 6, 30)...",
  label = "Artigos da Lei 14.133/2021",
  showPopularArticles = true,
}: LeiArticleSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredArticles, setFilteredArticles] = useState<LeiArticle[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { articles: artigos } = useLeiArticles();

  // Busca local nos artigos carregados pelo hook
  const searchLeiArticles = useMemo(() => (searchTerm: string): LeiArticle[] => {
    const term = searchTerm.toLowerCase();
    return Object.values(artigos).filter(
      (art) =>
        art.numero.includes(term) ||
        art.ementa.toLowerCase().includes(term) ||
        art.capitulo.toLowerCase().includes(term) ||
        art.secao?.toLowerCase().includes(term)
    );
  }, [artigos]);

  // Atualizar sugestões quando searchTerm mudar
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredArticles([]);
      setIsDropdownOpen(false);
      return;
    }

    // Buscar artigos que correspondam ao termo
    const results = searchLeiArticles(searchTerm)
      .filter(art => !selectedArticles.includes(art.numero))
      .slice(0, 8); // Limitar a 8 resultados

    setFilteredArticles(results);
    setIsDropdownOpen(results.length > 0);
    setHighlightedIndex(0);
  }, [searchTerm, selectedArticles, searchLeiArticles]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    // Guard against SSR
    if (typeof window === 'undefined') return;

    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addArticle = (articleNumber: string) => {
    if (selectedArticles.length >= maxArticles) {
      alert(`Você pode selecionar no máximo ${maxArticles} artigos.`);
      return;
    }

    if (!selectedArticles.includes(articleNumber)) {
      onChange([...selectedArticles, articleNumber]);
    }

    setSearchTerm('');
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  };

  const removeArticle = (articleNumber: string) => {
    onChange(selectedArticles.filter(num => num !== articleNumber));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || filteredArticles.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredArticles.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredArticles[highlightedIndex]) {
          addArticle(filteredArticles[highlightedIndex].numero);
        }
        break;
      case 'Escape':
        setIsDropdownOpen(false);
        break;
    }
  };

  return (
    <div className="space-y-3">
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-ink-primary">
          {label}
          <span className="ml-2 text-xs text-ink-muted">
            ({selectedArticles.length}/{maxArticles})
          </span>
        </label>
      )}

      {/* Tags de artigos selecionados */}
      {selectedArticles.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-surface-raised border-2 border-border-subtle rounded-[6px]">
          {selectedArticles.map((articleNumber) => {
            const article = artigos[articleNumber];
            if (!article) return null;

            return (
              <div
                key={articleNumber}
                className="group inline-flex items-center gap-2 px-3 py-1.5 bg-brand-100 text-brand-900 rounded-[6px] hover:bg-brand-200 transition-colors"
              >
                <Hash className="w-3.5 h-3.5" />
                <span className="text-sm font-medium">
                  {formatArticleNumber(articleNumber)}
                </span>
                <span className="text-xs text-brand-700 max-w-[200px] truncate">
                  {article.ementa}
                </span>
                <button
                  type="button"
                  onClick={() => removeArticle(articleNumber)}
                  className="ml-1 p-0.5 hover:bg-brand-300 rounded transition-colors"
                  title="Remover artigo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Campo de busca com autocomplete */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (searchTerm && filteredArticles.length > 0) {
                setIsDropdownOpen(true);
              }
            }}
            placeholder={placeholder}
            disabled={selectedArticles.length >= maxArticles}
            className="w-full pl-10 pr-4 py-2.5 border-2 border-border-subtle rounded-[6px] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all disabled:bg-surface-deep disabled:cursor-not-allowed"
          />
        </div>

        {/* Dropdown de sugestões */}
        {isDropdownOpen && filteredArticles.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-2 bg-white border-2 border-border-subtle rounded-[6px] max-h-80 overflow-y-auto"
          >
            {filteredArticles.map((article, index) => (
              <button
                key={article.numero}
                type="button"
                onClick={() => addArticle(article.numero)}
                className={`w-full px-4 py-3 text-left hover:bg-brand-50 transition-colors border-b border-border-subtle last:border-b-0 ${
                  index === highlightedIndex ? 'bg-brand-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-14 h-14 bg-brand-600 rounded-[6px] flex items-center justify-center text-white font-bold border border-border-subtle">
                    {article.numero}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-ink-primary mb-1">
                      {formatArticleNumber(article.numero)}
                    </div>
                    <div className="text-sm text-ink-secondary line-clamp-2">
                      {article.ementa}
                    </div>
                    <div className="text-xs text-ink-muted mt-1">
                      {article.capitulo}
                      {article.secao && ` • ${article.secao}`}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Artigos populares (opcional) */}
      {showPopularArticles && selectedArticles.length === 0 && !searchTerm && (
        <div className="space-y-2">
          <p className="text-xs text-ink-muted font-medium">Artigos populares:</p>
          <div className="flex flex-wrap gap-2">
            {ARTIGOS_POPULARES.slice(0, 6).map((articleNumber) => {
              const article = artigos[articleNumber];
              if (!article) return null;

              return (
                <button
                  key={articleNumber}
                  type="button"
                  onClick={() => addArticle(articleNumber)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-deep hover:bg-brand-100 text-ink-secondary hover:text-brand-900 rounded-[6px] transition-colors text-sm"
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span className="font-medium">{formatArticleNumber(articleNumber)}</span>
                  <span className="text-xs max-w-[150px] truncate">
                    {article.ementa}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dica de uso */}
      <p className="text-xs text-ink-muted">
        💡 Dica: Digite o número do artigo ou palavras-chave da ementa. Use as setas ↑↓ para navegar e Enter para selecionar.
      </p>
    </div>
  );
}
