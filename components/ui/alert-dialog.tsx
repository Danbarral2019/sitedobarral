'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { AlertTriangle } from 'lucide-react';

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  variant = 'danger',
  isLoading = false,
}: AlertDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  const variantStyles = {
    danger: 'from-red-600 to-red-700 hover:from-red-700 hover:to-red-800',
    warning: 'from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800',
    info: 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              variant === 'danger' ? 'bg-red-100' :
              variant === 'warning' ? 'bg-yellow-100' :
              'bg-blue-100'
            }`}>
              <AlertTriangle className={`w-6 h-6 ${
                variant === 'danger' ? 'text-red-600' :
                variant === 'warning' ? 'text-amber-accent-deep' :
                'text-blue-600'
              }`} />
            </div>
            <DialogTitle className="text-xl">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 bg-gradient-to-r text-surface-page rounded-lg font-bold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]}`}
          >
            {isLoading ? 'Processando...' : confirmText}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
