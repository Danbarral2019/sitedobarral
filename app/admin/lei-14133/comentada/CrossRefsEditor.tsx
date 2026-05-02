'use client';

import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CrossRef {
  id: string;
  targetNumber: string;
  note: string;
  order: number;
}

interface Props {
  numero: string;
  initial: CrossRef[];
  onChanged: () => void;
}

export function CrossRefsEditor({ numero, initial, onChanged }: Props) {
  const { error: errorToast, success: successToast } = useToast();
  const [items, setItems] = useState<CrossRef[]>(initial);
  const [adding, setAdding] = useState(false);
  const [draftTarget, setDraftTarget] = useState('');
  const [draftNote, setDraftNote] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleAdd = async () => {
    if (!draftTarget.trim() || !draftNote.trim()) {
      errorToast('Preencha artigo destino e nota');
      return;
    }
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/crossrefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetNumber: draftTarget.trim(), note: draftNote.trim() }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      errorToast('Erro', e.error || 'Falha');
      return;
    }
    const data = await r.json();
    setItems((prev) => [...prev, data.crossRef]);
    setAdding(false);
    setDraftTarget('');
    setDraftNote('');
    successToast('Vínculo adicionado');
    onChanged();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este vínculo?')) return;
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/crossrefs/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      errorToast('Erro ao remover');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    onChanged();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered);
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/crossrefs/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map((i) => i.id) }),
    });
    if (!r.ok) {
      errorToast('Erro ao reordenar — revertendo');
      setItems(items);
    } else {
      onChanged();
    }
  };

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {items.map((item) => (
              <SortableCrossRef
                key={item.id}
                item={item}
                onDelete={() => handleDelete(item.id)}
                onSaveEdit={async (target, note) => {
                  const r = await fetch(`/api/admin/lei-14133/articles/${numero}/crossrefs/${item.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetNumber: target, note }),
                  });
                  if (!r.ok) {
                    errorToast('Erro ao salvar');
                    return false;
                  }
                  const data = await r.json();
                  setItems((prev) => prev.map((p) => (p.id === item.id ? data.crossRef : p)));
                  successToast('Vínculo atualizado');
                  onChanged();
                  return true;
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {adding ? (
        <div className="border border-dashed border-purple-300 rounded-lg p-3 bg-purple-50/30">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr_auto] gap-2 items-start">
            <input
              type="text"
              value={draftTarget}
              onChange={(e) => setDraftTarget(e.target.value)}
              placeholder="Art. nº (ex: 44)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="text"
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="Nota explicando a conexão (até 500 chars)"
              maxLength={500}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <div className="flex gap-1">
              <button
                onClick={handleAdd}
                className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setDraftTarget('');
                  setDraftNote('');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-sm text-purple-700 hover:text-purple-900"
        >
          <Plus className="w-4 h-4" /> Adicionar vínculo
        </button>
      )}

      {items.length === 0 && !adding && (
        <p className="text-sm text-gray-500 italic">Nenhuma vinculação ainda.</p>
      )}
    </div>
  );
}

function SortableCrossRef({
  item,
  onDelete,
  onSaveEdit,
}: {
  item: CrossRef;
  onDelete: () => void;
  onSaveEdit: (target: string, note: string) => Promise<boolean>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(item.targetNumber);
  const [note, setNote] = useState(item.note);

  return (
    <li ref={setNodeRef} style={style} className="border border-gray-200 rounded-lg p-3 bg-white">
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} className="cursor-grab text-gray-400 mt-1" aria-label="Arrastar">
          <GripVertical className="w-4 h-4" />
        </button>
        {editing ? (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_3fr_auto] gap-2">
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            />
            <div className="flex gap-1">
              <button
                onClick={async () => {
                  const ok = await onSaveEdit(target, note);
                  if (ok) setEditing(false);
                }}
                className="px-3 py-1 bg-purple-600 text-white rounded text-sm"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setTarget(item.targetNumber);
                  setNote(item.note);
                }}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">Art. {item.targetNumber}</span>
              <p className="text-sm text-gray-800 flex-1">{item.note}</p>
            </div>
          </div>
        )}
        {!editing && (
          <div className="flex gap-1">
            <button onClick={() => setEditing(true)} className="text-gray-500 hover:text-gray-800 text-xs">
              Editar
            </button>
            <button onClick={onDelete} className="text-red-500 hover:text-red-700 ml-2" aria-label="Remover">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
