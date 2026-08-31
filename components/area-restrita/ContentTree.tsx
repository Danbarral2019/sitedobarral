/** @deprecated Replaced by QuickAccessBar + inline views in page.tsx (2026-02-18) */
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
 HelpCircle,
 Newspaper,
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
 faq: HelpCircle,
 blog: Newspaper,
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
 const config = CONTENT_TYPE_CONFIG[node.type] || CONTENT_TYPE_CONFIG['document'];
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
 <div role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={isSelected}>
 <button
 onClick={handleClick}
 style={{ paddingLeft }}
 className={`w-full flex items-center gap-2 py-2 pr-3 rounded-[3px] transition-colors text-left group ${
 isSelected
 ? `${config.bgColor} ${config.color}`
 : 'hover:bg-surface-raised text-ink-secondary'
 }`}
 >
 {/* Expand/Collapse Icon */}
 {hasChildren ? (
 <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
 {isExpanded ? (
 <ChevronDown className="w-4 h-4 text-ink-muted" />
 ) : (
 <ChevronRight className="w-4 h-4 text-ink-muted" />
 )}
 </span>
 ) : (
 <span className="w-4" />
 )}

 {/* Icon */}
 {level === 0 ? (
 <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? config.color : 'text-ink-muted'}`} />
 ) : level === 1 ? (
 <FolderOpen
 className={`w-4 h-4 flex-shrink-0 ${isSelected ? config.color : 'text-ink-muted'}`}
 />
 ) : null}

 {/* Label */}
 <span
 className={`flex-1 text-sm truncate ${
 isSelected ? 'font-semibold' : 'font-medium'
 } ${level > 0 ? 'text-ink-secondary' : ''}`}
 >
 {node.label}
 </span>

 {/* Count Badge */}
 <span
 className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
 isSelected
 ? 'bg-surface-page/60 text-ink-secondary'
 : 'bg-surface-deep text-ink-secondary group-hover:bg-surface-deep'
 }`}
 >
 {node.count}
 </span>
 </button>

 {/* Children */}
 {hasChildren && isExpanded && (
 <div role="group">
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
 <div className="bg-surface-page rounded-md border border-border-subtle p-6">
 <div className="flex items-center justify-center gap-2 text-ink-muted">
 <Loader2 className="w-5 h-5 animate-spin" />
 <span className="text-sm">Carregando...</span>
 </div>
 </div>
 );
 }

 if (error) {
 return (
 <div className="bg-surface-page rounded-md border border-border-subtle p-6">
 <p className="text-sm text-semantic-error">{error}</p>
 </div>
 );
 }

 return (
 <div className="bg-surface-page rounded-md border border-border-subtle">
 {/* Header */}
 <div className="px-4 py-3 border-b border-border-subtle">
 <h3 className="font-bold text-ink-primary text-sm">Navegar por Tipo</h3>
 <p className="text-xs text-ink-muted mt-0.5">Explore o acervo completo</p>
 </div>

 {/* Tree */}
 <div role="tree" aria-label="Navegar por tipo de conteúdo" className="p-2 max-h-[calc(100vh-300px)] overflow-y-auto">
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
 <div className="px-4 py-3 border-t border-border-subtle bg-surface-raised rounded-b-2xl">
 <p className="text-xs text-ink-muted flex items-center gap-1">
 <span className="font-medium text-ink-secondary">Dica:</span>
 Clique nos itens para navegar
 </p>
 </div>
 </div>
 );
}
