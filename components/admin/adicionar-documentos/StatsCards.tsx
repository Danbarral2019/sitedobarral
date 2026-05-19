'use client';

import { RefreshCw, Upload } from 'lucide-react';

interface StatsCardsProps {
  autoImportsTotal: number;
  recentUploadsCount: number;
}

export function StatsCards({ autoImportsTotal, recentUploadsCount }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <RefreshCw className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Importados Automaticamente (7d)</p>
            <p className="text-2xl font-bold text-gray-900">{autoImportsTotal}</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Upload className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Uploads Recentes (24h)</p>
            <p className="text-2xl font-bold text-gray-900">{recentUploadsCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
