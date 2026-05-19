/**
 * Classifica um documento como complete/warning/critical conforme campos preenchidos.
 *
 * Reusa safeParseArray de lib/utils para lidar com tags/leiArticles
 * em formato JSON, CSV ou array nativo.
 */

import type { DocumentData } from '@/components/admin/DocumentCard';
import { safeParseArray } from '@/lib/utils';

export type DocCompletionStatus = 'complete' | 'warning' | 'critical';

export function getDocCompletionStatus(doc: DocumentData): DocCompletionStatus {
  if (!doc.title || !doc.category) return 'critical';

  if (doc.category === 'orientacao-normativa' && (!doc.onNumber || !doc.onYear)) {
    return 'critical';
  }

  if ((doc.category === 'enunciados' || doc.category === 'sumula') && !doc.entityType) {
    return 'critical';
  }

  const tags = safeParseArray(doc.tags);
  const articles = safeParseArray(doc.leiArticles);

  if (tags.length === 0 && articles.length === 0) return 'warning';
  if (!doc.description) return 'warning';

  return 'complete';
}
