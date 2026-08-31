'use client';

import { useState } from 'react';
import { Mail, Loader2, CheckCircle } from 'lucide-react';

interface NewsletterFormProps {
  className?: string;
  showInterests?: boolean;
  variant?: 'default' | 'inline';
  source?: string;
}

export default function NewsletterForm({
  className = '',
  showInterests = false,
  variant = 'default',
  source,
}: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const availableInterests = [
    'Lei 14.133/2021',
    'Gestão de Contratos',
    'Licitações',
    'Direito Administrativo',
    'Jurisprudência',
  ];

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || null,
          interests: interests.length > 0 ? interests : null,
          source: source || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cadastrar');
      }

      setIsSuccess(true);
      setEmail('');
      setName('');
      setInterests([]);

      setTimeout(() => {
        setIsSuccess(false);
      }, 5000);
    } catch (err) {
      console.error('Erro ao cadastrar newsletter:', err);
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className={`bg-surface-raised border-2 border-brand-600 rounded-md p-6 text-center ${className}`}>
        <div className="w-12 h-12 bg-surface-raised0 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="w-6 h-6 text-brand-600" />
        </div>
        <h3 className="text-lg font-bold text-ink-primary mb-2">Cadastro realizado!</h3>
        <p className="text-ink-secondary">Você receberá nossos conteúdos no e-mail informado.</p>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className={`flex flex-col sm:flex-row gap-4 ${className}`}>
        {error && (
          <div role="alert" className="w-full bg-surface-raised border border-semantic-error rounded-[3px] p-3">
            <p className="text-semantic-error text-sm font-medium">{error}</p>
          </div>
        )}
        <label htmlFor="newsletter-email-inline" className="sr-only">Email para newsletter</label>
        <input
          id="newsletter-email-inline"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Seu e-mail"
          required
          disabled={isSubmitting}
          className="flex-1 px-4 py-3 rounded-[3px] border border-border-strong focus:outline-none focus:border-primary-500 text-ink-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary-600 text-surface-page px-6 py-3 rounded-[3px] font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Cadastrando...
            </>
          ) : (
            <>
              <Mail className="w-4 h-4" />
              Cadastrar
            </>
          )}
        </button>
      </form>
    );
  }

  return (
    <div className={className}>
      {error && (
        <div role="alert" className="bg-surface-raised border border-semantic-error rounded-[3px] p-3 mb-4">
          <p className="text-semantic-error text-sm font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="newsletter-email" className="sr-only">Email para newsletter</label>
          <input
            id="newsletter-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Seu e-mail *"
            required
            disabled={isSubmitting}
            className="w-full px-4 py-3 rounded-[3px] border border-border-strong focus:outline-none focus:border-primary-500 text-ink-primary disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="newsletter-name" className="sr-only">Nome (opcional)</label>
          <input
            id="newsletter-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome (opcional)"
            disabled={isSubmitting}
            className="w-full px-4 py-3 rounded-[3px] border border-border-strong focus:outline-none focus:border-primary-500 text-ink-primary disabled:opacity-50"
          />
        </div>

        {showInterests && (
          <div>
            <p className="text-sm font-semibold text-ink-secondary mb-2">
              Áreas de interesse (opcional):
            </p>
            <div className="flex flex-wrap gap-2">
              {availableInterests.map((interest) => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  disabled={isSubmitting}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    interests.includes(interest)
                      ? 'bg-primary-600 text-surface-page'
                      : 'bg-surface-deep text-ink-secondary hover:bg-border-strong'
                  } disabled:opacity-50`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary-600 text-surface-page px-6 py-3 rounded-[3px] font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Cadastrando...
            </>
          ) : (
            <>
              <Mail className="w-5 h-5" />
              Cadastrar na Newsletter
            </>
          )}
        </button>
      </form>
    </div>
  );
}
