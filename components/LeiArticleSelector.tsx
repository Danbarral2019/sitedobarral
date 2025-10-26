'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Search, Hash } from 'lucide-react';
import {
  LEI_14133_ARTIGOS,
  LeiArticle,
  formatArticleNumber,
  searchLeiArticles,
  ARTIGOS_POPULARES
} from '@/data/lei-14133-artigos';

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
  }, [searchTerm, selectedArticles]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
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
        <label className="block text-sm font-medium text-gray-900">
          {label}
          <span className="ml-2 text-xs text-gray-500">
            ({selectedArticles.length}/{maxArticles})
          </span>
        </label>
      )}

      {/* Tags de artigos selecionados */}
      {selectedArticles.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border-2 border-gray-200 rounded-lg">
          {selectedArticles.map((articleNumber) => {
            const article = LEI_14133_ARTIGOS[articleNumber];
            if (!article) return null;

            return (
              <div
                key={articleNumber}
                className="group inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-900 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Hash className="w-3.5 h-3.5" />
                <span className="text-sm font-medium">
                  {formatArticleNumber(articleNumber)}
                </span>
                <span className="text-xs text-blue-700 max-w-[200px] truncate">
                  {article.ementa}
                </span>
                <button
                  type="button"
                  onClick={() => removeArticle(articleNumber)}
                  className="ml-1 p-0.5 hover:bg-blue-300 rounded transition-colors"
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        {/* Dropdown de sugestões */}
        {isDropdownOpen && filteredArticles.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-xl max-h-80 overflow-y-auto"
          >
            {filteredArticles.map((article, index) => (
              <button
                key={article.numero}
                type="button"
                onClick={() => addArticle(article.numero)}
                className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                  index === highlightedIndex ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
                    {article.numero}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 mb-1">
                      {formatArticleNumber(article.numero)}
                    </div>
                    <div className="text-sm text-gray-700 line-clamp-2">
                      {article.ementa}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
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
          <p className="text-xs text-gray-600 font-medium">Artigos populares:</p>
          <div className="flex flex-wrap gap-2">
            {ARTIGOS_POPULARES.slice(0, 6).map((articleNumber) => {
              const article = LEI_14133_ARTIGOS[articleNumber];
              if (!article) return null;

              return (
                <button
                  key={articleNumber}
                  type="button"
                  onClick={() => addArticle(articleNumber)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-900 rounded-lg transition-colors text-sm"
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
      <p className="text-xs text-gray-500">
        💡 Dica: Digite o número do artigo ou palavras-chave da ementa. Use as setas ↑↓ para navegar e Enter para selecionar.
      </p>
    </div>
  );
}
