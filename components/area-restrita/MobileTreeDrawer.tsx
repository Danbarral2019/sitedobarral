'use client';

import { useEffect, useRef } from 'react';
import { X, ChevronDown, FolderTree } from 'lucide-react';
import { ContentTree } from './ContentTree';
import type { ContentTreeNode, TreeSelection } from '@/lib/types/global-search';

interface MobileTreeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tree: ContentTreeNode[];
  isLoading: boolean;
  error: string | null;
  selection: TreeSelection | null;
  onSelectNode: (node: ContentTreeNode) => void;
  expandedNodes: Set<string>;
  onToggleNode: (nodeId: string) => void;
}

export function MobileTreeDrawer({
  isOpen,
  onClose,
  tree,
  isLoading,
  error,
  selection,
  onSelectNode,
  expandedNodes,
  onToggleNode,
}: MobileTreeDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle node selection and close drawer
  const handleSelectNode = (node: ContentTreeNode) => {
    onSelectNode(node);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed inset-y-0 left-0 w-full max-w-sm bg-white shadow-2xl z-50 lg:hidden flex flex-col"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-brand-50 to-white">
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-brand-600" />
            <h2 className="font-bold text-gray-900">Navegar Conteúdo</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <ContentTree
            tree={tree}
            isLoading={isLoading}
            error={error}
            selection={selection}
            onSelectNode={handleSelectNode}
            expandedNodes={expandedNodes}
            onToggleNode={onToggleNode}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  );
}

// Trigger button component
export function MobileTreeTrigger({
  onClick,
  selectedLabel,
}: {
  onClick: () => void;
  selectedLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:border-brand-300 transition-colors"
    >
      <div className="flex items-center gap-2">
        <FolderTree className="w-5 h-5 text-brand-600" />
        <span className="font-medium text-gray-900">
          {selectedLabel || 'Navegar por Tipo'}
        </span>
      </div>
      <ChevronDown className="w-5 h-5 text-gray-400" />
    </button>
  );
}
