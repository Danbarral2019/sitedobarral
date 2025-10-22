export default function CursosLoading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-12 text-center animate-pulse">
          <div className="h-12 bg-gray-200 rounded-lg w-96 mx-auto mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-2/3 mx-auto"></div>
        </div>

        {/* Courses Grid Skeleton */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden h-full">
                <div className="h-4 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                <div className="p-6">
                  <div className="h-6 bg-gray-200 rounded mb-3"></div>
                  <div className="space-y-2 mb-4">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-5 w-5 bg-gray-200 rounded-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                  </div>
                  <div className="h-10 bg-gray-200 rounded-lg"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
