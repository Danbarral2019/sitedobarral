export default function CursosLoading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-12 text-center animate-pulse">
          <div className="h-12 bg-surface-deep rounded-[6px] w-96 mx-auto mb-4"></div>
          <div className="h-6 bg-surface-deep rounded w-2/3 mx-auto"></div>
        </div>

        {/* Courses Grid Skeleton */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-white rounded-[6px] overflow-hidden h-full border border-border-subtle">
                <div className="h-4 bg-brand-500"></div>
                <div className="p-6">
                  <div className="h-6 bg-surface-deep rounded mb-3"></div>
                  <div className="space-y-2 mb-4">
                    <div className="h-4 bg-surface-deep rounded"></div>
                    <div className="h-4 bg-surface-deep rounded w-4/5"></div>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-5 w-5 bg-surface-deep rounded-full"></div>
                    <div className="h-4 bg-surface-deep rounded w-24"></div>
                  </div>
                  <div className="h-10 bg-surface-deep rounded-[6px]"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
