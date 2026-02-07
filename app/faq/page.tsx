'use client';

import { useState, useEffect, useCallback } from 'react';
import { FAQSearch } from '@/components/faq/FAQSearch';
import { FAQCategoryNav } from '@/components/faq/FAQCategoryNav';
import { FAQAccordion } from '@/components/faq/FAQAccordion';
import { HelpCircle, Loader2 } from 'lucide-react';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  isPinned: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [filteredFaqs, setFilteredFaqs] = useState<FAQ[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar todas as FAQs ao carregar
  useEffect(() => {
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/faq');
      const data = await response.json();
      setFaqs(data.faqs || []);
      setFilteredFaqs(data.faqs || []);
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Erro ao buscar FAQs:', err);
      setError('Erro ao carregar perguntas. Tente recarregar a página.');
    } finally {
      setLoading(false);
    }
  };

  // Buscar FAQs
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      // Se não há busca, aplicar filtro de categoria
      applyFilters(faqs, activeCategory);
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      const response = await fetch(`/api/faq/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setFilteredFaqs(data.faqs || []);
    } catch (err) {
      console.error('Erro ao buscar:', err);
      setError('Erro ao realizar a busca. Tente novamente.');
    } finally {
      setIsSearching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faqs, activeCategory]);

  // Aplicar filtro de categoria
  const applyFilters = useCallback((faqsList: FAQ[], category: string | null) => {
    let filtered = [...faqsList];

    if (category) {
      filtered = filtered.filter(f => f.category === category);
    }

    setFilteredFaqs(filtered);
  }, []);

  // Handler para categoria
  const handleCategoryChange = useCallback((category: string | null) => {
    setActiveCategory(category);
    setSearchQuery('');
    applyFilters(faqs, category);
  }, [faqs, applyFilters]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <HelpCircle className="h-16 w-16" />
            </div>
            <h1 className="text-4xl font-bold mb-4 font-cinzel">
              Perguntas Frequentes
            </h1>
            <p className="text-xl text-brand-100 max-w-2xl mx-auto">
              Encontre respostas rápidas para as dúvidas mais comuns sobre licitações, documentos e acesso ao site
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search Bar */}
        <div className="mb-8">
          <FAQSearch onSearch={handleSearch} />
        </div>

        {/* Category Navigation */}
        {!loading && categories.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm mb-8">
            <FAQCategoryNav
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div role="alert" className="bg-red-50 border-2 border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {/* Search Loading Indicator */}
        {isSearching && (
          <div className="flex items-center justify-center py-4 mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
            <span className="ml-2 text-gray-600 text-sm">Buscando...</span>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            <span className="ml-2 text-gray-600">Carregando perguntas...</span>
          </div>
        ) : filteredFaqs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <HelpCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma pergunta encontrada
            </h3>
            <p className="text-gray-600">
              {searchQuery
                ? `Não encontramos perguntas para "${searchQuery}"`
                : 'Não há perguntas para a categoria selecionada'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Exibindo {filteredFaqs.length} {filteredFaqs.length === 1 ? 'pergunta' : 'perguntas'}
              {searchQuery && ` para "${searchQuery}"`}
              {activeCategory && ` na categoria "${activeCategory}"`}
            </div>

            <FAQAccordion faqs={filteredFaqs} />
          </>
        )}

        {/* Help Section */}
        {!loading && (
          <div className="mt-12 bg-brand-50 border border-brand-200 rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold text-brand-900 mb-2">
              Não encontrou o que procura?
            </h3>
            <p className="text-brand-800 mb-4">
              Entre em contato conosco através da página de contato
            </p>
            <a
              href="/contato"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700 transition-colors"
            >
              Fale Conosco
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
