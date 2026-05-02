'use client';

interface Props {
  numero: string;
}

export function ArticleEditorMain({ numero }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <p className="text-gray-600">Editor do artigo {numero} (em construção)</p>
    </div>
  );
}
