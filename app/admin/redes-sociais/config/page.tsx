'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, CheckCircle, XCircle, ExternalLink, FileText } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';

export default function RedesSociaisConfigPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [instagramConfigured, setInstagramConfigured] = useState(false);
  const [linkedinConfigured, setLinkedinConfigured] = useState(false);

  const verifyAdmin = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify');

      if (!response.ok) {
        router.push('/validar-acesso');
        return;
      }

      const data = await response.json();

      if (data.user.role !== 'admin') {
        router.push('/area-restrita');
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar admin:', error);
      router.push('/validar-acesso');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    verifyAdmin();

    // Verificar se as variáveis de ambiente estão configuradas
    // (isso será feito no servidor, aqui é apenas indicativo)
    const checkConfig = () => {
      // Instagram
      setInstagramConfigured(
        typeof process.env.NEXT_PUBLIC_INSTAGRAM_CONFIGURED !== 'undefined'
      );

      // LinkedIn
      setLinkedinConfigured(
        typeof process.env.NEXT_PUBLIC_LINKEDIN_CONFIGURED !== 'undefined'
      );
    };

    checkConfig();
  }, [verifyAdmin]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/admin/redes-sociais"
              className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors mb-4 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para Redes Sociais
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">⚙️ Configuração de Redes Sociais</h1>
            <p className="text-gray-600">Configure a integração com Instagram e LinkedIn</p>
          </div>

          {/* Status de Conexão */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-8 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Status de Conexão</h2>

            <div className="space-y-4">
              {/* Instagram */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-2xl">
                    📸
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Instagram</h3>
                    <p className="text-sm text-gray-600">Meta Graph API</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {instagramConfigured ? (
                    <span className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                      <CheckCircle className="w-5 h-5" />
                      Configurado
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 rounded-lg font-medium">
                      <XCircle className="w-5 h-5" />
                      Não Configurado
                    </span>
                  )}
                </div>
              </div>

              {/* LinkedIn */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-2xl">
                    💼
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">LinkedIn</h3>
                    <p className="text-sm text-gray-600">Share API</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {linkedinConfigured ? (
                    <span className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                      <CheckCircle className="w-5 h-5" />
                      Configurado
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 rounded-lg font-medium">
                      <XCircle className="w-5 h-5" />
                      Não Configurado
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Documentação */}
          <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-8 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-2">📚 Guia de Configuração</h2>
                <p className="text-gray-700 mb-4">
                  Siga o guia completo passo a passo para configurar as integrações com Instagram e LinkedIn.
                </p>
                <a
                  href="https://github.com/Danbarral2019/sitedobarral/blob/main/CONFIGURACAO_REDES_SOCIAIS.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                >
                  Abrir Guia Completo
                  <ExternalLink className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          {/* Variáveis de Ambiente */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🔐 Variáveis de Ambiente Necessárias</h2>
            <p className="text-gray-600 mb-6">
              Configure estas variáveis no painel da Vercel em: <strong>Settings → Environment Variables</strong>
            </p>

            <div className="space-y-6">
              {/* Instagram */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  📸 Instagram (Meta Graph API)
                </h3>
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-100 overflow-x-auto">
                  <div>INSTAGRAM_APP_ID=<span className="text-yellow-300">seu_app_id</span></div>
                  <div>INSTAGRAM_APP_SECRET=<span className="text-yellow-300">seu_app_secret</span></div>
                  <div>INSTAGRAM_ACCESS_TOKEN=<span className="text-yellow-300">seu_access_token</span></div>
                  <div>INSTAGRAM_BUSINESS_ACCOUNT_ID=<span className="text-yellow-300">seu_business_id</span></div>
                </div>
              </div>

              {/* LinkedIn */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  💼 LinkedIn (Share API)
                </h3>
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-100 overflow-x-auto">
                  <div>LINKEDIN_CLIENT_ID=<span className="text-yellow-300">seu_client_id</span></div>
                  <div>LINKEDIN_CLIENT_SECRET=<span className="text-yellow-300">seu_client_secret</span></div>
                  <div>LINKEDIN_ACCESS_TOKEN=<span className="text-yellow-300">seu_access_token</span></div>
                  <div>LINKEDIN_PERSON_URN=<span className="text-yellow-300">urn:li:person:seu_id</span></div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Importante:</strong> Após adicionar as variáveis na Vercel, você precisa fazer um redeploy do site para que as mudanças tenham efeito.
              </p>
            </div>
          </div>

          {/* Como Funciona */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-8 mt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🚀 Como Funciona</h2>
            <ol className="space-y-3 list-decimal list-inside text-gray-700">
              <li>Configure as variáveis de ambiente na Vercel</li>
              <li>Redeploy o site</li>
              <li>Ao criar ou editar um post do blog, marque a opção "Publicar nas redes sociais"</li>
              <li>Ao publicar o post, ele será automaticamente compartilhado no Instagram e LinkedIn</li>
              <li>Acompanhe o status das publicações na tela de <Link href="/admin/redes-sociais" className="text-blue-600 hover:underline">Redes Sociais</Link></li>
            </ol>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
