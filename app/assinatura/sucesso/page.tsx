'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type PollState = 'polling' | 'confirmed' | 'timeout' | 'error';

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 10; // 10 × 3s = 30s

export default function AssinaturaSucessoPage() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <SucessoContent />
    </Suspense>
  );
}

function SuspenseFallback() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-[6px] p-10 border border-border-subtle">
          <PollingView />
        </div>
      </div>
    </div>
  );
}

function SucessoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');

  const [state, setState] = useState<PollState>(sessionId ? 'polling' : 'timeout');
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (cancelled) return;
      attemptRef.current += 1;

      try {
        const res = await fetch(`/api/pagamento/status?session_id=${encodeURIComponent(sessionId!)}`, {
          cache: 'no-store',
        });

        if (!res.ok) {
          if (res.status === 403 || res.status === 404) {
            if (!cancelled) setState('error');
            return;
          }
          throw new Error(`status ${res.status}`);
        }

        const body = await res.json() as { subscription: { status: string } | null };

        if (body.subscription?.status === 'active') {
          if (!cancelled) {
            setState('confirmed');
            router.replace('/area-restrita');
          }
          return;
        }
      } catch {
        // transient error — keep polling until attempts run out
      }

      if (cancelled) return;

      if (attemptRef.current >= MAX_ATTEMPTS) {
        setState('timeout');
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-[6px] p-10 border border-border-subtle">
          {state === 'polling' && <PollingView />}
          {state === 'confirmed' && <ConfirmedView />}
          {state === 'timeout' && <TimeoutView />}
          {state === 'error' && <ErrorView />}
        </div>
      </div>
    </div>
  );
}

function PollingView() {
  return (
    <>
      <div className="inline-flex items-center justify-center w-20 h-20 mb-6">
        <svg
          className="animate-spin w-16 h-16 text-brand-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          role="status"
          aria-label="Confirmando pagamento"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-75" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-ink-primary mb-3">Confirmando pagamento…</h1>
      <p className="text-ink-muted">Isso leva poucos segundos. Não feche esta página.</p>
    </>
  );
}

function ConfirmedView() {
  return (
    <>
      <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-ink-primary mb-3">Assinatura ativada!</h1>
      <p className="text-ink-muted mb-6">Redirecionando para a área restrita…</p>
      <Link
        href="/area-restrita"
        className="block w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 px-6 rounded-[6px] transition-colors"
      >
        Ir para área restrita
      </Link>
    </>
  );
}

function TimeoutView() {
  return (
    <>
      <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-100 rounded-full mb-6">
        <svg className="w-10 h-10 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-ink-primary mb-3">Estamos finalizando seu pagamento</h1>
      <p className="text-ink-muted mb-2">
        A confirmação pode levar alguns minutos (com Pix, até 7 dias).
      </p>
      <p className="text-ink-muted mb-6">
        Você receberá um e-mail assim que a assinatura for ativada.
      </p>
      <div className="space-y-3">
        <Link
          href="/area-restrita"
          className="block w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 px-6 rounded-[6px] transition-colors"
        >
          Ir para área restrita
        </Link>
        <Link href="/" className="block w-full text-ink-muted hover:text-ink-primary font-medium py-2 transition-colors">
          Voltar ao site
        </Link>
      </div>
    </>
  );
}

function ErrorView() {
  return (
    <>
      <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-ink-primary mb-3">Não conseguimos validar esta sessão</h1>
      <p className="text-ink-muted mb-6">
        Se o pagamento foi efetuado, você receberá um e-mail de confirmação. Em caso de dúvida, entre em contato.
      </p>
      <div className="space-y-3">
        <Link
          href="/planos"
          className="block w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 px-6 rounded-[6px] transition-colors"
        >
          Ver planos
        </Link>
        <Link href="/" className="block w-full text-ink-muted hover:text-ink-primary font-medium py-2 transition-colors">
          Voltar ao site
        </Link>
      </div>
    </>
  );
}
