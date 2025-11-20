'use client';

import { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, BookOpen, Target, Lightbulb, MessageCircle } from 'lucide-react';
import { WizardStepProps } from './types';

export default function Step3EducationalContent({
  formState,
  updateForm,
  onNext,
  onPrevious,
}: WizardStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateContent = async () => {
    setIsGenerating(true);

    try {
      // Chamar API de enhancement
      const response = await fetch('/api/admin/documents/temp-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formState.title,
          description: formState.description,
          category: formState.category,
          leiArticles: formState.leiArticles,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar conteúdo com IA');
      }

      const data = await response.json();
      const { enhancement } = data;

      updateForm({
        summary: enhancement.summary || '',
        keyPoints: enhancement.keyPoints || '',
        practicalUse: enhancement.practicalUse || '',
        publicNotes: enhancement.publicNotes || '',
      });
    } catch (error) {
      console.error('[Step3] Erro ao gerar conteúdo:', error);
      alert('Erro ao gerar conteúdo educacional. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const hasContent =
    formState.summary ||
    formState.keyPoints ||
    formState.practicalUse ||
    formState.publicNotes;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900">Conteúdo Educacional</h2>
        <p className="text-sm text-gray-600 mt-1">
          Resumo, pontos-chave e orientações para os alunos (gerado por IA, editável)
        </p>
      </div>

      {/* Botão Gerar com IA */}
      {!hasContent && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Gerar Conteúdo Educacional com IA
              </h3>
              <p className="text-sm text-blue-700">
                A IA irá gerar automaticamente o resumo executivo, pontos-chave, aplicação prática e
                observações educacionais do Prof. Barral com base nas informações anteriores.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateContent}
              disabled={isGenerating}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Gerar Conteúdo
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Botão Regenerar (se já tem conteúdo) */}
      {hasContent && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerateContent}
            disabled={isGenerating}
            className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Regenerando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Regenerar com IA
              </>
            )}
          </button>
        </div>
      )}

      {/* Resumo Executivo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          Resumo Executivo
        </label>
        <textarea
          value={formState.summary}
          onChange={(e) => updateForm({ summary: e.target.value })}
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="Resumo executivo do documento (2-3 parágrafos destacando o que é e por que é relevante)"
        />
        <p className="text-xs text-gray-500 mt-1">
          Este resumo aparecerá no modal de detalhes do documento para os alunos.
        </p>
      </div>

      {/* Pontos-Chave */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-600" />
          Pontos-Chave para Alunos
        </label>
        <textarea
          value={formState.keyPoints}
          onChange={(e) => updateForm({ keyPoints: e.target.value })}
          rows={5}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
          placeholder="Um ponto-chave por linha:&#10;- Primeiro ponto importante&#10;- Segundo ponto importante&#10;- Terceiro ponto importante"
        />
        <p className="text-xs text-gray-500 mt-1">
          Cada linha será exibida como um bullet point. Seja direto e conciso (3-5 pontos).
        </p>
      </div>

      {/* Aplicação Prática */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-600" />
          Aplicação Prática
        </label>
        <textarea
          value={formState.practicalUse}
          onChange={(e) => updateForm({ practicalUse: e.target.value })}
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="Como o aluno pode aplicar este documento na prática profissional? (2-3 frases)"
        />
        <p className="text-xs text-gray-500 mt-1">
          Explique o valor prático deste documento para a atuação profissional do aluno.
        </p>
      </div>

      {/* Observações do Professor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-purple-600" />
          Observações do Prof. Barral
        </label>
        <textarea
          value={formState.publicNotes}
          onChange={(e) => updateForm({ publicNotes: e.target.value })}
          rows={4}
          className="w-full px-4 py-3 border border-amber-100 bg-amber-50 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none italic"
          placeholder='"Este documento é essencial para...", "Atenção especial para...", "Recomendo estudar em conjunto com..."'
        />
        <p className="text-xs text-gray-500 mt-1">
          Observações educacionais destacadas do professor para os alunos. Use tom didático e pessoal.
        </p>
      </div>

      {/* Preview Box */}
      {hasContent && (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            👁️ Preview: Como alunos verão
          </h3>
          <div className="space-y-4 bg-white p-4 rounded-lg border border-gray-300">
            {formState.summary && (
              <div>
                <h4 className="text-xs font-semibold text-blue-900 mb-1">RESUMO</h4>
                <p className="text-sm text-gray-700 leading-relaxed">{formState.summary}</p>
              </div>
            )}

            {formState.keyPoints && (
              <div>
                <h4 className="text-xs font-semibold text-indigo-900 mb-1">PONTOS-CHAVE</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  {formState.keyPoints.split('\n').filter(Boolean).map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <span>{point.replace(/^[-•]\s*/, '')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {formState.practicalUse && (
              <div className="bg-green-50 p-3 rounded border border-green-200">
                <h4 className="text-xs font-semibold text-green-900 mb-1">APLICAÇÃO PRÁTICA</h4>
                <p className="text-sm text-gray-700">{formState.practicalUse}</p>
              </div>
            )}

            {formState.publicNotes && (
              <div className="bg-amber-50 p-3 rounded border border-amber-200">
                <h4 className="text-xs font-semibold text-amber-900 mb-1">
                  OBSERVAÇÕES DO PROF. BARRAL
                </h4>
                <p className="text-sm text-gray-700 italic">{formState.publicNotes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botões de Navegação */}
      <div className="flex justify-between items-center pt-6 border-t">
        <button
          type="button"
          onClick={onPrevious}
          className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Voltar
        </button>

        <button
          type="button"
          onClick={onNext}
          className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Próximo: Finalizar →
        </button>
      </div>
    </div>
  );
}
