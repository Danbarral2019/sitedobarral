import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

type Tone = 'success' | 'info' | 'error';

const TONE_STYLES: Record<Tone, { circle: string; icon: ReactNode }> = {
  success: {
    circle: 'bg-green-500',
    icon: <CheckCircle className="w-8 h-8 text-white" aria-hidden="true" />,
  },
  info: {
    circle: 'bg-primary-600',
    icon: <Info className="w-8 h-8 text-white" aria-hidden="true" />,
  },
  error: {
    circle: 'bg-red-600',
    icon: <AlertCircle className="w-8 h-8 text-white" aria-hidden="true" />,
  },
};

/**
 * Cartão simples das páginas de confirmação e de descadastro da newsletter,
 * no mesmo padrão visual da antiga página /cancelar-newsletter.
 */
export default function NewsletterStatusCard({
  tone,
  title,
  children,
}: {
  tone: Tone;
  title: string;
  children: ReactNode;
}) {
  const style = TONE_STYLES[tone];
  return (
    <div className="min-h-screen bg-brand-50 py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-[6px] border-2 border-border-subtle p-8 md:p-12 text-center">
          <div className={`w-16 h-16 ${style.circle} rounded-full flex items-center justify-center mx-auto mb-6`}>
            {style.icon}
          </div>
          <h1 className="text-3xl font-bold text-ink-primary mb-4">{title}</h1>
          <div className="text-lg text-ink-secondary space-y-4">{children}</div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-[6px] font-semibold hover:bg-primary-700 transition-colors mt-8"
          >
            Voltar para o site
          </Link>
        </div>
      </div>
    </div>
  );
}
