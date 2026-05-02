'use client';
interface Reading { id: string; kind: string; title?: string | null; order: number }
interface Props { numero: string; initial: Reading[]; onChanged: () => void }
export function ReadingsEditor({ initial }: Props) {
  return <p className="text-sm text-gray-500">ReadingsEditor stub ({initial.length} itens)</p>;
}
