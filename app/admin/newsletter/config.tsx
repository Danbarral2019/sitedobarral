'use client';

/**
 * Configuração da lista de Newsletter
 */

import { Mail, Trash2, Calendar, CheckCircle, XCircle, Users } from 'lucide-react';
import { createListConfig } from '@/components/admin/ResourceListContainer';
import { AdminListConfig } from '@/lib/types/admin-list';
import { NewsletterSubscriber, deleteNewsletterSubscriber } from '@/lib/newsletter';

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  unsubscribed: 'Cancelado',
  pending: 'Pendente',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  unsubscribed: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

export const newsletterConfig: AdminListConfig<NewsletterSubscriber> = createListConfig<NewsletterSubscriber>({
  title: 'Newsletter',
  description: 'Gerenciar assinantes da newsletter',

  showSearch: true,
  searchPlaceholder: 'Buscar por email ou nome...',

  showStats: true,
  getStats: (items) => [
    {
      label: 'Total',
      value: items.length,
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Ativos',
      value: items.filter((s) => s.status === 'active').length,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Cancelados',
      value: items.filter((s) => s.status === 'unsubscribed').length,
      icon: XCircle,
      color: 'bg-gray-100 text-gray-600',
    },
  ],

  filters: [
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'active', label: 'Ativos' },
        { value: 'unsubscribed', label: 'Cancelados' },
      ],
    },
  ],

  columns: [
    {
      id: 'email',
      label: 'Assinante',
      render: (subscriber) => (
        <div>
          <p className="font-semibold text-gray-900 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            {subscriber.email}
          </p>
          {subscriber.name && (
            <p className="text-sm text-gray-600">{subscriber.name}</p>
          )}
        </div>
      ),
    },
    {
      id: 'subscribedAt',
      label: 'Data de Inscrição',
      render: (subscriber) => (
        <p className="text-sm text-gray-700 flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {new Date(subscriber.subscribedAt).toLocaleDateString('pt-BR')}
        </p>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      render: (subscriber) => (
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[subscriber.status] || 'bg-gray-100 text-gray-800'}`}>
          {STATUS_LABELS[subscriber.status] || subscriber.status}
        </span>
      ),
    },
  ],

  rowActions: [
    {
      id: 'email',
      label: 'Enviar email',
      icon: Mail,
      color: 'text-blue-600',
      action: (subscriber) => {
        window.location.href = `mailto:${subscriber.email}`;
      },
    },
    {
      id: 'delete',
      label: 'Deletar',
      icon: Trash2,
      color: 'text-red-600',
      action: async (subscriber) => {
        if (!confirm(`Tem certeza que deseja deletar o assinante "${subscriber.email}"?`)) return;
        await deleteNewsletterSubscriber(subscriber.id);
      },
    },
  ],

  emptyMessage: 'Nenhum assinante cadastrado ainda',
  emptyIcon: Mail,

  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
});

export function NewsletterHeader() {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Newsletter</h1>
          <p className="text-gray-600">Gerenciar assinantes da newsletter</p>
        </div>
      </div>
    </div>
  );
}
