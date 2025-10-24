'use client';

import { Download, FileText, BookOpen, Library } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  description?: string;
  category: string;
  type: string;
  url?: string;
}

interface HighlightedMaterialsProps {
  documents: Document[];
  courseId: string;
  onDownload: (doc: Document) => void;
}

export default function HighlightedMaterials({
  documents,
  courseId,
  onDownload,
}: HighlightedMaterialsProps) {
  // Filtrar documentos destacados
  const apostila = documents.find(doc => doc.category === 'apostila');
  const conteudoProgramatico = documents.find(doc => doc.category === 'conteudo-programatico');
  const bibliografia = documents.find(doc => doc.category === 'bibliografia');

  // Se não houver nenhum material destacado, não renderiza nada
  if (!apostila && !conteudoProgramatico && !bibliografia) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-lg p-8 mb-6 border-2 border-amber-200">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">📚 Materiais Essenciais</h2>
        <p className="text-gray-700">Documentos fundamentais para acompanhamento do curso</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Conteúdo Programático */}
        {conteudoProgramatico && (
          <div className="bg-white rounded-xl p-6 border-2 border-blue-300 hover:border-blue-400 hover:shadow-lg transition-all">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Conteúdo Programático</h3>
            <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
              {conteudoProgramatico.description || 'Ementa completa e cronograma do curso'}
            </p>
            <a
              href={`/api/documents/${conteudoProgramatico.id}/download`}
              onClick={() => onDownload(conteudoProgramatico)}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2 shadow-md"
            >
              <Download className="w-5 h-5" />
              Download
            </a>
          </div>
        )}

        {/* Apostila */}
        {apostila && (
          <div className="bg-white rounded-xl p-6 border-2 border-purple-300 hover:border-purple-400 hover:shadow-lg transition-all">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Apostila do Curso</h3>
            <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
              {apostila.description || 'Material didático principal com todo conteúdo'}
            </p>
            <a
              href={`/api/documents/${apostila.id}/download`}
              onClick={() => onDownload(apostila)}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-3 rounded-lg font-bold hover:from-purple-700 hover:to-purple-800 transition-all flex items-center justify-center gap-2 shadow-md"
            >
              <Download className="w-5 h-5" />
              Download
            </a>
          </div>
        )}

        {/* Bibliografia */}
        {bibliografia && (
          <div className="bg-white rounded-xl p-6 border-2 border-green-300 hover:border-green-400 hover:shadow-lg transition-all">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <Library className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Bibliografia</h3>
            <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
              {bibliografia.description || 'Referências bibliográficas completas do curso'}
            </p>
            <a
              href={`/api/documents/${bibliografia.id}/download`}
              onClick={() => onDownload(bibliografia)}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-3 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all flex items-center justify-center gap-2 shadow-md"
            >
              <Download className="w-5 h-5" />
              Download
            </a>
          </div>
        )}
      </div>

      {/* Info adicional */}
      <div className="mt-4 p-4 bg-amber-100 border border-amber-300 rounded-lg">
        <p className="text-sm text-amber-900 font-medium">
          💡 <strong>Dica:</strong> Baixe esses materiais primeiro para ter uma visão geral do curso e acompanhar melhor as aulas.
        </p>
      </div>
    </div>
  );
}
