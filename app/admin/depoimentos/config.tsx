'use client';

/**
 * Configuração da lista de Depoimentos
 */

import Link from 'next/link';
import { MessageSquare, Star, Edit, Trash2, CheckCircle, XCircle, Eye, User } from 'lucide-react';
import { createListConfig } from '@/components/admin/ResourceListContainer';
import { AdminListConfig } from '@/lib/types/admin-list';
import { Testimonial, deleteTestimonial } from '@/lib/depoimentos';

export const depoimentosConfig: AdminListConfig<Testimonial> = createListConfig<Testimonial>({
  title: 'Depoimentos',
  description: 'Gerenciar avaliações e depoimentos de alunos',

  showSearch: true,
  searchPlaceholder: 'Buscar por nome, cargo ou conteúdo...',

  showStats: true,
  getStats: (items) => [
    {
      label: 'Total',
      value: items.length,
      icon: MessageSquare,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Publicados',
      value: items.filter((t) => t.isPublished).length,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Nota Média',
      value: items.length > 0 ? (items.reduce((acc, t) => acc + t.rating, 0) / items.length).toFixed(1) : 0,
      icon: Star,
      color: 'bg-yellow-100 text-yellow-600',
    },
  ],

  filters: [
    {
      id: 'isPublished',
      label: 'Status',
      type: 'select',
      options: [
        { value: '', label: 'Todos' },
        { value: 'true', label: 'Publicados' },
        { value: 'false', label: 'Rascunhos' },
      ],
    },
  ],

  columns: [
    {
      id: 'name',
      label: 'Pessoa',
      render: (testimonial) => (
        <div className="flex items-center gap-3">
          {testimonial.photoUrl ? (
            <img src={testimonial.photoUrl} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">{testimonial.name}</p>
            <p className="text-sm text-gray-600">{testimonial.role}</p>
            {testimonial.company && (
              <p className="text-xs text-gray-500">{testimonial.company}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'content',
      label: 'Depoimento',
      render: (testimonial) => (
        <p className="text-sm text-gray-700 line-clamp-2">{testimonial.content}</p>
      ),
    },
    {
      id: 'rating',
      label: 'Avaliação',
      render: (testimonial) => (
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${i < testimonial.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
            />
          ))}
        </div>
      ),
    },
    {
      id: 'isPublished',
      label: 'Status',
      render: (testimonial) =>
        testimonial.isPublished ? (
          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full flex items-center gap-1 w-fit">
            <CheckCircle className="w-3 h-3" />
            Publicado
          </span>
        ) : (
          <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded-full flex items-center gap-1 w-fit">
            <XCircle className="w-3 h-3" />
            Rascunho
          </span>
        ),
    },
  ],

  rowActions: [
    {
      id: 'edit',
      label: 'Editar',
      icon: Edit,
      color: 'text-blue-600',
      action: (testimonial) => {
        window.location.href = `/admin/depoimentos/${testimonial.id}/edit`;
      },
    },
    {
      id: 'delete',
      label: 'Deletar',
      icon: Trash2,
      color: 'text-red-600',
      action: async (testimonial) => {
        if (!confirm(`Tem certeza que deseja deletar o depoimento de "${testimonial.name}"?`)) return;
        await deleteTestimonial(testimonial.id);
      },
    },
  ],

  emptyMessage: 'Nenhum depoimento cadastrado ainda',
  emptyIcon: MessageSquare,

  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50],
});

export function DepoimentosHeader() {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Depoimentos</h1>
          <p className="text-gray-600">Gerenciar avaliações e depoimentos de alunos</p>
        </div>
        <Link
          href="/admin/depoimentos/new"
          className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Depoimento
        </Link>
      </div>
    </div>
  );
}
