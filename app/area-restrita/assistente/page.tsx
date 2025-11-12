'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Bot } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { ChatInterface } from '@/components/ChatInterface';

export default function AssistentePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  // Loading state
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Verificando acesso...</p>
        </div>
      </main>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-6 lg:py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/area-restrita')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                  Assistente IA
                </h1>
                <p className="text-gray-600 mt-1">
                  Faça perguntas sobre seus materiais de estudo com busca semântica
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="h-[calc(100vh-240px)] lg:h-[calc(100vh-200px)]">
          <ChatInterface
            placeholder="Faça uma pergunta sobre licitações, contratos ou documentos do curso..."
            suggestedQuestions={[
              'Quais são os principais tipos de licitação segundo a Lei 14.133?',
              'O que é pregão eletrônico e quando deve ser usado?',
              'Como funciona a dispensa de licitação?',
              'Quais os requisitos para participar de uma licitação?',
              'Explique o processo de habilitação em licitações',
              'O que são contratos administrativos?',
            ]}
            maxMessages={100}
            enableHistory={true}
          />
        </div>

        {/* Footer Info */}
        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-900 font-medium text-center">
            💡 O assistente busca nos seus documentos indexados e responde com base no conteúdo real dos materiais
          </p>
        </div>
      </div>
    </main>
  );
}
