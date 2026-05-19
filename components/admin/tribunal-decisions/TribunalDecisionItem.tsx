'use client';

import {
  ChevronUp,
  ExternalLink,
  Building2,
  FileText,
  Sparkles,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  tribunalColor,
  parseJsonArray,
  getRelevanceColor,
  getApprovalStatusColor,
} from '@/lib/admin/tribunal-decisions/format';
import type { TribunalDecision } from '@/hooks/use-tribunal-decisions';

interface TribunalDecisionItemProps {
  decision: TribunalDecision;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: string) => void;
  onExpand: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function TribunalDecisionItem({
  decision,
  isSelected,
  isExpanded,
  onSelect,
  onExpand,
  onApprove,
  onReject,
}: TribunalDecisionItemProps) {
  const themes = parseJsonArray(decision.themes);
  const articles = parseJsonArray(decision.leiArticles);
  const canExpand = decision.ementa.length > 200 || decision.fullText;
  const displayEmenta =
    isExpanded || decision.ementa.length <= 300
      ? decision.ementa
      : decision.ementa.substring(0, 300) + '...';

  return (
    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex gap-3">
        <div className="flex-shrink-0 pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(decision.id)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${tribunalColor(decision.tribunalCode)}`}>
              {decision.tribunalCode}
            </span>
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
              {decision.decisionType}
            </span>
            {decision.dataJulgamento && (
              <span className="text-xs text-gray-500">
                {new Date(decision.dataJulgamento).toLocaleDateString('pt-BR')}
              </span>
            )}
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getRelevanceColor(decision.relevanceScore)}`}>
              Score: {decision.relevanceScore}
            </span>
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getApprovalStatusColor(decision.approvalStatus)}`}>
              {decision.approvalStatus}
            </span>
          </div>

          <h3 className="font-semibold text-gray-900 mb-1">{decision.decisionNumber || decision.title}</h3>

          <p className="text-sm text-gray-600 mb-2 whitespace-pre-line">{displayEmenta}</p>

          {canExpand && (
            <button
              onClick={() => onExpand(decision.id)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Menos
                </>
              ) : (
                <>
                  <FileText className="w-3 h-3" /> {decision.fullText ? 'Ver Inteiro Teor' : 'Mais'}
                </>
              )}
            </button>
          )}

          {isExpanded && decision.fullText && decision.fullText !== decision.ementa && (
            <div className="bg-gray-50 border rounded-lg p-3 mb-2 max-h-96 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Inteiro Teor
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{decision.fullText}</p>
            </div>
          )}

          {decision.summary && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 mb-2">
              <p className="text-xs font-semibold text-blue-600 mb-0.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Resumo IA
              </p>
              <p className="text-xs text-blue-800">{decision.summary}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
            {decision.relator && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {decision.relator}
              </span>
            )}
            {decision.orgaoJulgador && <span>| {decision.orgaoJulgador}</span>}
          </div>

          {themes.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {themes.map((theme, i) => (
                <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                  {theme}
                </span>
              ))}
            </div>
          )}

          {articles.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {articles.map((art, i) => (
                <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">
                  Art. {art}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            {decision.approvalStatus === 'pending' && (
              <>
                <button
                  onClick={() => onApprove(decision.id)}
                  className="px-3 py-1 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"
                >
                  <CheckCircle className="w-3 h-3" /> Aprovar
                </button>
                <button
                  onClick={() => onReject(decision.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 transition-colors flex items-center gap-1"
                >
                  <XCircle className="w-3 h-3" /> Rejeitar
                </button>
              </>
            )}
            {decision.url && (
              <a
                href={decision.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> Ver Original
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
