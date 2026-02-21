'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Scale, Calendar, ArrowRight } from 'lucide-react';

interface Decision {
  id: string;
  tribunal: string;
  decisionNumber: string;
  judgeDate: string | null;
  summary: string | null;
  ementa: string;
}

interface JurisprudenciaRelacionadaProps {
  articleNumber: string;
}

export default function JurisprudenciaRelacionada({ articleNumber }: JurisprudenciaRelacionadaProps) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDecisions() {
      try {
        const res = await fetch(`/api/jurisprudencia?artigo=${articleNumber}&limit=5&status=approved`);
        if (res.ok) {
          const data = await res.json();
          setDecisions(data.decisions || []);
        }
      } catch (err) {
        console.error('Failed to fetch related decisions:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDecisions();
  }, [articleNumber]);

  if (loading) return null;
  if (decisions.length === 0) return null;

  const tribunalColor = (t: string) => {
    const colors: Record<string, string> = {
      'TCE-SP': 'bg-blue-100 text-blue-800',
      'TCE-MG': 'bg-green-100 text-green-800',
      'TCE-PR': 'bg-purple-100 text-purple-800',
      'TCE-SC': 'bg-sky-100 text-sky-800',
      'TCE-RJ': 'bg-orange-100 text-orange-800',
      'TCE-RS': 'bg-violet-100 text-violet-800',
      'TCE-PE': 'bg-teal-100 text-teal-800',
      'TCU': 'bg-red-100 text-red-800',
      'DATAJUD-STJ': 'bg-red-100 text-red-800',
    };
    return colors[t] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
      <div className="flex items-center gap-2 mb-6">
        <Scale className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">
          Jurisprudencia Relacionada ({decisions.length})
        </h2>
      </div>

      <div className="space-y-3">
        {decisions.map((decision) => (
          <Link
            key={decision.id}
            href={`/jurisprudencia/${decision.id}`}
            className="block p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors border-2 border-transparent hover:border-blue-300"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${tribunalColor(decision.tribunal)}`}>
                {decision.tribunal}
              </span>
              {decision.judgeDate && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(decision.judgeDate).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{decision.decisionNumber}</h3>
            <p className="text-sm text-gray-600 line-clamp-2">
              {decision.summary || decision.ementa}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t">
        <Link
          href={`/jurisprudencia?artigo=${articleNumber}`}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm"
        >
          Ver todas as decisoes sobre este artigo <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
