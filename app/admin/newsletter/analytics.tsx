'use client';

import { Send, Eye, MousePointer, AlertTriangle } from 'lucide-react';

interface AnalyticsData {
  totalSent: number;
  totalFailed: number;
  avgOpenRate: number;
  avgClickRate: number;
  recentSends: Array<{
    id: string;
    type: string;
    subject: string;
    sentAt: string;
    totalSent: number;
    opens: number;
    clicks: number;
    openRate: number;
    clickRate: number;
  }>;
  weeklyVolume: Array<{ week: string; count: number }>;
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function SimpleBarChart({ data }: { data: Array<{ week: string; count: number }> }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs text-gray-500">{d.count || ''}</span>
          <div
            className="w-full bg-blue-500 rounded-t-sm min-h-[2px] transition-all"
            style={{ height: `${maxCount > 0 ? (d.count / maxCount) * 120 : 2}px` }}
          />
          <span className="text-xs text-gray-400 rotate-[-45deg] origin-top-left whitespace-nowrap mt-1">
            {d.week}
          </span>
        </div>
      ))}
    </div>
  );
}

export function NewsletterAnalytics({ data }: { data: AnalyticsData }) {
  if (data.recentSends.length === 0) {
    return (
      <div className="mb-8 bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8 text-center">
        <Send className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Nenhum envio de newsletter registrado ainda.</p>
        <p className="text-sm text-gray-400 mt-1">
          Os dados aparecerao aqui apos o primeiro envio automatico da newsletter.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Send}
          label="Total Enviados"
          value={data.totalSent.toLocaleString('pt-BR')}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          icon={Eye}
          label="Taxa de Abertura"
          value={`${data.avgOpenRate}%`}
          color="bg-green-100 text-green-600"
        />
        <StatCard
          icon={MousePointer}
          label="Taxa de Cliques"
          value={`${data.avgClickRate}%`}
          color="bg-purple-100 text-purple-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="Total Falhas"
          value={data.totalFailed.toLocaleString('pt-BR')}
          color="bg-red-100 text-red-600"
        />
      </div>

      {/* Chart + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Volume Chart */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume Semanal (12 semanas)</h3>
          <SimpleBarChart data={data.weeklyVolume} />
        </div>

        {/* Recent Sends Table */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6 overflow-hidden">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ultimos Envios</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-600 font-medium">Tipo</th>
                  <th className="text-left py-2 px-2 text-gray-600 font-medium">Assunto</th>
                  <th className="text-right py-2 px-2 text-gray-600 font-medium">Enviados</th>
                  <th className="text-right py-2 px-2 text-gray-600 font-medium">Abertura</th>
                  <th className="text-right py-2 px-2 text-gray-600 font-medium">Cliques</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSends.map((send) => (
                  <tr key={send.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        send.type === 'weekly'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {send.type === 'weekly' ? 'Semanal' : 'Mensal'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-700 max-w-[200px] truncate" title={send.subject}>
                      {send.subject}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700">{send.totalSent}</td>
                    <td className="py-2 px-2 text-right text-gray-700">{send.openRate}%</td>
                    <td className="py-2 px-2 text-right text-gray-700">{send.clickRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
