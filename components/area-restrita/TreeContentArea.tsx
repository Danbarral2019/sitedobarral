/** @deprecated Replaced by DashboardCourseCard, KnowledgeBaseSection, LeiQuickAccess + inline views (2026-02-18) */
'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DocumentsByCategory from '@/components/DocumentsByCategory';
import CourseArea from '@/components/area-restrita/CourseArea';
import NovidadesSection from '@/components/area-restrita/NovidadesSection';
import OnboardingGuide from '@/components/area-restrita/OnboardingGuide';
import CourseVideos from '@/components/CourseVideos';
import RecommendedSites from '@/components/RecommendedSites';
import { ArticleTreeNavigator } from '@/components/ArticleTreeNavigator';
import LegislativeActsPanel from '@/components/LegislativeActsPanel';
import { GlossaryPanel } from '@/components/glossary/GlossaryPanel';
import { LeiHighlightCard } from './LeiHighlightCard';
import { KnowledgeBaseGrid } from './KnowledgeBaseGrid';

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

interface ContentSelection {
  type?: string;
  courseId?: string;
  category?: string;
}

interface CurrentContent {
  type: string;
  documents: DocumentType[];
  videos: VideoType[];
  sites: SiteType[];
  title: string;
}

interface TreeContentAreaProps {
  currentContent: CurrentContent;
  selection: ContentSelection | null;
  isDataLoading: boolean;
  courseDocuments: Record<string, DocumentType[]>;
  enrolledCourseIds: string[];
  modulesData: Record<string, { moduleCount: number; lessonCount: number }>;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (docId: string, courseId: string) => void;
  onDocumentClick: (doc: DocumentType) => void;
  onNovidadeClick: (docId: string) => void;
  onSelectCategory: (category: string) => void;
  onExploreTemas: () => void;
}

export function TreeContentArea({
  currentContent,
  selection,
  isDataLoading,
  courseDocuments,
  enrolledCourseIds,
  modulesData,
  isFavorite,
  toggleFavorite,
  onDocumentClick,
  onNovidadeClick,
  onSelectCategory,
  onExploreTemas,
}: TreeContentAreaProps) {
  const router = useRouter();

  return (
    <div>
      {/* Section Title */}
      {currentContent.title && (
        <div className="mb-4">
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900">
            {currentContent.title}
          </h2>
        </div>
      )}

      {/* Content Based on Selection */}
      {isDataLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <>
          {/* Onboarding Guide (first visit only) */}
          {currentContent.type === 'documents' && !selection && (
            <OnboardingGuide />
          )}

          {/* Lei 14.133 Highlight Card (home/no selection) */}
          {currentContent.type === 'documents' && !selection && (
            <LeiHighlightCard onExploreTemas={onExploreTemas} />
          )}

          {/* Novidades Section (home/no selection) */}
          {currentContent.type === 'documents' && !selection && (
            <NovidadesSection onDocumentClick={onNovidadeClick} />
          )}

          {/* Course Area Highlight (home/no selection) */}
          {currentContent.type === 'documents' && !selection && (
            <CourseArea
              documents={courseDocuments}
              enrolledCourseIds={enrolledCourseIds}
              onDocumentClick={onDocumentClick}
              modulesData={modulesData}
            />
          )}

          {/* Documents - category grid when no subcategory selected */}
          {currentContent.type === 'documents' && selection && !selection.category && (
            <KnowledgeBaseGrid
              documents={Object.values(courseDocuments).flat()}
              onSelectCategory={onSelectCategory}
            />
          )}

          {/* Documents - filtered list when subcategory selected */}
          {currentContent.type === 'documents' && currentContent.documents.length > 0 && selection && selection.category && (
            <DocumentsByCategory
              documents={currentContent.documents}
              courseId={selection?.courseId || enrolledCourseIds[0] || ''}
              onDocumentClick={onDocumentClick}
              isFavorite={isFavorite}
              toggleFavorite={(docId) => toggleFavorite(docId, selection?.courseId || enrolledCourseIds[0] || '')}
            />
          )}

          {/* Course Materials - category selected: show filtered list */}
          {currentContent.type === 'course-material' && selection?.category && currentContent.documents.length > 0 && (
            <DocumentsByCategory
              documents={currentContent.documents}
              courseId={selection?.courseId || enrolledCourseIds[0] || ''}
              onDocumentClick={onDocumentClick}
              isFavorite={isFavorite}
              toggleFavorite={(docId) => toggleFavorite(docId, selection?.courseId || enrolledCourseIds[0] || '')}
            />
          )}

          {/* Course Materials - no category: show full CourseArea */}
          {currentContent.type === 'course-material' && !selection?.category && currentContent.documents.length > 0 && (
            <CourseArea
              documents={courseDocuments}
              enrolledCourseIds={enrolledCourseIds}
              onDocumentClick={onDocumentClick}
              modulesData={modulesData}
            />
          )}

          {currentContent.type === 'course-material' && currentContent.documents.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
              <p className="text-gray-500">Nenhum material do curso disponível.</p>
            </div>
          )}

          {/* Lei 14.133 */}
          {currentContent.type === 'lei' && (
            <ArticleTreeNavigator
              basePath="/area-restrita/artigo"
              onArticleClick={(articleNum) => router.push(`/area-restrita/artigo/${articleNum}`)}
            />
          )}

          {/* Atos Normativos Infralegais */}
          {currentContent.type === 'legislative-act' && (
            <LegislativeActsPanel />
          )}

          {/* Glossário Inline */}
          {currentContent.type === 'glossary' && (
            <GlossaryPanel articleBasePath="/area-restrita/artigo" />
          )}

          {/* Videos */}
          {currentContent.type === 'videos' && currentContent.videos.length > 0 && (
            <CourseVideos videos={currentContent.videos} displayMode="thumbnails" />
          )}

          {/* Sites */}
          {currentContent.type === 'sites' && currentContent.sites.length > 0 && (
            <RecommendedSites sites={currentContent.sites} />
          )}

          {/* Empty States */}
          {currentContent.type === 'documents' && currentContent.documents.length === 0 && selection && selection.category && (
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
              <p className="text-gray-500">Nenhum documento encontrado nesta categoria.</p>
            </div>
          )}

          {currentContent.type === 'videos' && currentContent.videos.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
              <p className="text-gray-500">Nenhum vídeo disponível.</p>
            </div>
          )}

          {currentContent.type === 'sites' && currentContent.sites.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
              <p className="text-gray-500">Nenhum site recomendado.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
