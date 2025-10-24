'use client';

import { ExternalLink, Globe } from 'lucide-react';
import Image from 'next/image';

interface RecommendedSite {
  id: string;
  title: string;
  description: string;
  url: string;
  faviconUrl?: string | null;
}

interface RecommendedSitesProps {
  sites: RecommendedSite[];
}

export default function RecommendedSites({ sites }: RecommendedSitesProps) {
  if (!sites || sites.length === 0) {
    return null; // Não renderiza nada se não houver sites
  }

  // Função para obter o domínio limpo da URL
  const getDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200 mt-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Globe className="w-7 h-7 text-blue-600" />
          Sites de Interesse
        </h2>
        <p className="text-gray-600">
          Links úteis e referências complementares para seus estudos
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {sites.map((site) => (
          <a
            key={site.id}
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-md transition-all bg-gradient-to-br from-white to-gray-50 hover:from-blue-50 hover:to-purple-50"
          >
            {/* Favicon */}
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center overflow-hidden border border-gray-200">
              {site.faviconUrl ? (
                <Image
                  src={site.faviconUrl}
                  alt={`${site.title} favicon`}
                  width={32}
                  height={32}
                  className="w-8 h-8"
                  onError={(e) => {
                    // Se o favicon falhar, mostra o ícone padrão
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
                    }
                  }}
                />
              ) : (
                <Globe className="w-6 h-6 text-blue-600" />
              )}
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {site.title}
                </h3>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0 mt-1" />
              </div>
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {site.description}
              </p>
              <p className="text-xs text-blue-600 font-medium truncate">
                {getDomain(site.url)}
              </p>
            </div>
          </a>
        ))}
      </div>

      {/* Rodapé informativo */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          💡 <strong>Dica:</strong> Estes sites foram cuidadosamente selecionados como fontes confiáveis de informação complementar ao curso.
        </p>
      </div>
    </div>
  );
}
