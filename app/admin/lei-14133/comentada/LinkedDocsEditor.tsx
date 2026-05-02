'use client';
interface LinkedDoc { id: string; title: string; category: string | null; isPublic: boolean; notesImportance: string | null }
interface Props { numero: string; linked: LinkedDoc[]; onChanged: () => void }
export function LinkedDocsEditor({ linked }: Props) {
  return <p className="text-sm text-gray-500">LinkedDocsEditor stub ({linked.length} itens)</p>;
}
