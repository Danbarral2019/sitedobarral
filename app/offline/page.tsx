'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-white">
      <img
        src="/brand/sublogo.png"
        alt="Prof. Daniel Barral"
        className="h-20 w-auto mb-8"
      />
      <h1 className="text-2xl font-semibold text-[#20364e] mb-3 font-heading text-center">
        Você está offline
      </h1>
      <p className="text-gray-600 mb-8 text-center max-w-md">
        Verifique sua conexão com a internet e tente novamente.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="bg-[#20364e] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#2a4a6a] transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  )
}
