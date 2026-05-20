'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Megaphone, Send, Users } from 'lucide-react';

type DryRunResult = {
  dryRun: true;
  recipientCount: number;
  sampleEmails: string[];
};

type SendResult = {
  sent: number;
  failed: number;
  message?: string;
  errors?: Array<{ email: string; error: string }>;
};

export default function AdminPlanejamentoAnunciarPage() {
  const [dryRunData, setDryRunData] = useState<DryRunResult | null>(null);
  const [sendData, setSendData] = useState<SendResult | null>(null);
  const [loadingDryRun, setLoadingDryRun] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDryRun = async () => {
    setLoadingDryRun(true);
    setError(null);
    setSendData(null);
    try {
      const res = await fetch('/api/admin/planning/announce?dryRun=true', {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const data: DryRunResult = await res.json();
      setDryRunData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoadingDryRun(false);
    }
  };

  const handleSend = async () => {
    setLoadingSend(true);
    setError(null);
    setConfirmOpen(false);
    try {
      const res = await fetch('/api/admin/planning/announce', {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const data: SendResult = await res.json();
      setSendData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoadingSend(false);
    }
  };

  const canSend = dryRunData !== null && dryRunData.recipientCount > 0 && !sendData;

  return (
    <div className="px-6 py-8 max-w-3xl">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <Megaphone className="w-7 h-7 text-brand-700" />
          <h1 className="font-serif text-2xl text-brand-900">
            Anunciar Módulo Planejamento
          </h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          Disparo único de e-mail anunciando o módulo de Planejamento da Contratação
          para todos os alunos com matrícula ativa. Use o passo 1 (visualizar)
          antes de enviar — o passo 2 não tem desfazer.
        </p>
      </header>

      {/* Aviso */}
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold mb-1">Atenção — envio de broadcast</p>
            <p>
              Este endpoint <strong>não previne reenvio</strong>. Chame uma única
              vez. Cada chamada com <code className="bg-amber-100 px-1 rounded text-xs">dryRun=false</code>{' '}
              envia e-mail para todos os destinatários ativos via Resend.
            </p>
          </div>
        </div>
      </div>

      {/* Passo 1: Dry Run */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-serif text-lg text-brand-900 mb-1">
              1. Visualizar destinatários
            </h2>
            <p className="text-sm text-gray-600">
              Lista quem receberá o e-mail sem enviar nada.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDryRun}
            disabled={loadingDryRun}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loadingDryRun ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando…
              </>
            ) : (
              <>
                <Users className="w-4 h-4" />
                Visualizar
              </>
            )}
          </button>
        </div>

        {dryRunData && (
          <div className="rounded-lg bg-gray-50 p-4 text-sm">
            <div className="font-semibold text-brand-900 mb-2">
              {dryRunData.recipientCount} destinatário
              {dryRunData.recipientCount === 1 ? '' : 's'} ativo
              {dryRunData.recipientCount === 1 ? '' : 's'}
            </div>
            {dryRunData.sampleEmails.length > 0 && (
              <>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  Amostra (primeiros {dryRunData.sampleEmails.length}):
                </div>
                <ul className="space-y-1 font-mono text-xs text-gray-700">
                  {dryRunData.sampleEmails.map((email) => (
                    <li key={email}>{email}</li>
                  ))}
                </ul>
              </>
            )}
            {dryRunData.recipientCount === 0 && (
              <div className="text-xs text-gray-500">
                Nenhum aluno com matrícula ativa — nada a enviar.
              </div>
            )}
          </div>
        )}
      </section>

      {/* Passo 2: Disparar */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-serif text-lg text-brand-900 mb-1">
              2. Disparar anúncio
            </h2>
            <p className="text-sm text-gray-600">
              {canSend
                ? 'Pronto para enviar. Você precisa confirmar antes.'
                : 'Faça a visualização primeiro.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!canSend || loadingSend}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loadingSend ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Disparar agora
              </>
            )}
          </button>
        </div>

        {sendData && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-green-900 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              Anúncio disparado
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">
                  Enviados
                </div>
                <div className="text-2xl font-semibold text-green-700">
                  {sendData.sent}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">
                  Falhas
                </div>
                <div className="text-2xl font-semibold text-red-700">
                  {sendData.failed}
                </div>
              </div>
            </div>
            {sendData.message && (
              <p className="text-xs text-gray-600">{sendData.message}</p>
            )}
            {sendData.errors && sendData.errors.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs font-semibold text-red-700 cursor-pointer">
                  Ver erros ({sendData.errors.length})
                </summary>
                <ul className="mt-2 space-y-1 font-mono text-xs text-red-900">
                  {sendData.errors.map((e, i) => (
                    <li key={i}>
                      <span className="font-semibold">{e.email}:</span> {e.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-semibold mb-1">Erro</div>
          <div className="font-mono text-xs">{error}</div>
        </div>
      )}

      {/* Confirmation modal */}
      {confirmOpen && dryRunData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-title" className="font-serif text-xl text-brand-900 mb-2">
              Confirmar envio?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Você está prestes a enviar o anúncio para{' '}
              <strong>{dryRunData.recipientCount} aluno{dryRunData.recipientCount === 1 ? '' : 's'}</strong>.
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSend}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                <Send className="w-4 h-4" />
                Sim, enviar agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
