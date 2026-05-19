'use client';

import { RefreshCw, Loader2, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { relativeTime, getHealthBadgeKind } from '@/lib/admin/tribunal-decisions/format';
import type { ScraperHealthEntry } from '@/hooks/use-tribunal-decisions';

interface TribunalScraperHealthProps {
  loading: boolean;
  scrapers: ScraperHealthEntry[];
  runningScrapers: Set<string>;
  onRunScraper: (code: string) => void;
}

function HealthIcon({ label }: { label: 'ok' | 'warning' | 'error' }) {
  if (label === 'ok') return <CheckCircle className="w-4 h-4 text-green-600" />;
  if (label === 'warning') return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
  return <XCircle className="w-4 h-4 text-red-600" />;
}

export function TribunalScraperHealth({
  loading,
  scrapers,
  runningScrapers,
  onRunScraper,
}: TribunalScraperHealthProps) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <RefreshCw className="w-5 h-5" />
        Health dos Scrapers
      </h2>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-4 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-32 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      ) : scrapers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scrapers.map((scraper) => {
            const badge = getHealthBadgeKind(scraper.isHealthy, scraper.consecutiveFailures);
            const isRunning = runningScrapers.has(scraper.scraperCode);
            return (
              <div key={scraper.scraperCode} className={`bg-white rounded-lg shadow-sm border p-4 ${badge.color}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{scraper.scraperCode}</h3>
                    <span className="text-xs text-gray-500">{scraper.totalRuns} execucoes</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <HealthIcon label={badge.label} />
                    <span className="text-xs font-medium capitalize">{badge.label}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-600 space-y-1 mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Ultimo run: {relativeTime(scraper.lastRun?.runAt || null)}
                  </div>
                  {scraper.lastRun && (
                    <div>
                      Encontrados: {scraper.lastRun.itemsFound} | Novos: {scraper.lastRun.itemsNew}
                      {scraper.lastRun.itemsError > 0 && (
                        <span className="text-red-600"> | Erros: {scraper.lastRun.itemsError}</span>
                      )}
                    </div>
                  )}
                  {scraper.consecutiveFailures > 0 && (
                    <div className="text-red-600">{scraper.consecutiveFailures} falha(s) consecutiva(s)</div>
                  )}
                  {scraper.lastRun?.errorMessage && (
                    <div className="text-red-600 text-xs mt-1">{scraper.lastRun.errorMessage}</div>
                  )}
                </div>
                <button
                  onClick={() => onRunScraper(scraper.scraperCode)}
                  disabled={isRunning}
                  className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Executando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Executar
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
          Nenhum scraper executado ainda. Execute manualmente para iniciar.
        </div>
      )}
    </div>
  );
}
