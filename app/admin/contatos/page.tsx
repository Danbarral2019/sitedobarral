'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Mail, Phone, Calendar, Trash2, Check, X, Loader2, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  courseInterest: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface Stats {
  unread: number;
  read: number;
}

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<Stats>({ unread: 0, read: 0 });
  const [filter, setFilter] = useState<'all' | 'true' | 'false'>('false'); // false = não lidos
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0); // ✅ Trigger para forçar reload
  const { success: successToast, error: errorToast } = useToast();

  useEffect(() => {
    const loadContacts = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/contact?isRead=${filter}`);
        const data = await response.json();

        if (data.contacts) {
          setContacts(data.contacts);
          if (data.stats) {
            setStats(data.stats);
          }
        } else {
          errorToast('Erro ao carregar contatos');
        }
      } catch (error) {
        console.error('Erro ao carregar contatos:', error);
        errorToast('Erro ao carregar contatos');
      } finally {
        setLoading(false);
      }
    };

    loadContacts();
  }, [filter, reloadTrigger]); // ✅ Apenas filter e reloadTrigger como dependências

  const handleMarkAsRead = async (id: string, isRead: boolean) => {
    try {
      const response = await fetch('/api/contact', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isRead }),
      });

      const data = await response.json();

      if (data.success) {
        successToast(isRead ? 'Marcado como lido' : 'Marcado como não lido');
        setReloadTrigger(prev => prev + 1); // ✅ Trigger reload
      } else {
        errorToast(data.error || 'Erro ao atualizar');
      }
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      errorToast('Erro ao atualizar contato');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta mensagem?')) return;

    try {
      const response = await fetch(`/api/contact?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        successToast('Mensagem deletada');
        setReloadTrigger(prev => prev + 1); // ✅ Trigger reload
      } else {
        errorToast(data.error || 'Erro ao deletar');
      }
    } catch (error) {
      console.error('Erro ao deletar:', error);
      errorToast('Erro ao deletar mensagem');
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      // Marcar como lido automaticamente ao expandir
      const contact = contacts.find((c) => c.id === id);
      if (contact && !contact.isRead) {
        handleMarkAsRead(id, true);
      }
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mensagens de Contato</h1>
          <p className="text-gray-600">Gerencie as mensagens recebidas pelo formulário de contato</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-semibold">Não Lidas</p>
                <p className="text-3xl font-bold text-blue-900">{stats.unread}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Lidas</p>
                <p className="text-3xl font-bold text-gray-900">{stats.read}</p>
              </div>
              <div className="w-12 h-12 bg-gray-500 rounded-lg flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('false')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'false'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Não Lidas ({stats.unread})
            </button>
            <button
              onClick={() => setFilter('true')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'true'
                  ? 'bg-gray-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Lidas ({stats.read})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
          </div>
        </div>

        {/* Contacts List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg">Nenhuma mensagem encontrada</p>
          </div>
        ) : (
          <div className="space-y-4">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`bg-white rounded-xl shadow-sm border-2 ${
                  contact.isRead ? 'border-gray-200' : 'border-blue-400'
                } hover:shadow-md transition-all`}
              >
                {/* Header - Always visible */}
                <div
                  className="p-6 cursor-pointer"
                  onClick={() => toggleExpand(contact.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{contact.name}</h3>
                        {!contact.isRead && (
                          <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                            NOVA
                          </span>
                        )}
                        {contact.courseInterest === 'depoimento' && (
                          <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full">
                            DEPOIMENTO
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {contact.email}
                        </div>
                        {contact.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {contact.phone}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(contact.createdAt).toLocaleString('pt-BR')}
                        </div>
                      </div>

                      {contact.courseInterest && contact.courseInterest !== 'depoimento' && (
                        <p className="text-sm text-blue-600 font-medium mb-2">
                          Interesse: {contact.courseInterest}
                        </p>
                      )}

                      {/* Preview da mensagem (apenas primeiras linhas) */}
                      {expandedId !== contact.id && (
                        <p className="text-gray-700 line-clamp-2">{contact.message}</p>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      {contact.isRead ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(contact.id, false);
                          }}
                          className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          title="Marcar como não lida"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(contact.id, true);
                          }}
                          className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                          title="Marcar como lida"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(contact.id);
                        }}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        title="Deletar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedId === contact.id && (
                  <div className="px-6 pb-6 border-t-2 border-gray-100 pt-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Mensagem Completa:</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{contact.message}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
