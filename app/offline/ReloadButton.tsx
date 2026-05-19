'use client';

export function ReloadButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="bg-[#20364e] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#2a4a6a] transition-colors"
    >
      Tentar novamente
    </button>
  );
}
