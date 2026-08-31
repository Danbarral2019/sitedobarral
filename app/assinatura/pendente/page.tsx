import Link from 'next/link';

export default function AssinaturaPendentePage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-[6px] p-10 border border-border-subtle">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-accent-soft rounded-full mb-6">
            <svg className="w-10 h-10 text-amber-accent-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-ink-primary mb-3">
            Pagamento Pendente
          </h1>
          <p className="text-ink-muted mb-6">
            Seu pagamento está sendo processado. Assim que for confirmado, seu acesso será liberado automaticamente.
          </p>

          <div className="bg-amber-accent-soft border border-amber-accent-soft rounded-[6px] p-4 mb-8 text-left">
            <p className="text-sm font-medium text-amber-accent-deep mb-2">Instruções:</p>
            <ul className="text-sm text-amber-accent-deep space-y-1.5">
              <li>- <strong>PIX:</strong> Escaneie o QR Code ou copie o código para finalizar o pagamento</li>
              <li>- <strong>Boleto:</strong> Pague até a data de vencimento indicada</li>
            </ul>
            <p className="text-xs text-amber-accent-deep mt-3">
              O processamento pode levar alguns minutos após a confirmação do pagamento.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/planos"
              className="block w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 px-6 rounded-[6px] transition-colors"
            >
              Voltar aos Planos
            </Link>
            <Link
              href="/"
              className="block w-full text-ink-muted hover:text-ink-primary font-medium py-2 transition-colors"
            >
              Voltar ao site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
