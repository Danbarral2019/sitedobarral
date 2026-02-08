'use client';

import {
  ChevronDown,
  ChevronRight,
  FileText,
  Scale,
  BookOpen,
  Video,
  Globe,
  Loader2,
  FolderOpen,
  Gavel,
} from 'lucide-react';
import type { ContentTreeNode, ContentType, TreeSelection } from '@/lib/types/global-search';
import { CONTENT_TYPE_CONFIG } from '@/lib/types/global-search';

interface ContentTreeProps {
  tree: ContentTreeNode[];
  isLoading: boolean;
  error: string | null;
  selection: TreeSelection | null;
  onSelectNode: (node: ContentTreeNode) => void;
  expandedNodes: Set<string>;
  onToggleNode: (nodeId: string) => void;
}

const TYPE_ICONS: Record<ContentType, typeof FileText> = {
  document: FileText,
  'course-material': BookOpen,
  lei: Scale,
  glossary: BookOpen,
  video: Video,
  site: Globe,
  'legislative-act': Gavel,
};

function TreeNodeComponent({
  node,
  level = 0,
  selection,
  onSelectNode,
  expandedNodes,
  onToggleNode,
}: {
  node: ContentTreeNode;
  level?: number;
  selection: TreeSelection | null;
  onSelectNode: (node: ContentTreeNode) => void;
  expandedNodes: Set<string>;
  onToggleNode: (nodeId: string) => void;
}) {
  const config = CONTENT_TYPE_CONFIG[node.type];
  const Icon = TYPE_ICONS[node.type] || FileText;
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected =
    selection?.type === node.type &&
    selection?.courseId === node.courseId &&
    selection?.category === node.category;

  const handleClick = () => {
    if (hasChildren) {
      onToggleNode(node.id);
    }
    onSelectNode(node);
  };

  const paddingLeft = level * 12 + 12;

  return (
    <div>
      <button
        onClick={handleClick}
        style={{ paddingLeft }}
        className={`w-full flex items-center gap-2 py-2 pr-3 rounded-lg transition-colors text-left group ${
          isSelected
            ? `${config.bgColor} ${config.color}`
            : 'hover:bg-gray-50 text-gray-700'
        }`}
      >
        {/* Expand/Collapse Icon */}
        {hasChildren ? (
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </span>
        ) : (
          <span className="w-4" />
        )}

        {/* Icon */}
        {level === 0 ? (
          <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? config.color : 'text-gray-400'}`} />
        ) : level === 1 ? (
          <FolderOpen
            className={`w-4 h-4 flex-shrink-0 ${isSelected ? config.color : 'text-gray-400'}`}
          />
        ) : null}

        {/* Label */}
        <span
          className={`flex-1 text-sm truncate ${
            isSelected ? 'font-semibold' : 'font-medium'
          } ${level > 0 ? 'text-gray-600' : ''}`}
        >
          {node.label}
        </span>

        {/* Count Badge */}
        <span
          className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
            isSelected
              ? 'bg-white/60 text-gray-700'
              : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
          }`}
        >
          {node.count}
        </span>
      </button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              selection={selection}
              onSelectNode={onSelectNode}
              expandedNodes={expandedNodes}
              onToggleNode={onToggleNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ContentTree({
  tree,
  isLoading,
  error,
  selection,
  onSelectNode,
  expandedNodes,
  onToggleNode,
}: ContentTreeProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6">
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-bold text-gray-900 text-sm">Navegar por Tipo</h3>
        <p className="text-xs text-gray-500 mt-0.5">Explore o acervo completo</p>
      </div>

      {/* Tree */}
      <div className="p-2 max-h-[calc(100vh-300px)] overflow-y-auto">
        {tree.map((node) => (
          <TreeNodeComponent
            key={node.id}
            node={node}
            selection={selection}
            onSelectNode={onSelectNode}
            expandedNodes={expandedNodes}
            onToggleNode={onToggleNode}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <span className="font-medium text-gray-700">Dica:</span>
          Clique nos itens para navegar
        </p>
      </div>
    </div>
  );
}
