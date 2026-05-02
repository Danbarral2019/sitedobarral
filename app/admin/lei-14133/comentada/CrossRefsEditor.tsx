'use client';
interface CrossRef { id: string; targetNumber: string; note: string; order: number }
interface Props { numero: string; initial: CrossRef[]; onChanged: () => void }
export function CrossRefsEditor({ initial }: Props) {
  return <p className="text-sm text-gray-500">CrossRefsEditor stub ({initial.length} itens)</p>;
}
