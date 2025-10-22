export default function PublicacoesLoading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-12 animate-pulse">
          <div className="h-12 bg-gray-200 rounded-lg w-80 mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-96"></div>
        </div>

        {/* Filter Tabs Skeleton */}
        <div className="flex gap-4 mb-8 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-200 rounded-lg w-32"></div>
          ))}
        </div>

        {/* Publications List Skeleton */}
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-md p-6 animate-pulse">
              <div className="flex gap-4">
                <div className="w-24 h-32 bg-gray-200 rounded flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
                  <div className="h-8 bg-gray-200 rounded mb-3 w-3/4"></div>
                  <div className="space-y-2 mb-4">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  </div>
                  <div className="h-10 bg-gray-200 rounded w-32"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
