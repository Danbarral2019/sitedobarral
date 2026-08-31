'use client';

import { useState } from 'react';
import { Mail, Loader2, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CancelarNewsletterPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/newsletter?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cancelar inscrição');
      }

      setIsSuccess(true);
      setEmail('');
    } catch (err) {
      console.error('Erro ao cancelar newsletter:', err);
      setError(err instanceof Error ? err.message : 'Erro ao cancelar inscrição. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 py-16 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Botão Voltar */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o site
        </Link>

        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-8 md:p-12">
          {isSuccess ? (
            // Mensagem de Sucesso
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-surface-page" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Inscrição Cancelada
              </h1>
              <p className="text-lg text-gray-700 mb-6">
                Sua inscrição na newsletter foi cancelada com sucesso.
              </p>
              <p className="text-gray-600 mb-8">
                Você não receberá mais nossos conteúdos por e-mail. Caso mude de ideia,
                você pode se inscrever novamente a qualquer momento.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-primary-600 text-surface-page px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                Voltar para o Site
              </Link>
            </div>
          ) : (
            // Formulário de Cancelamento
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  Cancelar Inscrição na Newsletter
                </h1>
                <p className="text-lg text-gray-700">
                  Sentimos muito em vê-lo partir. Para cancelar sua inscrição,
                  confirme seu e-mail abaixo.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-semantic-error rounded-lg p-4 mb-6">
                  <p className="text-red-800 font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    E-mail cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      disabled={isSubmitting}
                      className="w-full pl-12 pr-4 py-4 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-red-500 text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Atenção:</strong> Ao cancelar sua inscrição, você não receberá mais:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-yellow-700 list-disc list-inside">
                    <li>Conteúdos exclusivos sobre Direito Administrativo</li>
                    <li>Atualizações sobre a Lei 14.133/2021</li>
                    <li>Novos artigos e materiais do blog</li>
                    <li>Avisos sobre novos cursos e turmas</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 text-surface-page px-6 py-4 rounded-lg font-bold hover:bg-semantic-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Cancelando inscrição...
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5" />
                      Confirmar Cancelamento
                    </>
                  )}
                </button>

                <p className="text-center text-sm text-gray-500">
                  Mudou de ideia?{' '}
                  <Link href="/" className="text-primary-600 hover:text-primary-700 font-semibold">
                    Voltar para o site
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>

        {/* Informação adicional */}
        {!isSuccess && (
          <div className="mt-6 text-center text-sm text-gray-600">
            <p>
              Dúvidas ou problemas?{' '}
              <Link href="/contato" className="text-primary-600 hover:text-primary-700 font-semibold">
                Entre em contato conosco
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
