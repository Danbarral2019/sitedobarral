import { useMemo } from 'react';
import { courses } from '@/data/courses';

// Categorias que devem ser agrupadas sob "Pareceres"
const PARECER_CATEGORIES = ['parecer', 'parecer-vinculante', 'decor'];

// Mapeamento de categorias para nomes amigáveis
const CATEGORY_LABELS: Record<string, string> = {
  'pareceres': 'Pareceres',
  'orientacao-normativa': 'Orientações Normativas',
  'enunciados': 'Enunciados',
  'acordao': 'Acórdãos TCU',
  'sumula': 'Súmulas TCU',
  'consulta_tcu': 'Respostas a Consultas TCU',
  'informativo': 'Informativos de Licitação TCU',
  'manual-tcu': 'Manual do TCU',
  'boa_pratica': 'Outros Atos Normativos',
  'ato-normativo': 'Normativos',
  'outro': 'Outros',
};

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

interface DocumentType {
  id: string;
  title: string;
  description?: string;
  type: string;
  url?: string;
  category: string;
  uploadedAt?: string;
  tags?: string;
  courseId?: string;
  isCommon?: boolean;
  entityType?: string;
}

interface VideoType {
  id: string;
  title: string;
  description?: string | null;
  youtubeUrl: string;
  youtubeId: string;
  thumbnailUrl?: string | null;
}

interface SiteType {
  id: string;
  title: string;
  description: string;
  url: string;
  faviconUrl?: string | null;
  category?: string | null;
}

interface TreeSelection {
  type?: string;
  courseId?: string;
  category?: string;
}

export function useCurrentContent(
  selection: TreeSelection | null,
  courseDocuments: Record<string, DocumentType[]>,
  courseVideos: Record<string, VideoType[]>,
  courseSites: Record<string, SiteType[]>,
) {
  return useMemo(() => {
    if (!selection) {
      const allDocs = Object.values(courseDocuments).flat();
      return {
        type: 'documents' as const,
        documents: allDocs,
        videos: [] as VideoType[],
        sites: [] as SiteType[],
        title: 'Base de Conhecimento',
      };
    }

    const { type, courseId, category } = selection;

    switch (type) {
      case 'document': {
        let docs: DocumentType[] = [];
        let title = 'Base de Conhecimento';

        if (courseId) {
          docs = courseDocuments[courseId] || [];
          const course = courses.find((c) => c.id === courseId);
          title = course?.title || 'Curso';

          if (category) {
            if (category === 'pareceres') {
              docs = docs.filter((d) => PARECER_CATEGORIES.includes(d.category));
            } else {
              docs = docs.filter((d) => d.category === category);
            }
            title = `${getCategoryLabel(category)} - ${title}`;
          }
        } else {
          const seen = new Set<string>();
          docs = Object.values(courseDocuments).flat().filter((d) => {
            if (seen.has(d.id)) return false;
            seen.add(d.id);
            return true;
          });
          if (category) {
            if (category === 'pareceres') {
              docs = docs.filter((d) => PARECER_CATEGORIES.includes(d.category));
            } else {
              docs = docs.filter((d) => d.category === category);
            }
            title = getCategoryLabel(category);
          }
        }

        return { type: 'documents' as const, documents: docs, videos: [], sites: [], title };
      }

      case 'course-material': {
        let docs: DocumentType[] = [];
        let title = 'Materiais do Curso';

        if (courseId) {
          docs = courseDocuments[courseId] || [];
          const course = courses.find((c) => c.id === courseId);
          title = `Materiais - ${course?.title || 'Curso'}`;
          if (category) {
            docs = docs.filter((d) => d.category === category);
          }
        } else {
          docs = Object.values(courseDocuments).flat();
        }

        docs = docs.filter((d) =>
          ['apostila', 'conteudo-programatico', 'bibliografia', 'material-complementar'].includes(d.category)
        );

        return { type: 'course-material' as const, documents: docs, videos: [], sites: [], title };
      }

      case 'lei':
        return { type: 'lei' as const, documents: [], videos: [], sites: [], title: 'Lei 14.133/2021' };

      case 'legislative-act':
        return { type: 'legislative-act' as const, documents: [], videos: [], sites: [], title: 'Atos Normativos Infralegais' };

      case 'glossary':
        return { type: 'glossary' as const, documents: [], videos: [], sites: [], title: 'Glossário' };

      case 'video': {
        let videos: VideoType[] = [];
        let title = 'Vídeos';

        if (courseId) {
          videos = courseVideos[courseId] || [];
          const course = courses.find((c) => c.id === courseId);
          title = `Vídeos - ${course?.title || 'Curso'}`;
        } else {
          videos = Object.values(courseVideos).flat();
        }

        return { type: 'videos' as const, documents: [], videos, sites: [], title };
      }

      case 'site': {
        const allSites = Object.values(courseSites).flat();
        const uniqueSites = allSites.filter(
          (site, index, self) => index === self.findIndex((s) => s.id === site.id)
        );
        return { type: 'sites' as const, documents: [], videos: [], sites: uniqueSites, title: 'Sites Recomendados' };
      }

      default:
        return { type: 'documents' as const, documents: [], videos: [], sites: [], title: '' };
    }
  }, [selection, courseDocuments, courseVideos, courseSites]);
}
