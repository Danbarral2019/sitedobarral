'use client';

import { useRouter } from 'next/navigation';

export interface NavigateSelectProps {
  /** Function que recebe o novo valor e retorna a URL pra navegar */
  buildHref: (value: string) => string;
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
 * mínimo embutido em páginas de listagem (Server Components).
 */
export function NavigateSelect({
  buildHref,
  value,
  options,
  emptyLabel = 'Todos',
  ariaLabel,
  className = 'px-3 py-1 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-brand-500',
}: NavigateSelectProps) {
  const router = useRouter();
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
