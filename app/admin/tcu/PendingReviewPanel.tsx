'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, ExternalLink, Check, AlertCircle } from 'lucide-react';

interface PendingItem {
  id: string;
  tcuNumeroAcordao: string;
  title: string;
  tcuArea: string;
  tcuTema: string;
  tcuSubtema: string | null;
  tcuRelator: string | null;
  tcuOrgaoJulgador: string | null;
  tcuDataJulgamento: string | null;
  tcuLinkPDF: string | null;
  summary: string | null;
}

interface ApiResponse {
  items: PendingItem[];
  page: number;
  totalPages: number;
  total: number;
}

const AREAS = [
  'Competência do TCU',
  'Contrato Administrativo',
  'Convênio',
  'Desestatização',
  'Direito Processual',
  'Finanças Públicas',
  'Gestão Administrativa',
  'Licitação',
  'Pessoal',
  'Responsabilidade',
];

export default function PendingReviewPanel() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [areaFilter, setAreaFilter] = useState<string>('');
  const [onlyNewTerms, setOnlyNewTerms] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ area: string; tema: string; subtema: string }>({ area: '', tema: '', subtema: '' });
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page) });
    if (areaFilter) qs.set('area', areaFilter);
    if (onlyNewTerms) qs.set('onlyNewTerms', 'true');
    try {
      const r = await fetch(`/api/admin/tcu/pending-classifications?${qs}`);
      if (!r.ok) throw new Error('falha na API');
      setData(await r.json());
    } catch (err) {
      console.error('[PendingReview] erro:', err);
    } finally {
      setLoading(false);
    }
  }, [page, areaFilter, onlyNewTerms]);

  useEffect(() => { load(); }, [load]);

  function startEdit(item: PendingItem) {
    setEditingId(item.id);
    setEditForm({ area: item.tcuArea, tema: item.tcuTema, subtema: item.tcuSubtema || '' });
  }

  async function patchClassification(
    id: string,
    payload: { area: string; tema: string; subtema: string | null; markReviewed: boolean }
  ) {
    setSavingId(id);
    try {
      const r = await fetch(`/api/admin/tcu/classifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(`Falha ao salvar: ${err.error || r.statusText}`);
        return false;
      }
      return true;
    } finally {
      setSavingId(null);
    }
  }

  async function saveEdit(id: string, markReviewed: boolean) {
    if (!editForm.area || !editForm.tema) {
      alert('Área e tema são obrigatórios');
      return;
    }
    const ok = await patchClassification(id, {
      area: editForm.area,
      tema: editForm.tema,
      subtema: editForm.subtema || null,
      markReviewed,
    });
    if (ok) {
      setEditingId(null);
      await load();
    }
  }

  async function approveAsIs(item: PendingItem) {
    const ok = await patchClassification(item.id, {
      area: item.tcuArea,
      tema: item.tcuTema,
      subtema: item.tcuSubtema,
      markReviewed: true,
    });
    if (ok) await load();
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <strong>{data?.total ?? 0} acórdão(s) classificado(s) por IA aguardando revisão editorial.</strong>
          {' '}Confirme ou edite área/tema/subtema. Marque como revisado quando aprovar.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-700 flex items-center gap-2">
          Área:
          <select
            value={areaFilter}
            onChange={e => { setAreaFilter(e.target.value); setPage(1); }}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">Todas</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-700 flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyNewTerms}
            onChange={e => { setOnlyNewTerms(e.target.checked); setPage(1); }}
          />
          Somente com termos fora da taxonomia oficial
        </label>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
      </div>

      <div className="space-y-3">
        {data?.items.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            Nenhum acórdão pendente com os filtros atuais.
          </div>
        )}
        {data?.items.map(item => (
          <div key={item.id} className="border border-gray-200 rounded p-4 bg-white">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="min-w-0">
                <div className="font-mono text-sm text-blue-600">{item.tcuNumeroAcordao}</div>
                <div className="text-sm text-gray-600">
                  {item.tcuRelator}
                  {item.tcuOrgaoJulgador && ` • ${item.tcuOrgaoJulgador}`}
                  {item.tcuDataJulgamento && ` • ${new Date(item.tcuDataJulgamento).toLocaleDateString('pt-BR')}`}
                </div>
              </div>
              {item.tcuLinkPDF && (
                <a
                  href={item.tcuLinkPDF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1 shrink-0"
                >
                  PDF <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            {item.summary && <p className="text-sm text-gray-700 mb-3">{item.summary}</p>}

            {editingId === item.id ? (
              <div className="space-y-2 bg-gray-50 p-3 rounded">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    value={editForm.area}
                    onChange={e => setEditForm({ ...editForm, area: e.target.value })}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <input
                    value={editForm.tema}
                    onChange={e => setEditForm({ ...editForm, tema: e.target.value })}
                    placeholder="Tema"
                    className="border rounded px-2 py-1 text-sm"
                  />
                  <input
                    value={editForm.subtema}
                    onChange={e => setEditForm({ ...editForm, subtema: e.target.value })}
                    placeholder="Subtema (opcional)"
                    className="border rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => saveEdit(item.id, true)}
                    disabled={savingId === item.id}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    Salvar e marcar revisado
                  </button>
                  <button
                    onClick={() => saveEdit(item.id, false)}
                    disabled={savingId === item.id}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    disabled={savingId === item.id}
                    className="text-sm px-3 py-1 hover:bg-gray-200 rounded"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-semibold text-gray-900">{item.tcuArea}</span>
                  {' › '}{item.tcuTema}
                  {item.tcuSubtema && <> {' › '}<span className="text-gray-600">{item.tcuSubtema}</span></>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(item)}
                    className="text-sm px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => approveAsIs(item)}
                    disabled={savingId === item.id}
                    className="text-sm px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 flex items-center gap-1 disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" /> Aprovar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            Anterior
          </button>
          <span className="px-3 py-1 text-sm text-gray-700">
            Página {page} de {data.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages || loading}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
