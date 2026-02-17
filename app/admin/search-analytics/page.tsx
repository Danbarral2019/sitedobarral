'use client';

import dynamic from 'next/dynamic';
import AdminLayout from '@/components/AdminLayout';
import { Loader2 } from 'lucide-react';

const SearchAnalyticsClient = dynamic(() => import('./SearchAnalyticsClient'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
  ssr: false,
});

export default function SearchAnalyticsPage() {
  return (
    <AdminLayout>
      <SearchAnalyticsClient />
    </AdminLayout>
  );
}
