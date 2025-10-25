'use client';

import { Download, FileText, BookOpen, Library } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  description?: string;
  category: string;
  type: string;
  url?: string;
}

interface MaterialItem {
  doc: Document;
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  borderColor: string;
  bgColor: string;
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

  const materials: MaterialItem[] = [
    conteudoProgramatico && {
      doc: conteudoProgramatico,
      icon: FileText,
      title: 'Conteúdo Programático',
      description: conteudoProgramatico.description || 'Ementa completa e cronograma do curso',
      color: 'from-blue-500 to-blue-700',
      borderColor: 'border-blue-300',
      bgColor: 'bg-blue-600',
    },
    apostila && {
      doc: apostila,
      icon: BookOpen,
      title: 'Apostila do Curso',
      description: apostila.description || 'Material didático principal com todo conteúdo',
      color: 'from-purple-500 to-purple-700',
      borderColor: 'border-purple-300',
      bgColor: 'bg-purple-600',
    },
    bibliografia && {
      doc: bibliografia,
      icon: Library,
      title: 'Bibliografia',
      description: bibliografia.description || 'Referências bibliográficas completas do curso',
      color: 'from-green-500 to-green-700',
      borderColor: 'border-green-300',
      bgColor: 'bg-green-600',
    },
  ].filter((item): item is MaterialItem => Boolean(item));

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-lg p-4 lg:p-8 mb-6 border-2 border-amber-200">
      <div className="mb-4 lg:mb-6">
        <h2 className="text-base lg:text-2xl font-bold text-gray-900 mb-1 lg:mb-2">📚 Materiais Essenciais</h2>
        <p className="text-sm lg:text-lg text-gray-700">Documentos fundamentais para acompanhamento do curso</p>
      </div>

      {/* Mobile: Lista compacta */}
      <div className="lg:hidden space-y-2">
        {materials.map((material: MaterialItem) => {
          const Icon = material.icon;
          return (
            <div
              key={material.doc.id}
              className="bg-white rounded-xl p-3 border border-gray-200 flex items-center gap-3"
            >
              <div className={`w-10 h-10 bg-gradient-to-br ${material.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-gray-900">{material.title}</h3>
                <p className="text-xs text-gray-600 truncate">{material.description}</p>
              </div>
              <a
                href={`/api/documents/${material.doc.id}/download`}
                onClick={() => onDownload(material.doc)}
                className={`${material.bgColor} text-white p-2.5 rounded-lg hover:opacity-90 transition-opacity flex-shrink-0`}
                title="Download"
              >
                <Download className="w-5 h-5" />
              </a>
            </div>
          );
        })}
      </div>

      {/* Desktop: Grid de cards */}
      <div className="hidden lg:grid md:grid-cols-3 gap-4 lg:gap-4">
        {/* Conteúdo Programático */}
        {conteudoProgramatico && (
          <div className="bg-white rounded-xl p-5 lg:p-6 border-2 border-blue-300 hover:border-blue-400 hover:shadow-lg transition-all">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-2">Conteúdo Programático</h3>
            <p className="text-sm lg:text-sm text-gray-600 mb-4 min-h-[40px]">
              {conteudoProgramatico.description || 'Ementa completa e cronograma do curso'}
            </p>
            <a
              href={`/api/documents/${conteudoProgramatico.id}/download`}
              onClick={() => onDownload(conteudoProgramatico)}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3.5 lg:py-3 rounded-lg font-bold hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2 shadow-md text-base min-h-[48px]"
            >
              <Download className="w-5 h-5" />
              Download
            </a>
          </div>
        )}

        {/* Apostila */}
        {apostila && (
          <div className="bg-white rounded-xl p-5 lg:p-6 border-2 border-purple-300 hover:border-purple-400 hover:shadow-lg transition-all">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-2">Apostila do Curso</h3>
            <p className="text-sm lg:text-sm text-gray-600 mb-4 min-h-[40px]">
              {apostila.description || 'Material didático principal com todo conteúdo'}
            </p>
            <a
              href={`/api/documents/${apostila.id}/download`}
              onClick={() => onDownload(apostila)}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-3.5 lg:py-3 rounded-lg font-bold hover:from-purple-700 hover:to-purple-800 transition-all flex items-center justify-center gap-2 shadow-md text-base min-h-[48px]"
            >
              <Download className="w-5 h-5" />
              Download
            </a>
          </div>
        )}

        {/* Bibliografia */}
        {bibliografia && (
          <div className="bg-white rounded-xl p-5 lg:p-6 border-2 border-green-300 hover:border-green-400 hover:shadow-lg transition-all">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <Library className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-2">Bibliografia</h3>
            <p className="text-sm lg:text-sm text-gray-600 mb-4 min-h-[40px]">
              {bibliografia.description || 'Referências bibliográficas completas do curso'}
            </p>
            <a
              href={`/api/documents/${bibliografia.id}/download`}
              onClick={() => onDownload(bibliografia)}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-3.5 lg:py-3 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all flex items-center justify-center gap-2 shadow-md text-base min-h-[48px]"
            >
              <Download className="w-5 h-5" />
              Download
            </a>
          </div>
        )}
      </div>

      {/* Info adicional */}
      <div className="mt-3 lg:mt-4 p-3 lg:p-4 bg-amber-100 border border-amber-300 rounded-lg">
        <p className="text-xs lg:text-sm text-amber-900 font-medium leading-relaxed">
          💡 <strong>Dica:</strong> Baixe esses materiais primeiro para ter uma visão geral do curso.
        </p>
      </div>
    </div>
  );
}
