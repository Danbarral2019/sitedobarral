'use client';

import { courses } from '@/data/courses';
import type { DOUImportAs } from '@/hooks/use-dou-filtros';

interface DOUBulkApproveModalProps {
  isOpen: boolean;
  selectedCount: number;
  importAs: DOUImportAs;
  onImportAsChange: (v: DOUImportAs) => void;
  bulkCourses: string[];
  onBulkCoursesChange: (ids: string[]) => void;
  bulkNotes: string;
  onBulkNotesChange: (v: string) => void;
  isProcessing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DOUBulkApproveModal({
  isOpen,
  selectedCount,
  importAs,
  onImportAsChange,
  bulkCourses,
  onBulkCoursesChange,
  bulkNotes,
  onBulkNotesChange,
  isProcessing,
  onClose,
  onConfirm,
}: DOUBulkApproveModalProps) {
  if (!isOpen) return null;

  const toggleCourse = (id: string) => {
    onBulkCoursesChange(bulkCourses.includes(id) ? bulkCourses.filter((c) => c !== id) : [...bulkCourses, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <h3 className="text-lg font-bold mb-4">Aprovar {selectedCount} documento(s) em lote</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Importar como:</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-blue-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                <input
                  type="radio"
                  name="bulkImportAs"
                  checked={importAs === 'ato_normativo'}
                  onChange={() => onImportAsChange('ato_normativo')}
                />
                <span className="text-sm">Ato Normativo</span>
              </label>
              <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-green-50 has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
                <input
                  type="radio"
                  name="bulkImportAs"
                  checked={importAs === 'boa_pratica'}
                  onChange={() => onImportAsChange('boa_pratica')}
                />
                <span className="text-sm">Boa Pratica</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Vincular aos cursos: *</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-lg border">
              {courses.map((course) => (
                <label
                  key={course.id}
                  className="flex items-start gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={bulkCourses.includes(course.id)}
                    onChange={() => toggleCourse(course.id)}
                    className="mt-1"
                  />
                  <span className="text-sm flex-1">{course.title}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">{bulkCourses.length} curso(s) selecionado(s)</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Observacoes (opcional)</label>
            <textarea
              value={bulkNotes}
              onChange={(e) => onBulkNotesChange(e.target.value)}
              placeholder="Observacoes para todos os documentos..."
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing || bulkCourses.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processando...' : `Aprovar ${selectedCount} documento(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
