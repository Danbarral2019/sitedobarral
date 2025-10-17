'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] rounded ${className}`}
      style={{
        animation: 'skeleton-loading 1.5s ease-in-out infinite',
      }}
    />
  );
}

export function DocumentCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-1/2 mb-1" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Skeleton className="h-3 w-12 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div>
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div>
          <Skeleton className="h-3 w-14 mb-1" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

export function QRCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <Skeleton className="h-5 w-2/3 mb-2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-3 w-full" />
        </div>
        <div>
          <Skeleton className="h-3 w-12 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div>
          <Skeleton className="h-3 w-20 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div>
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

// Adicionar a animação ao CSS global (ou via Tailwind config)
