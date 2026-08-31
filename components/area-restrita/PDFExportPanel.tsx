'use client';

import { useState } from 'react';
import { FileDown, X, Loader2, CheckSquare, Square, Heart } from 'lucide-react';

interface DocumentForExport {
 id: string;
 title: string;
 description?: string;
 category: string;
}

interface PDFExportPanelProps {
 documents: DocumentForExport[];
 userName: string;
 userEmail: string;
 favoriteIds: string[];
}

export function PDFExportPanel({ documents, userName, userEmail, favoriteIds }: PDFExportPanelProps) {
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [isExporting, setIsExporting] = useState(false);
 const [showPanel, setShowPanel] = useState(false);

 const toggleSelection = (id: string) => {
 const newSelected = new Set(selectedIds);
 if (newSelected.has(id)) {
 newSelected.delete(id);
 } else {
 newSelected.add(id);
 }
 setSelectedIds(newSelected);
 };

 const toggleAll = () => {
 if (selectedIds.size === documents.length) {
 setSelectedIds(new Set());
 } else {
 setSelectedIds(new Set(documents.map(d => d.id)));
 }
 };

 const selectOnlyFavorites = () => {
 const validFavorites = favoriteIds.filter(id =>
 documents.some(doc => doc.id === id)
 );
 setSelectedIds(new Set(validFavorites));
 };

 const handleOpenPanel = () => {
 setShowPanel(true);
 if (favoriteIds.length > 0 && selectedIds.size === 0) {
 selectOnlyFavorites();
 }
 };

 const handleExport = async () => {
 if (selectedIds.size === 0) {
 alert('Selecione pelo menos um documento');
 return;
 }

 try {
 setIsExporting(true);

 // Determine mode based on selection
 const selectedArray = Array.from(selectedIds);
 const allAreFavorites = selectedArray.length > 0 &&
 selectedArray.every(id => favoriteIds.includes(id)) &&
 selectedArray.length === favoriteIds.filter(id => documents.some(d => d.id === id)).length;

 const mode = allAreFavorites ? 'favorites' : 'custom';

 const response = await fetch('/api/export-pdf', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 documentIds: selectedArray,
 mode,
 }),
 });

 if (!response.ok) {
 throw new Error('Erro ao gerar PDF');
 }

 const blob = await response.blob();
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `documentos-${new Date().toISOString().split('T')[0]}.pdf`;
 document.body.appendChild(a);
 a.click();
 window.URL.revokeObjectURL(url);
 document.body.removeChild(a);

 setSelectedIds(new Set());
 setShowPanel(false);
 } catch (error) {
 console.error('Erro ao exportar PDF:', error);
 alert('Erro ao exportar documentos para PDF. Tente novamente.');
 } finally {
 setIsExporting(false);
 }
 };

 if (!showPanel) {
 return (
 <button
 onClick={handleOpenPanel}
 className="fixed bottom-20 lg:bottom-6 right-6 bg-brand-600 text-surface-page px-6 py-3 rounded-full hover:bg-brand-800 transition-all flex items-center gap-2 z-40"
 title="Exportar documentos para PDF"
 >
 <FileDown className="w-5 h-5" />
 <span className="font-medium">Exportar PDF</span>
 </button>
 );
 }

 return (
 <div className="fixed bottom-0 right-0 left-0 bg-surface-page border-t-2 border-brand-600 z-50 max-h-[80vh] overflow-hidden flex flex-col">
 {/* Header */}
 <div className="p-4 border-b bg-surface-raised">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-bold text-ink-primary flex items-center gap-2">
 <FileDown className="w-5 h-5 text-brand-600" />
 Exportar Documentos para PDF
 </h3>
 <p className="text-sm text-ink-secondary mt-1">
 Selecione os documentos que deseja compilar em um PDF com marca d&apos;agua
 </p>
 </div>
 <button
 onClick={() => setShowPanel(false)}
 className="p-2 hover:bg-surface-deep rounded-[3px] transition-colors"
 title="Fechar painel"
 >
 <X className="w-5 h-5 text-ink-secondary" />
 </button>
 </div>

 {/* Stats e Acoes */}
 <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
 <div className="flex items-center gap-4">
 <span className="text-sm font-medium text-ink-secondary">
 {selectedIds.size} de {documents.length} selecionados
 </span>
 <button
 onClick={toggleAll}
 className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
 >
 {selectedIds.size === documents.length ? (
 <>
 <Square className="w-4 h-4" />
 Desmarcar Todos
 </>
 ) : (
 <>
 <CheckSquare className="w-4 h-4" />
 Selecionar Todos
 </>
 )}
 </button>
 {favoriteIds.length > 0 && (
 <button
 onClick={selectOnlyFavorites}
 className="text-sm text-semantic-error hover:text-semantic-error font-medium flex items-center gap-1"
 title={`Selecionar apenas favoritos (${favoriteIds.length})`}
 >
 <Heart className="w-4 h-4 fill-current" />
 Apenas Favoritos ({favoriteIds.filter(id => documents.some(d => d.id === id)).length})
 </button>
 )}
 </div>

 <button
 onClick={handleExport}
 disabled={selectedIds.size === 0 || isExporting}
 className="px-6 py-2 bg-brand-600 text-surface-page rounded-[3px] hover:bg-brand-800 disabled:bg-border-strong disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
 >
 {isExporting ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Gerando PDF...
 </>
 ) : (
 <>
 <FileDown className="w-4 h-4" />
 Gerar PDF ({selectedIds.size})
 </>
 )}
 </button>
 </div>
 </div>

 {/* Lista de Documentos */}
 <div className="flex-1 overflow-y-auto p-4">
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
 {documents.map((doc) => {
 const isSelected = selectedIds.has(doc.id);
 const isFavorite = favoriteIds.includes(doc.id);

 return (
 <div
 key={doc.id}
 onClick={() => toggleSelection(doc.id)}
 className={`p-3 border-2 rounded-[3px] cursor-pointer transition-all ${
 isSelected
 ? 'border-brand-600 bg-surface-raised'
 : 'border-border-subtle bg-surface-page hover:border-border-strong'
 }`}
 >
 <div className="flex items-start gap-3">
 <div className="flex-shrink-0 mt-1">
 {isSelected ? (
 <CheckSquare className="w-5 h-5 text-brand-600" />
 ) : (
 <Square className="w-5 h-5 text-ink-muted" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between gap-2">
 <h4 className="font-medium text-sm text-ink-primary line-clamp-2 flex-1">
 {doc.title}
 </h4>
 {isFavorite && (
 <Heart className="w-4 h-4 text-semantic-error fill-current flex-shrink-0" aria-label="Favorito" />
 )}
 </div>
 {doc.description && (
 <p className="text-xs text-ink-secondary mt-1 line-clamp-2">
 {doc.description}
 </p>
 )}
 <div className="mt-2">
 <span className="text-xs bg-surface-deep text-ink-secondary px-2 py-0.5 rounded">
 {doc.category}
 </span>
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>

 {documents.length === 0 && (
 <div className="text-center py-12 text-ink-muted">
 <FileDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
 <p>Nenhum documento disponivel para exportacao</p>
 </div>
 )}
 </div>

 {/* Info Footer */}
 <div className="p-3 bg-surface-raised border-t text-xs text-ink-secondary flex items-center gap-2">
 <span className="font-semibold">Info:</span>
 <span>
 O PDF incluira marca d&apos;agua com <strong>{userName}</strong> ({userEmail}) e data de exportacao
 </span>
 </div>
 </div>
 );
}
