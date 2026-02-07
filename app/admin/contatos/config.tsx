'use client';

/**
 * Configuração da lista de Contatos
 */

import { Mail, Trash2, Calendar, User, CheckCircle, Clock } from 'lucide-react';
import { createListConfig } from '@/components/admin/ResourceListContainer';
import { AdminListConfig } from '@/lib/types/admin-list';
import { ContactForm, deleteContactForm } from '@/lib/contatos';

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  lido: 'Lido',
  respondido: 'Respondido',
  arquivado: 'Arquivado',
};

const STATUS_COLORS: Record<string, string> = {
  novo: 'bg-blue-100 text-blue-800',
  lido: 'bg-yellow-100 text-yellow-800',
  respondido: 'bg-green-100 text-green-800',
  arquivado: 'bg-gray-100 text-gray-800',
};

export const contatosConfig: AdminListConfig<ContactForm> = createListConfig<ContactForm>({
  title: 'Mensagens de Contato',
  description: 'Gerenciar mensagens recebidas do formulário de contato',

  showSearch: true,
  searchPlaceholder: 'Buscar por nome, email, assunto ou mensagem...',

  showStats: true,
  getStats: (items) => [
    {
      label: 'Total',
      value: items.length,
      icon: Mail,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Novos',
      value: items.filter((c) => c.status === 'novo').length,
      icon: Clock,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Respondidos',
      value: items.filter((c) => c.status === 'respondido').length,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600',
    },
  ],

  filters: [
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'novo', label: 'Novos' },
        { value: 'lido', label: 'Lidos' },
        { value: 'respondido', label: 'Respondidos' },
        { value: 'arquivado', label: 'Arquivados' },
      ],
    },
  ],

  columns: [
    {
      id: 'name',
      label: 'Contato',
      render: (contact) => (
        <div>
          <p className="font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4" />
            {contact.name}
          </p>
          <p className="text-sm text-gray-600">{contact.email}</p>
          {contact.phone && (
            <p className="text-xs text-gray-500">{contact.phone}</p>
          )}
        </div>
      ),
    },
    {
      id: 'subject',
      label: 'Assunto / Mensagem',
      render: (contact) => (
        <div>
          <p className="font-medium text-gray-900">{contact.subject}</p>
          <p className="text-sm text-gray-600 line-clamp-2">{contact.message}</p>
        </div>
      ),
    },
    {
      id: 'createdAt',
      label: 'Data',
      render: (contact) => (
        <p className="text-sm text-gray-700 flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {new Date(contact.createdAt).toLocaleDateString('pt-BR')}
          <br />
          <span className="text-xs text-gray-500">
            {new Date(contact.createdAt).toLocaleTimeString('pt-BR')}
          </span>
        </p>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      render: (contact) => (
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[contact.status] || 'bg-gray-100 text-gray-800'}`}>
          {STATUS_LABELS[contact.status] || contact.status}
        </span>
      ),
    },
  ],

  rowActions: [
    {
      id: 'reply',
      label: 'Responder',
      icon: Mail,
      color: 'text-blue-600',
      action: (contact) => {
        window.location.href = `mailto:${contact.email}?subject=Re: ${contact.subject}`;
      },
    },
    {
      id: 'delete',
      label: 'Deletar',
      icon: Trash2,
      color: 'text-red-600',
      action: async (contact) => {
        if (!confirm(`Tem certeza que deseja deletar a mensagem de "${contact.name}"?`)) return;
        await deleteContactForm(contact.id);
      },
    },
  ],

  emptyMessage: 'Nenhuma mensagem recebida ainda',
  emptyIcon: Mail,

  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50],
});

export function ContatosHeader() {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mensagens de Contato</h1>
          <p className="text-gray-600">Gerenciar mensagens recebidas do formulário de contato</p>
        </div>
      </div>
    </div>
  );
}
