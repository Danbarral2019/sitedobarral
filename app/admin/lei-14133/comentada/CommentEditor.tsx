'use client';
interface Props {
  initial: string;
  onSave: (markdown: string) => Promise<void>;
  onCancel: () => void;
}
export function CommentEditor({ onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <p>CommentEditor stub</p>
        <button onClick={onCancel} className="mt-4 px-4 py-2 bg-gray-200 rounded">Fechar</button>
      </div>
    </div>
  );
}
