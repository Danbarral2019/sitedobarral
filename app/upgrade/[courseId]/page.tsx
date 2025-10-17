'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

interface PageProps {
  params: {
    courseId: string;
  };
}

export default function UpgradePage({ params }: PageProps) {
  const { courseId } = params;
  const router = useRouter();
  const { user, isLoading, getEnrollmentStatus } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enrollmentStatus, setEnrollmentStatus] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push(`/login?returnTo=/upgrade/${courseId}`);
      return;
    }

    if (user) {
      const status = getEnrollmentStatus(courseId);
      setEnrollmentStatus(status);

      // Se já tem acesso vitalício, redireciona
      if (status?.isLifetime) {
        router.push('/area-restrita');
      }
    }
  }, [user, isLoading, courseId, router, getEnrollmentStatus]);

  const handleUpgrade = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/enrollment/upgrade-lifetime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId: courseId,
          // Em produção, aqui você passaria informações de pagamento
          // price: valorPago (obtido do gateway de pagamento)
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Upgrade realizado com sucesso
        router.push('/area-restrita?upgraded=true');
      } else {
        setError(data.error || 'Erro ao processar upgrade');
      }
    } catch (err) {
      console.error('Erro ao processar upgrade:', err);
      setError('Erro ao processar upgrade. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  const daysRemaining = enrollmentStatus?.daysRemaining || 0;
  const expiresAt = enrollmentStatus?.expiresAt ? new Date(enrollmentStatus.expiresAt).toLocaleDateString('pt-BR') : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Upgrade para Acesso Vitalício
          </h1>
          <p className="text-xl text-gray-600">
            Tenha acesso ilimitado a todos os materiais do curso
          </p>
        </div>

        {/* Status atual */}
        {enrollmentStatus && !enrollmentStatus.isLifetime && (
          <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-yellow-900 mb-2">
              Seu acesso atual:
            </h2>
            <p className="text-yellow-800">
              Você tem acesso até <strong>{expiresAt}</strong>
              {daysRemaining > 0 && ` (faltam ${daysRemaining} dias)`}
            </p>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Comparação de planos */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Plano Anual (atual) */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-gray-200">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Acesso Anual
              </h3>
              <p className="text-gray-600">Seu plano atual</p>
            </div>

            <div className="mb-6">
              <div className="text-center py-4">
                <span className="text-4xl font-bold text-gray-900">1 Ano</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Acesso completo aos materiais</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Atualizações durante o período</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-red-500 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-gray-700">Expira após 1 ano</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-red-500 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-gray-700">Perde acesso aos materiais</span>
              </li>
            </ul>

            <div className="text-center">
              <span className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold">
                Plano Atual
              </span>
            </div>
          </div>

          {/* Plano Vitalício (upgrade) */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-xl p-8 border-2 border-blue-500 relative">
            {/* Badge de recomendado */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="inline-block px-6 py-2 bg-yellow-400 text-yellow-900 rounded-full font-bold text-sm shadow-lg">
                ⭐ RECOMENDADO
              </span>
            </div>

            <div className="text-center mb-6 mt-4">
              <h3 className="text-2xl font-bold text-white mb-2">
                Acesso Vitalício
              </h3>
              <p className="text-blue-100">O melhor investimento</p>
            </div>

            <div className="mb-6">
              <div className="text-center py-4">
                <span className="text-4xl font-bold text-white">∞</span>
                <p className="text-blue-100 mt-2">Para sempre</p>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-300 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white">Acesso completo aos materiais</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-300 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white">Todas as atualizações futuras</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-300 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white font-semibold">Nunca expira</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-300 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white">Consulte sempre que precisar</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-300 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white">Material de referência permanente</span>
              </li>
            </ul>

            <div className="text-center">
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-4 px-6 rounded-lg transition-colors disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed shadow-lg"
              >
                {loading ? 'Processando...' : 'Fazer Upgrade Agora'}
              </button>
            </div>
          </div>
        </div>

        {/* Benefícios adicionais */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Por que fazer o upgrade?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Sem Pressa</h3>
              <p className="text-sm text-gray-600">
                Estude no seu ritmo, sem se preocupar com prazo de validade
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Material de Referência</h3>
              <p className="text-sm text-gray-600">
                Consulte os materiais sempre que precisar em sua carreira
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Atualizações Incluídas</h3>
              <p className="text-sm text-gray-600">
                Receba todas as atualizações e novos materiais automaticamente
              </p>
            </div>
          </div>
        </div>

        {/* FAQ ou observações */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-blue-900 mb-3">
            📝 Observações Importantes:
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• O upgrade é processado imediatamente após a confirmação</li>
            <li>• Você manterá todo o progresso e histórico de acesso</li>
            <li>• O acesso vitalício nunca expira - é seu para sempre</li>
            <li>• Em caso de dúvidas, entre em contato com o professor</li>
          </ul>
        </div>

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/area-restrita"
            className="inline-block text-center border border-gray-300 text-gray-700 py-3 px-8 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Voltar para Área Restrita
          </Link>
          <Link
            href="/contato"
            className="inline-block text-center border border-blue-600 text-blue-600 py-3 px-8 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            Falar com o Professor
          </Link>
        </div>
      </div>
    </div>
  );
}
