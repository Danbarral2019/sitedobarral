'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Mail, Calendar, Users, UserX, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  interests: string | null;
  isActive: boolean;
  subscribedAt: string;
  unsubscribedAt: string | null;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
}

export default function NewsletterPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0 });
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0); // ✅ Trigger para forçar reload
  const { success: successToast, error: errorToast } = useToast();

  useEffect(() => {
    const loadSubscribers = async () => {
      setLoading(true);
      try {
        const isActiveParam = filter === 'all' ? '' : `?isActive=${filter === 'active' ? 'true' : 'false'}`;
        const response = await fetch(`/api/newsletter${isActiveParam}`);
        const data = await response.json();

        if (data.subscribers) {
          setSubscribers(data.subscribers);

          // Calcular stats
          if (filter !== 'all') {
            // Buscar todos para stats corretos
            const allResponse = await fetch('/api/newsletter');
            const allData = await allResponse.json();
            if (allData.subscribers) {
              const allSubs = allData.subscribers;
              setStats({
                total: allSubs.length,
                active: allSubs.filter((s: Subscriber) => s.isActive).length,
                inactive: allSubs.filter((s: Subscriber) => !s.isActive).length,
              });
            }
          } else {
            setStats({
              total: data.subscribers.length,
              active: data.subscribers.filter((s: Subscriber) => s.isActive).length,
              inactive: data.subscribers.filter((s: Subscriber) => !s.isActive).length,
            });
          }
        } else {
          console.error('Erro ao carregar inscritos: resposta sem subscribers');
        }
      } catch (error) {
        console.error('Erro ao carregar inscritos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSubscribers();
  }, [filter, reloadTrigger]); // ✅ Apenas filter e reloadTrigger como dependências

  const syncWithMailChimp = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/admin/newsletter/sync', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        successToast(`Sincronizado: ${data.synced} inscritos, ${data.failed} falhas`);
        if (data.errors && data.errors.length > 0) {
          console.log('Erros de sincronização:', data.errors);
        }
      } else {
        errorToast(data.error || 'Erro ao sincronizar com MailChimp');
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      errorToast('Erro ao sincronizar com MailChimp');
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    const confirmed = confirm(`Tem certeza que deseja excluir o inscrito "${email}"?\n\nEsta ação não pode ser desfeita.`);

    if (!confirmed) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/newsletter/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir inscrito');
      }

      successToast('Inscrito excluído com sucesso');
      setReloadTrigger(prev => prev + 1); // ✅ Trigger reload
    } catch (error) {
      console.error('Erro ao excluir:', error);
      errorToast('Erro ao excluir inscrito');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Newsletter</h1>
            <p className="text-gray-600">Gerencie os inscritos da sua newsletter</p>
          </div>
          <button
            onClick={syncWithMailChimp}
            disabled={syncing}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Sincronizar com MailChimp
              </>
            )}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-semibold">Total de Inscritos</p>
                <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-semibold">Ativos</p>
                <p className="text-3xl font-bold text-green-900">{stats.active}</p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Inativos</p>
                <p className="text-3xl font-bold text-gray-900">{stats.inactive}</p>
              </div>
              <div className="w-12 h-12 bg-gray-500 rounded-lg flex items-center justify-center">
                <UserX className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos ({stats.total})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'active'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Ativos ({stats.active})
            </button>
            <button
              onClick={() => setFilter('inactive')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'inactive'
                  ? 'bg-gray-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Inativos ({stats.inactive})
            </button>
          </div>
        </div>

        {/* Subscribers List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : subscribers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nenhum inscrito encontrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      E-mail
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Data de Inscrição
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {subscribers.map((subscriber) => (
                    <tr key={subscriber.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{subscriber.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {formatDate(subscriber.subscribedAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {subscriber.isActive ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700">Ativo</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <UserX className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-500">
                              Inativo
                              {subscriber.unsubscribedAt && (
                                <span className="text-xs text-gray-400 block">
                                  desde {formatDate(subscriber.unsubscribedAt)}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleDelete(subscriber.id, subscriber.email)}
                            disabled={deletingId === subscriber.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Excluir inscrito"
                          >
                            {deletingId === subscriber.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>💡 Dica:</strong> Use o botão &quot;Sincronizar com MailChimp&quot; para garantir que todos os inscritos
            do banco de dados estejam na sua lista do MailChimp. Isso é útil após importações ou alterações manuais.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
