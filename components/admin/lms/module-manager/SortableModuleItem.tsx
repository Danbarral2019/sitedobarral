'use client';

import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

export function SortableModuleItem({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : ('auto' as const),
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        data-drag-handle
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
        title="Arrastar para reordenar"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>
      <div className="pl-8">{children}</div>
    </div>
  );
}
