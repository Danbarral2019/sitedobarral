'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  text: string;
  rating: number;
  avatar: string;
  color: string;
}

// Limite máximo de depoimentos a serem exibidos no carrossel
const MAX_TESTIMONIALS = 10;

// Função para selecionar aleatoriamente N itens de um array
function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

export default function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Buscar depoimentos aprovados da API
  useEffect(() => {
    async function loadApprovedTestimonials() {
      try {
        const response = await fetch('/api/testimonials');
        const data = await response.json();

        if (data.success && data.testimonials.length > 0) {
          // Se houver mais depoimentos do que o limite, fazer rodízio aleatório
          const selectedTestimonials =
            data.testimonials.length > MAX_TESTIMONIALS
              ? getRandomItems(data.testimonials, MAX_TESTIMONIALS)
              : data.testimonials;

          setTestimonials(selectedTestimonials);
        }
      } catch (error) {
        console.error('Erro ao carregar depoimentos:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadApprovedTestimonials();
  }, []);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  // Autoplay
  useEffect(() => {
    if (!isAutoPlaying || testimonials.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000); // Muda a cada 5 segundos

    return () => clearInterval(interval);
  }, [isAutoPlaying, testimonials.length]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false); // Para o autoplay quando o usuário clica
  };

  const handlePrevClick = () => {
    goToPrevious();
    setIsAutoPlaying(false);
  };

  const handleNextClick = () => {
    goToNext();
    setIsAutoPlaying(false);
  };

  // Não mostrar nada se estiver carregando ou não houver depoimentos
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-muted">Carregando depoimentos...</p>
      </div>
    );
  }

  if (testimonials.length === 0) {
    return null; // Não mostrar a seção se não houver depoimentos
  }

  // Mostrar 2 depoimentos no desktop, 1 no mobile
  const testimonialsPerView = 2;
  const visibleTestimonials = testimonials.slice(
    currentIndex,
    currentIndex + testimonialsPerView
  ).concat(
    testimonials.slice(0, Math.max(0, currentIndex + testimonialsPerView - testimonials.length))
  );

  return (
    <div className="relative">
      {/* Depoimentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        {visibleTestimonials.map((testimonial, idx) => (
          <div
            key={`${testimonial.id}-${idx}`}
            className="bg-white p-8 rounded-[6px] border-2 border-border-subtle hover:border-accent-400 hover: transition-all animate-fade-in"
          >
            <div className="flex mb-4 gap-1">
              {[...Array(testimonial.rating)].map((_, i) => (
                <Star key={i} className="w-6 h-6 fill-amber-accent text-amber-accent-deep" />
              ))}
            </div>
            <p className="text-ink-secondary mb-6 italic text-lg leading-relaxed">
              &quot;{testimonial.text}&quot;
            </p>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 ${testimonial.color} rounded-full flex items-center justify-center text-white font-bold text-xl`}>
                {testimonial.avatar}
              </div>
              <div>
                <p className="font-bold text-ink-primary">{testimonial.name}</p>
                <p className="text-sm text-ink-muted">{testimonial.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Controles de Navegação */}
      <div className="flex items-center justify-center gap-6 mt-8">
        {/* Botão Anterior */}
        <button
          onClick={handlePrevClick}
          aria-label="Depoimento anterior"
          className="w-12 h-12 bg-brand-700 text-white rounded-full flex items-center justify-center hover:from-brand-700 hover:to-brand-800 transition-all hover: hover:scale-110 active:scale-95 border border-border-subtle"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Indicadores (Dots) */}
        <div className="flex gap-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              aria-label={`Ir para depoimento ${index + 1}`}
              className={`transition-all ${
                index === currentIndex
                  ? 'w-8 h-3 bg-accent-400 rounded-full'
                  : 'w-3 h-3 bg-border-strong hover:bg-border-strong rounded-full'
              }`}
            />
          ))}
        </div>

        {/* Botão Próximo */}
        <button
          onClick={handleNextClick}
          aria-label="Próximo depoimento"
          className="w-12 h-12 bg-brand-700 text-white rounded-full flex items-center justify-center hover:from-brand-700 hover:to-brand-800 transition-all hover: hover:scale-110 active:scale-95 border border-border-subtle"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Contador de Depoimentos */}
      <div className="text-center mt-4">
        <p className="text-sm text-ink-muted font-medium">
          {currentIndex + 1} de {testimonials.length} depoimentos
        </p>
      </div>
    </div>
  );
}
