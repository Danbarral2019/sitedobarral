'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { searchArticles, formatArticleNumber, getArticleIcon } from '@/lib/article-utils';
import type { LeiArticle } from '@/data/lei-14133-artigos';

interface ArticleAutocompleteProps {
  selectedArticles: string[];
  onSelect: (articleNumber: string) => void;
  onRemove: (articleNumber: string) => void;
  placeholder?: string;
}

export function ArticleAutocomplete({
  selectedArticles,
  onSelect,
  onRemove,
  placeholder = 'Buscar por artigo da Lei 14.133...'
}: ArticleAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<LeiArticle[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Busca sugestões quando o termo muda
  useEffect(() => {
    if (searchTerm.trim().length > 0) {
      const results = searchArticles(searchTerm, 10);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setHighlightedIndex(0);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [searchTerm]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (article: LeiArticle) => {
    if (!selectedArticles.includes(article.numero)) {
      onSelect(article.numero);
    }
    setSearchTerm('');
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (suggestions[highlightedIndex]) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="relative w-full">
      {/* Input de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        />
      </div>

      {/* Dropdown de sugestões */}
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto"
        >
          {suggestions.map((article, index) => {
            const isSelected = selectedArticles.includes(article.numero);
            const isHighlighted = index === highlightedIndex;

            return (
              <button
                key={article.numero}
                onClick={() => handleSelect(article)}
                disabled={isSelected}
                className={`
                  w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0
                  transition-colors
                  ${isHighlighted ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  ${isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0 mt-0.5">
                    {getArticleIcon(article.numero)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        {formatArticleNumber(article.numero)}
                      </span>
                      {article.secao && (
                        <span className="text-xs text-gray-500 truncate">
                          {article.secao}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {article.ementa}
                    </p>
                    {isSelected && (
                      <span className="inline-block mt-1 text-xs text-blue-600 font-medium">
                        ✓ Já selecionado
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Artigos selecionados (chips) */}
      {selectedArticles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedArticles.map((articleNum) => (
            <div
              key={articleNum}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
            >
              <span>{formatArticleNumber(articleNum)}</span>
              <button
                onClick={() => onRemove(articleNum)}
                className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                aria-label={`Remover ${formatArticleNumber(articleNum)}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
