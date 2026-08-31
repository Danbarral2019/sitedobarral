import { ReloadButton } from './ReloadButton';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/favicon-180.png"
        alt="Prof. Daniel Barral"
        width={80}
        height={80}
        className="h-20 w-auto mb-8"
      />
      <h1 className="text-2xl font-semibold text-[#20364e] mb-3 font-heading text-center">
        Você está offline
      </h1>
      <p className="text-ink-muted mb-8 text-center max-w-md">
        Verifique sua conexão com a internet e tente novamente.
      </p>
      <ReloadButton />
    </div>
  );
}
