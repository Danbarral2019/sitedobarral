'use client';

import React from 'react';

interface ProgressProps {
  value: number; // 0-100
  className?: string;
  showLabel?: boolean;
}

export function Progress({ value, className = '', showLabel = true }: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-1">
        {showLabel && (
          <span className="text-sm font-medium text-gray-700">
            {clampedValue < 100 ? 'Enviando...' : 'Concluído!'}
          </span>
        )}
        {showLabel && (
          <span className="text-sm font-bold text-blue-600">
            {Math.round(clampedValue)}%
          </span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-600 to-purple-600 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
