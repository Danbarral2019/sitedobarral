export default function BlogLoading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-12 animate-pulse">
          <div className="h-12 bg-surface-deep rounded-[6px] w-64 mb-4"></div>
          <div className="h-6 bg-surface-deep rounded w-96"></div>
        </div>

        {/* Posts Grid Skeleton */}
        <div className="grid gap-8 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-white rounded-[6px] overflow-hidden border border-border-subtle">
                <div className="h-48 bg-surface-deep"></div>
                <div className="p-6">
                  <div className="h-4 bg-surface-deep rounded w-24 mb-4"></div>
                  <div className="h-8 bg-surface-deep rounded mb-3"></div>
                  <div className="space-y-2 mb-4">
                    <div className="h-4 bg-surface-deep rounded"></div>
                    <div className="h-4 bg-surface-deep rounded w-5/6"></div>
                  </div>
                  <div className="h-4 bg-surface-deep rounded w-32"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
