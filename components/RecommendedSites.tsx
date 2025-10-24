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

      <div className="space-y-2">
        {sites.map((site) => (
          <a
            key={site.id}
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors"
          >
            {/* Favicon */}
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
              {site.faviconUrl ? (
                <Image
                  src={site.faviconUrl}
                  alt={`${site.title} favicon`}
                  width={16}
                  height={16}
                  className="w-4 h-4"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <Globe className="w-4 h-4 text-gray-400" />
              )}
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                  {site.title}
                </h3>
                <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
              </div>
              <p className="text-xs text-gray-500 truncate">
                {site.description}
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
