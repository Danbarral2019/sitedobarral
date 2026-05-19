'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { FAQAdminItem } from '@/lib/faq/queries';

export interface FAQFormData {
  question: string;
  answer: string;
  category: string;
  displayOrder: number;
  isPinned: boolean;
  isPublished: boolean;
  keywords: string;
}

const EMPTY_FORM: FAQFormData = {
  question: '',
  answer: '',
  category: '',
  displayOrder: 0,
  isPinned: false,
  isPublished: true,
  keywords: '',
};

export function useFaqAdmin() {
  const { toast } = useToast();
  const [faqs, setFaqs] = useState<FAQAdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FAQFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadFAQs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/faq');
      if (res.ok) {
        const data = await res.json();
        setFaqs(data.faqs || []);
      }
    } catch (err) {
      toast({ title: 'Erro ao carregar FAQs', description: String(err), variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadFAQs();
  }, [loadFAQs]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }, []);

  const openEdit = useCallback((faq: FAQAdminItem) => {
    setEditingId(faq.id);
    setForm({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      displayOrder: faq.displayOrder,
      isPinned: faq.isPinned,
      isPublished: faq.isPublished,
      keywords: faq.keywords || '',
    });
  }, []);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
        const url = editingId ? `/api/admin/faq/${editingId}` : '/api/admin/faq';
        const method = editingId ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            keywords: form.keywords.trim() || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Falha ao salvar');
        }
        toast({
          title: editingId ? 'FAQ atualizada' : 'FAQ criada',
          variant: 'success',
        });
        setForm(EMPTY_FORM);
        setEditingId(null);
        await loadFAQs();
      } catch (err) {
        toast({
          title: 'Erro ao salvar',
          description: err instanceof Error ? err.message : 'Erro desconhecido',
          variant: 'error',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [editingId, form, toast, loadFAQs],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/faq/${deleteTargetId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir');
      toast({ title: 'FAQ excluída', variant: 'success' });
      setDeleteTargetId(null);
      if (editingId === deleteTargetId) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      await loadFAQs();
    } catch (err) {
      toast({
        title: 'Erro ao excluir',
        description: err instanceof Error ? err.message : 'Erro',
        variant: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTargetId, editingId, toast, loadFAQs]);

  const togglePublish = useCallback(
    async (faq: FAQAdminItem) => {
      try {
        const res = await fetch(`/api/admin/faq/${faq.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublished: !faq.isPublished }),
        });
        if (res.ok) await loadFAQs();
      } catch {
        // silently fail
      }
    },
    [loadFAQs],
  );

  return {
    faqs,
    isLoading,
    editingId,
    form,
    setForm,
    isSaving,
    openCreate,
    openEdit,
    handleSave,
    deleteTargetId,
    setDeleteTargetId,
    handleDelete,
    isDeleting,
    togglePublish,
  };
}
