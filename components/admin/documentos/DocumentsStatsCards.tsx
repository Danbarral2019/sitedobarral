'use client';

import { FileText, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import type { DocumentStats } from '@/hooks/use-documentos-admin';

interface DocumentsStatsCardsProps {
  total: number;
  stats: DocumentStats;
  activeStatus: string;
  onStatusClick: (status: 'complete' | 'warning' | 'critical') => void;
}

export function DocumentsStatsCards({ total, stats, activeStatus, onStatusClick }: DocumentsStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
        </div>
      </div>

      <div
        className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
          activeStatus === 'complete' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'
        }`}
        onClick={() => onStatusClick('complete')}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.complete}</p>
            <p className="text-xs text-gray-500">Completos</p>
          </div>
        </div>
      </div>

      <div
        className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
          activeStatus === 'warning' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-yellow-300'
        }`}
        onClick={() => onStatusClick('warning')}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.warning}</p>
            <p className="text-xs text-gray-500">Incompletos</p>
          </div>
        </div>
      </div>

      <div
        className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
          activeStatus === 'critical' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300'
        }`}
        onClick={() => onStatusClick('critical')}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.critical}</p>
            <p className="text-xs text-gray-500">Criticos</p>
          </div>
        </div>
      </div>
    </div>
  );
}
