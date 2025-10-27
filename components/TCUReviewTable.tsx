'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, X, RefreshCw, Loader2 } from 'lucide-react';

interface TCUReviewDocument {
  rowIndex: number;
  title: string;
  description: string;
  category: string;
  tcuData: {
    enunciado: string;
    area: string;
    tema: string;
    subtema: string;
    data: string;
    acordao: string;
    autorTese: string;
    legislacao: string;
    outrosIndexadores: string;
    tipoProcesso: string;
  };
  enrichment?: {
    success: boolean;
    numeroAcordao: string;
    ementaCompleta?: string;
    textoCompleto?: string;
    linkPDF?: string;
    metadados?: {
      relator?: string;
      dataSessao?: string;
      orgaoJulgador?: string;
      processo?: string;
    };
    error?: string;
  };
  classification?: {
    success: boolean;
    numeroAcordao: string;
    titulo: string;
    descricao: string;
    categoria: string;
    cursos: string[];
    tags: string[];
    confianca: number;
    raciocinio: string;
    error?: string;
  };
}

interface TCUReviewTableProps {
  documents: TCUReviewDocument[];
  availableCourses: Array<{ id: string; nome: string }>;
  onApprove: (rowIndex: number, editedData: {
    title: string;
    description: string;
    category: string;
    courses: string[];
    tags: string[];
  }) => void;
  onSkip: (rowIndex: number) => void;
  onReprocess: (rowIndex: number) => Promise<void>;
}

