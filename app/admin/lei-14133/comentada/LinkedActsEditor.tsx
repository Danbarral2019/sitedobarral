'use client';
interface LinkedAct { id: string; fullNumber: string; title: string; importance: string | null }
interface Props { numero: string; linked: LinkedAct[]; onChanged: () => void }
export function LinkedActsEditor({ linked }: Props) {
  return <p className="text-sm text-gray-500">LinkedActsEditor stub ({linked.length} itens)</p>;
}
