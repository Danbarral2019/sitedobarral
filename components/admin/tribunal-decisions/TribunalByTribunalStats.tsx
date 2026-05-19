'use client';

import { tribunalColor } from '@/lib/admin/tribunal-decisions/format';
import type { TribunalStats } from '@/hooks/use-tribunal-decisions';

interface TribunalByTribunalStatsProps {
  byTribunal: TribunalStats['byTribunal'];
}

export function TribunalByTribunalStats({ byTribunal }: TribunalByTribunalStatsProps) {
  if (byTribunal.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
      {byTribunal.map((t) => (
        <div key={t.tribunalCode} className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${tribunalColor(t.tribunalCode)}`}>
              {t.tribunalCode}
            </span>
            <span className="text-2xl font-bold text-gray-900">{t.total}</span>
          </div>
          <div className="text-xs text-gray-500 truncate mb-1">{t.tribunalName}</div>
          <div className="flex gap-2 text-xs">
            <span className="text-yellow-600">{t.pending} pend.</span>
            <span className="text-green-600">{t.approved} aprov.</span>
            <span className="text-red-600">{t.rejected} rej.</span>
          </div>
        </div>
      ))}
    </div>
  );
}