export default function TCUReviewTable({
  documents,
  availableCourses,
  onApprove,
  onSkip,
  onReprocess,
}: TCUReviewTableProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isReprocessing, setIsReprocessing] = useState(false);

  // Estado de edição
  const currentDoc = documents[currentIndex];
  const [editedTitle, setEditedTitle] = useState(currentDoc?.classification?.titulo || currentDoc?.title || '');
  const [editedDescription, setEditedDescription] = useState(currentDoc?.classification?.descricao || currentDoc?.description || '');
  const [editedCategory, setEditedCategory] = useState(currentDoc?.classification?.categoria || currentDoc?.category || 'acordao');
  const [editedCourses, setEditedCourses] = useState<string[]>(currentDoc?.classification?.cursos || []);
  const [editedTags, setEditedTags] = useState(currentDoc?.classification?.tags || []);
  const [newTag, setNewTag] = useState('');

  // Atualiza estado quando documento muda
  const loadDocument = (doc: TCUReviewDocument) => {
    setEditedTitle(doc?.classification?.titulo || doc?.title || '');
    setEditedDescription(doc?.classification?.descricao || doc?.description || '');
    setEditedCategory(doc?.classification?.categoria || doc?.category || 'acordao');
    setEditedCourses(doc?.classification?.cursos || []);
    setEditedTags(doc?.classification?.tags || []);
    setNewTag('');
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      loadDocument(documents[newIndex]);
    }
  };

  const handleNext = () => {
    if (currentIndex < documents.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      loadDocument(documents[newIndex]);
    }
  };

  const handleApprove = () => {
    onApprove(currentDoc.rowIndex, {
      title: editedTitle,
      description: editedDescription,
      category: editedCategory,
      courses: editedCourses,
      tags: editedTags,
    });

    // Vai para o próximo documento
    if (currentIndex < documents.length - 1) {
      handleNext();
    }
  };

  const handleSkip = () => {
    onSkip(currentDoc.rowIndex);

    // Vai para o próximo documento
    if (currentIndex < documents.length - 1) {
      handleNext();
    }
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    try {
      await onReprocess(currentDoc.rowIndex);
      // Recarrega documento após reprocessamento
      loadDocument(documents[currentIndex]);
    } finally {
      setIsReprocessing(false);
    }
  };

  const toggleCourse = (courseId: string) => {
    setEditedCourses(prev =>
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const addTag = () => {
    if (newTag.trim() && !editedTags.includes(newTag.trim())) {
      setEditedTags([...editedTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setEditedTags(editedTags.filter(t => t !== tag));
  };

  if (!currentDoc) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Nenhum documento para revisar</p>
      </div>
    );
  }

  const enrichmentStatus = currentDoc.enrichment?.success
    ? 'success'
    : currentDoc.enrichment?.error
    ? 'failed'
    : 'pending';

  const classificationStatus = currentDoc.classification?.success
    ? 'success'
    : currentDoc.classification?.error
    ? 'failed'
    : 'pending';

  return (
    <div className="space-y-6">
      {/* Header com navegação */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="text-lg font-semibold">
            Revisão de Documento {currentIndex + 1} de {documents.length}
          </h3>
          <p className="text-sm text-gray-600">
            {Math.round(((currentIndex + 1) / documents.length) * 100)}% concluído
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === documents.length - 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            Próximo
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Coluna Esquerda: Dados Originais */}
        <div className="space-y-6">
          {/* Dados da Planilha TCU */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-3">📊 Dados da Planilha TCU</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Número do Acórdão:</span>
                <p className="text-gray-700">{currentDoc.tcuData.acordao}</p>
              </div>
              <div>
                <span className="font-medium">Enunciado (Resumo):</span>
                <p className="text-gray-700">{currentDoc.tcuData.enunciado}</p>
              </div>
              <div>
                <span className="font-medium">Autor da Tese:</span>
                <p className="text-gray-700">{currentDoc.tcuData.autorTese}</p>
              </div>
              <div>
                <span className="font-medium">Contexto Temático:</span>
                <p className="text-gray-700">
                  {currentDoc.tcuData.area} → {currentDoc.tcuData.tema} → {currentDoc.tcuData.subtema}
                </p>
              </div>
              <div>
                <span className="font-medium">Legislação:</span>
                <p className="text-gray-700">{currentDoc.tcuData.legislacao || 'Não informada'}</p>
              </div>
              <div>
                <span className="font-medium">Indexadores:</span>
                <p className="text-gray-700">{currentDoc.tcuData.outrosIndexadores || 'Não informados'}</p>
              </div>
              <div>
                <span className="font-medium">Tipo do Processo:</span>
                <p className="text-gray-700">{currentDoc.tcuData.tipoProcesso}</p>
              </div>
              <div>
                <span className="font-medium">Data do Julgamento:</span>
                <p className="text-gray-700">{currentDoc.tcuData.data}</p>
              </div>
            </div>
          </div>

          {/* Dados de Enriquecimento */}
          <div className={`border rounded-lg p-4 ${
            enrichmentStatus === 'success' ? 'bg-green-50 border-green-200' :
            enrichmentStatus === 'failed' ? 'bg-red-50 border-red-200' :
            'bg-gray-50 border-gray-200'
          }`}>
            <h4 className={`font-semibold mb-3 ${
              enrichmentStatus === 'success' ? 'text-green-900' :
              enrichmentStatus === 'failed' ? 'text-red-900' :
              'text-gray-900'
            }`}>
              🔍 Enriquecimento TCU
              {enrichmentStatus === 'success' && ' (✅ Sucesso)'}
              {enrichmentStatus === 'failed' && ' (❌ Falhou)'}
              {enrichmentStatus === 'pending' && ' (⏳ Pendente)'}
            </h4>

            {enrichmentStatus === 'success' && currentDoc.enrichment && (
              <div className="space-y-2 text-sm">
                {currentDoc.enrichment.ementaCompleta && (
                  <div>
                    <span className="font-medium">Ementa Completa:</span>
                    <p className="text-gray-700 line-clamp-4">{currentDoc.enrichment.ementaCompleta}</p>
                  </div>
                )}
                {currentDoc.enrichment.metadados?.relator && (
                  <div>
                    <span className="font-medium">Relator:</span>
                    <p className="text-gray-700">{currentDoc.enrichment.metadados.relator}</p>
                  </div>
                )}
                {currentDoc.enrichment.metadados?.orgaoJulgador && (
                  <div>
                    <span className="font-medium">Órgão Julgador:</span>
                    <p className="text-gray-700">{currentDoc.enrichment.metadados.orgaoJulgador}</p>
                  </div>
                )}
                {currentDoc.enrichment.linkPDF && (
                  <div>
                    <span className="font-medium">Link PDF:</span>
                    <a
                      href={currentDoc.enrichment.linkPDF}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Abrir PDF oficial
                    </a>
                  </div>
                )}
              </div>
            )}

            {enrichmentStatus === 'failed' && (
              <p className="text-red-700 text-sm">{currentDoc.enrichment?.error}</p>
            )}

            {enrichmentStatus === 'pending' && (
              <p className="text-gray-700 text-sm">Enriquecimento não foi executado</p>
            )}
          </div>

          {/* Classificação IA */}
          <div className={`border rounded-lg p-4 ${
            classificationStatus === 'success' ? 'bg-purple-50 border-purple-200' :
            classificationStatus === 'failed' ? 'bg-red-50 border-red-200' :
            'bg-gray-50 border-gray-200'
          }`}>
            <h4 className={`font-semibold mb-3 ${
              classificationStatus === 'success' ? 'text-purple-900' :
              classificationStatus === 'failed' ? 'text-red-900' :
              'text-gray-900'
            }`}>
              🤖 Classificação IA
              {classificationStatus === 'success' && ` (✅ Confiança: ${currentDoc.classification?.confianca}%)`}
              {classificationStatus === 'failed' && ' (❌ Falhou)'}
              {classificationStatus === 'pending' && ' (⏳ Pendente)'}
            </h4>

            {classificationStatus === 'success' && currentDoc.classification && (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Raciocínio:</span>
                  <p className="text-gray-700 italic">{currentDoc.classification.raciocinio}</p>
                </div>
              </div>
            )}

            {classificationStatus === 'failed' && (
              <p className="text-red-700 text-sm">{currentDoc.classification?.error}</p>
            )}

            {classificationStatus === 'pending' && (
              <p className="text-gray-700 text-sm">Classificação não foi executada</p>
            )}
          </div>
        </div>

        {/* Coluna Direita: Edição */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-300 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-4">✏️ Editar Classificação</h4>

            <div className="space-y-4">
              {/* Título */}
              <div>
                <label className="block text-sm font-medium mb-1">Título</label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Título descritivo do documento"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium mb-1">Descrição</label>
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Descrição expandida do documento"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <select
                  value={editedCategory}
                  onChange={(e) => setEditedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="acordao">Acórdão</option>
                  <option value="apostila">Apostila</option>
                  <option value="parecer">Parecer</option>
                  <option value="legislacao">Legislação</option>
                  <option value="jurisprudencia">Jurisprudência</option>
                  <option value="doutrina">Doutrina</option>
                  <option value="modelo">Modelo</option>
                </select>
              </div>

              {/* Cursos */}
              <div>
                <label className="block text-sm font-medium mb-2">Cursos (selecione 1 ou mais)</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {availableCourses.map((course) => (
                    <label key={course.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={editedCourses.includes(course.id)}
                        onChange={() => toggleCourse(course.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm">{course.nome}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium mb-2">Tags</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Digite uma tag e pressione Enter"
                  />
                  <button
                    onClick={addTag}
                    type="button"
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="hover:text-blue-600"
                        type="button"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" />
              Pular
            </button>
            <button
              onClick={handleReprocess}
              disabled={isReprocessing}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isReprocessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reprocessar
            </button>
            <button
              onClick={handleApprove}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <Check className="h-4 w-4" />
              Aprovar e Próximo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
