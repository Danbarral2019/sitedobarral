'use client';

import { Trophy } from 'lucide-react';
import { useBadgesAdmin } from '@/hooks/use-badges-admin';
import { BadgeCatalogGrid } from '@/components/admin/badges/BadgeCatalogGrid';
import { BadgeAwardForm } from '@/components/admin/badges/BadgeAwardForm';
import { BadgesAdminTable } from '@/components/admin/badges/BadgesAdminTable';

export default function BadgesAdminPage() {
  const a = useBadgesAdmin();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-amber-600" />
          Badges
        </h1>
        <p className="text-gray-600 mt-1">
          Catálogo, estatísticas e premiação manual de badges para gamificação dos cursos.
        </p>
      </header>

      <BadgeCatalogGrid
        catalog={a.stats?.catalog ?? []}
        total={a.stats?.total ?? 0}
        filterType={a.filterType}
        onFilter={a.setFilterType}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <BadgeAwardForm
            catalog={a.stats?.catalog ?? []}
            isSaving={a.isSaving}
            error={a.error}
            onSubmit={a.award}
          />
        </div>
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-gray-900">
              Histórico
              {a.filterType && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  filtrado por <code className="bg-gray-100 px-2 py-0.5 rounded">{a.filterType}</code>
                </span>
              )}
            </h2>
          </div>
          <BadgesAdminTable
            items={a.items}
            isLoading={a.isLoadingList}
            onRevoke={a.revoke}
          />
        </div>
      </div>
    </div>
  );
}
