'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import {
  Save, X, Scale, Calendar, Building, FileText,
  Link as LinkIcon, AlertCircle
} from 'lucide-react';
import { TEMAS_LICITACOES } from '@/data/temas-licitacoes';

const TYPE_OPTIONS = [
  { value: 'decreto', label: 'Decreto' },
  { value: 'portaria', label: 'Portaria' },
  { value: 'in', label: 'Instrução Normativa (IN)' },
  { value: 'lei', label: 'Lei' },
  { value: 'medida-provisoria', label: 'Medida Provisória' },
  { value: 'ordem-servico', label: 'Ordem de Serviço' }
];

const ISSUER_OPTIONS = [
  'Presidência da República',
  'SEGES (Secretaria de Gestão e Inovação)',
  'MGI (Ministério da Gestão e Inovação)',
  'AGU (Advocacia-Geral da União)',
  'TCU (Tribunal de Contas da União)',
  'CGU (Controladoria-Geral da União)',
  'Ministério das Mulheres',
  'Ministério da Fazenda',
  'Ministério da Defesa',
  'Ministério da Saúde',
  'Ministério da Educação',
];

export default function NewLegislativeActPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    type: 'decreto',
    number: '',
    year: new Date().getFullYear().toString(),
    title: '',
    ementa: '',
    summary: '',
    issuer: '',
    publishDate: '',
    effectiveDate: '',
    leiArticles: '',
    officialUrl: '',
    pdfUrl: '',
    content: '',
    esfera: 'federal' as string,
    themes: [] as string[],
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.type) newErrors.type = 'Tipo é obrigatório';
    if (!formData.number) newErrors.number = 'Número é obrigatório';
    if (!formData.year) newErrors.year = 'Ano é obrigatório';
    if (!formData.title) newErrors.title = 'Título é obrigatório';
    if (!formData.ementa) newErrors.ementa = 'Ementa é obrigatória';
    if (!formData.issuer) newErrors.issuer = 'Órgão emissor é obrigatório';
    if (!formData.publishDate) newErrors.publishDate = 'Data de publicação é obrigatória';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      alert('Por favor, corrija os erros no formulário');
      return;
    }

    setIsLoading(true);

    try {
      // Processar artigos da Lei 14.133 (converter string CSV para array)
      let leiArticlesArray = null;
      if (formData.leiArticles.trim()) {
        leiArticlesArray = formData.leiArticles
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }

      const response = await fetch('/api/admin/legislative-acts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          number: formData.number,
          year: parseInt(formData.year),
          title: formData.title,
          ementa: formData.ementa,
          summary: formData.summary || undefined,
          issuer: formData.issuer,
          publishDate: formData.publishDate,
          effectiveDate: formData.effectiveDate || undefined,
          leiArticles: leiArticlesArray,
          officialUrl: formData.officialUrl || undefined,
          pdfUrl: formData.pdfUrl || undefined,
          content: formData.content || undefined,
          esfera: formData.esfera,
          themes: formData.themes.length > 0 ? formData.themes : undefined,
        })
      });

      if (response.ok) {
        alert('Ato normativo criado com sucesso!');
        router.push('/admin/legislacao');
      } else {
        const data = await response.json();
        alert(`Erro ao criar ato: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao criar ato:', error);
      alert('Erro ao criar ato normativo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Novo Ato Normativo</h1>
              <p className="text-gray-600">Adicionar novo ato à legislação</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Identificação do Ato</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 block">Tipo *</span>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.type ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  {TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors.type && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.type}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 block">Número *</span>
                <input
                  type="text"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  placeholder="Ex: 10.947"
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.number ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.number && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.number}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 block">Ano *</span>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder="2024"
                  min="2021"
                  max="2030"
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.year ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.year && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.year}
                  </p>
                )}
              </label>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Conteúdo</h3>

            <label className="block mb-4">
              <span className="text-sm font-bold text-gray-900 mb-2 block">Título *</span>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Regulamenta a Lei nº 14.133..."
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.title}
                </p>
              )}
            </label>

            <label className="block mb-4">
              <span className="text-sm font-bold text-gray-900 mb-2 block">Ementa *</span>
              <textarea
                value={formData.ementa}
                onChange={(e) => setFormData({ ...formData, ementa: e.target.value })}
                placeholder="Ementa oficial do ato normativo..."
                rows={3}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.ementa ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.ementa && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.ementa}
                </p>
              )}
            </label>

            <label className="block">
              <span className="text-sm font-bold text-gray-900 mb-2 block">Resumo Didático (Opcional)</span>
              <textarea
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                placeholder="Resumo simplificado para alunos..."
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </label>
          </div>

          {/* Metadados */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Metadados</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Órgão Emissor *
                </span>
                <input
                  type="text"
                  list="issuer-options"
                  value={formData.issuer}
                  onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
                  placeholder="Ex: Presidência da República, AGU, TCU..."
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.issuer ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <datalist id="issuer-options">
                  {ISSUER_OPTIONS.map(opt => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
                {errors.issuer && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.issuer}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  Artigos da Lei 14.133/2021
                </span>
                <input
                  type="text"
                  value={formData.leiArticles}
                  onChange={(e) => setFormData({ ...formData, leiArticles: e.target.value })}
                  placeholder="Ex: 75, 76, 77"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-600">
                  Números separados por vírgula (artigos regulamentados)
                </p>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <span className="text-sm font-bold text-gray-900 mb-2 block">Esfera</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                    <input type="radio" name="esfera" value="federal" checked={formData.esfera === 'federal'} onChange={() => setFormData({ ...formData, esfera: 'federal' })} />
                    <span className="text-sm font-medium">Federal</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                    <input type="radio" name="esfera" value="estadual" checked={formData.esfera === 'estadual'} onChange={() => setFormData({ ...formData, esfera: 'estadual' })} />
                    <span className="text-sm font-medium">Estadual</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <span className="text-sm font-bold text-gray-900 mb-2 block">Temas</span>
              <div className="flex flex-wrap gap-2">
                {TEMAS_LICITACOES.map((tema) => (
                  <button
                    key={tema.value}
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      themes: prev.themes.includes(tema.value)
                        ? prev.themes.filter(t => t !== tema.value)
                        : [...prev.themes, tema.value]
                    }))}
                    className={`px-3 py-1.5 text-xs rounded-full border-2 transition-colors ${
                      formData.themes.includes(tema.value)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {tema.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-600">Clique para selecionar/desselecionar temas</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Data de Publicação *
                </span>
                <input
                  type="date"
                  value={formData.publishDate}
                  onChange={(e) => setFormData({ ...formData, publishDate: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.publishDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.publishDate && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.publishDate}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Data de Vigência (Opcional)
                </span>
                <input
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </label>
            </div>
          </div>

          {/* Links */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Links e Recursos</h3>

            <label className="block mb-4">
              <span className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                URL Oficial (Planalto/DOU)
              </span>
              <input
                type="url"
                value={formData.officialUrl}
                onChange={(e) => setFormData({ ...formData, officialUrl: e.target.value })}
                placeholder="https://www.planalto.gov.br/..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </label>

            <label className="block mb-4">
              <span className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Link do PDF
              </span>
              <input
                type="url"
                value={formData.pdfUrl}
                onChange={(e) => setFormData({ ...formData, pdfUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-gray-900 mb-2 block">Texto Completo (Opcional)</span>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Texto integral do ato normativo..."
                rows={6}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </label>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={() => router.push('/admin/legislacao')}
              className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Ato
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
