'use client';

import { useRouter } from 'next/navigation';

export interface NavigateSelectProps {
  /** Path base (ex: '/base-conhecimento/pareceres') */
  basePath: string;
  /** Querystring param key que esse select controla (ex: 'ano') */
  param: string;
  /** Demais params atuais a preservar (não inclui o controlado) */
  preservedParams: Record<string, string>;
  /** Valor atualmente selecionado (vazio = "Todos") */
  value: string;
  /** Opções do select */
  options: ReadonlyArray<{ value: string; label: string }>;
  /** Label da opção "Todos" */
  emptyLabel?: string;
  /** Aria-label */
  ariaLabel?: string;
  className?: string;
}

/**
 * Dropdown que navega via Next router ao mudar valor. Client Component
 * embutido em páginas Server. Recebe APENAS dados serializáveis (sem
 * funções) — constrói a URL internamente a partir de basePath + param +
 * preservedParams.
 */
export function NavigateSelect({
  basePath,
  param,
  preservedParams,
  value,
  options,
  emptyLabel = 'Todos',
  ariaLabel,
  className = 'px-3 py-1 text-sm border border-border-subtle rounded-md bg-white focus:ring-2 focus:ring-brand-500',
}: NavigateSelectProps) {
  const router = useRouter();

  function buildHref(newValue: string): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(preservedParams)) {
      if (v) params.set(k, v);
    }
    if (newValue) params.set(param, newValue);
    else params.delete(param);
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ''}`;
  }

  return (
    <select
      defaultValue={value}
      onChange={(e) => router.push(buildHref(e.target.value))}
      className={className}
      aria-label={ariaLabel}
    >
      <option value="">{emptyLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
