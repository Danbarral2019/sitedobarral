import { AlertTriangle } from 'lucide-react';

interface CourseSuspensionBannerProps {
  reason?: string | null;
  suspendedAt?: string | Date | null;
  plannedReturn?: string | Date | null;
  variant?: 'course' | 'lesson';
}

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export default function CourseSuspensionBanner({
  reason,
  suspendedAt,
  plannedReturn,
  variant = 'course',
}: CourseSuspensionBannerProps) {
  const heading =
    variant === 'lesson'
      ? 'Conteúdo desta aula em revisão editorial'
      : 'Curso em revisão editorial';

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 lg:p-6 mb-6">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-amber-900">{heading}</h3>
          <p className="text-sm text-amber-800 mt-1.5 leading-relaxed">
            {reason ||
              'O conteúdo textual deste curso está temporariamente indisponível para revisão e atualização. Pedimos desculpas pelo transtorno.'}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-amber-700">
            {suspendedAt && (
              <span>
                <strong>Suspenso em:</strong> {formatDate(suspendedAt)}
              </span>
            )}
            {plannedReturn && (
              <span>
                <strong>Previsão de retorno:</strong> {formatDate(plannedReturn)}
              </span>
            )}
          </div>
          {variant === 'lesson' && (
            <p className="text-xs text-amber-700 mt-3 italic">
              Os documentos e vídeos vinculados a esta aula continuam disponíveis abaixo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
