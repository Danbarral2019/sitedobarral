-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- EnableExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "QRCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "qrCodeImage" TEXT,
    "courseId" TEXT NOT NULL,
    "turma" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QRCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alternativeUrls" TEXT,
    "category" TEXT NOT NULL,
    "courseId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isCommon" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    "leiArticlesArr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "leiArticlesCited" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "leiArticlesDebated" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tcuAnalise" JSONB,
    "tcuAnaliseTentativas" INTEGER NOT NULL DEFAULT 0,
    "precedentesVersao" INTEGER,
    "content" TEXT,
    "size" INTEGER,
    "onNumber" INTEGER,
    "onYear" INTEGER,
    "acordaoNumero" INTEGER,
    "acordaoAno" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "aiClassification" TEXT,
    "feedbackRelevance" TEXT,
    "feedbackReasoning" TEXT,
    "feedbackGivenAt" TIMESTAMP(3),
    "feedbackGivenBy" TEXT,
    "aiSuggestedArticles" TEXT,
    "summary" TEXT,
    "summaryHighlights" TEXT,
    "summaryGeneratedAt" TIMESTAMP(3),
    "summaryEditedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "summaryReviewedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "summaryReviewedAt" TIMESTAMP(3),
    "summaryReviewedBy" TEXT,
    "entityType" TEXT,
    "enunciadoNumber" TEXT,
    "issuerOrg" TEXT,
    "esfera" TEXT,
    "themes" TEXT,
    "douUrl" TEXT,
    "douData" TIMESTAMP(3),
    "douSecao" TEXT,
    "douPagina" TEXT,
    "douEdicao" TEXT,
    "adminNotes" TEXT,
    "publicNotes" TEXT,
    "notesImportance" TEXT,
    "notesRelatedDocs" TEXT,
    "notesPracticalUse" TEXT,
    "notesKeyPoints" TEXT,
    "notesUpdatedAt" TIMESTAMP(3),
    "notesUpdatedBy" TEXT,
    "tcuNumeroAcordao" TEXT,
    "tcuAutorTese" TEXT,
    "tcuArea" TEXT,
    "tcuTema" TEXT,
    "tcuSubtema" TEXT,
    "tcuLegislacao" TEXT,
    "tcuIndexadores" TEXT,
    "tcuTipoProcesso" TEXT,
    "tcuDataJulgamento" TIMESTAMP(3),
    "tcuLinkPDF" TEXT,
    "tcuEmentaCompleta" TEXT,
    "tcuTextoCompleto" TEXT,
    "tcuRelator" TEXT,
    "tcuOrgaoJulgador" TEXT,
    "tcuEnriquecidoEm" TIMESTAMP(3),
    "tcuEnriquecimentoStatus" TEXT,
    "tcuEnriquecimentoErro" TEXT,
    "tcuClassificadoEm" TIMESTAMP(3),
    "tcuRevisadoPorAdmin" BOOLEAN NOT NULL DEFAULT false,
    "leiIndexedAt" TIMESTAMP(3),
    "leiIndexerError" TEXT,
    "r2Key" TEXT,
    "r2UploadedAt" TIMESTAMP(3),
    "r2MigratedFrom" TEXT,
    "extractedText" TEXT,
    "textExtractedAt" TIMESTAMP(3),
    "embeddingStatus" TEXT DEFAULT 'pending',
    "embeddingError" TEXT,
    "chunkCount" INTEGER,
    "embeddedAt" TIMESTAMP(3),
    "search_vector" tsvector,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentMetaTcu" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "numeroAcordao" TEXT,
    "autorTese" TEXT,
    "area" TEXT,
    "tema" TEXT,
    "subtema" TEXT,
    "legislacao" TEXT,
    "indexadores" TEXT,
    "tipoProcesso" TEXT,
    "dataJulgamento" TIMESTAMP(3),
    "linkPDF" TEXT,
    "ementaCompleta" TEXT,
    "textoCompleto" TEXT,
    "relator" TEXT,
    "orgaoJulgador" TEXT,
    "enriquecidoEm" TIMESTAMP(3),
    "enriquecimentoStatus" TEXT,
    "enriquecimentoErro" TEXT,
    "classificadoEm" TIMESTAMP(3),
    "revisadoPorAdmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DocumentMetaTcu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentMetaDou" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "url" TEXT,
    "data" TIMESTAMP(3),
    "secao" TEXT,
    "pagina" TEXT,
    "edicao" TEXT,

    CONSTRAINT "DocumentMetaDou_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentNotes" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "adminNotes" TEXT,
    "publicNotes" TEXT,
    "importance" TEXT,
    "relatedDocs" TEXT,
    "practicalUse" TEXT,
    "keyPoints" TEXT,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" TEXT,

    CONSTRAINT "DocumentNotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "charStart" INTEGER NOT NULL,
    "charEnd" INTEGER NOT NULL,
    "embedding" vector(768) NOT NULL,
    "embedding1536" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "urlPDF" TEXT,
    "category" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "onNumber" INTEGER,
    "onYear" INTEGER,
    "alternativeUrls" TEXT,
    "changeType" TEXT NOT NULL,
    "changesSummary" TEXT,
    "changeDetails" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectedBy" TEXT,
    "isCurrentVersion" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verificationExpiry" TIMESTAMP(3),
    "resetPasswordToken" TEXT,
    "resetPasswordExpiry" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "lmsReminderSentAt" TIMESTAMP(3),
    "clippingOptOut" BOOLEAN NOT NULL DEFAULT false,
    "clippingOptOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "turma" TEXT,
    "qrCodeId" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isLifetime" BOOLEAN NOT NULL DEFAULT false,
    "lifetimeUpgradedAt" TIMESTAMP(3),
    "lifetimePrice" DOUBLE PRECISION,
    "notificationSentAt" TIMESTAMP(3),

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "qrCode" TEXT,
    "courseId" TEXT,
    "documentId" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "legislativeActId" TEXT,
    "courseId" TEXT,
    "annotation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    "leiArticlesArr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autoPublishSocial" BOOLEAN NOT NULL DEFAULT true,
    "socialMediaImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMediaPost" (
    "id" TEXT NOT NULL,
    "blogPostId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "postId" TEXT,
    "postUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialMediaPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT,
    "author" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publisher" TEXT,
    "isbn" TEXT,
    "coverImage" TEXT,
    "externalUrl" TEXT,
    "journal" TEXT,
    "eventDate" TIMESTAMP(3),
    "location" TEXT,
    "leiArticlesArr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactForm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "courseInterest" TEXT,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "interests" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),
    "source" TEXT,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "avatar" TEXT NOT NULL DEFAULT 'U',
    "color" TEXT NOT NULL DEFAULT 'from-blue-400 to-blue-600',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderatedBy" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "contactFormId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendedSite" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "faviconUrl" TEXT,
    "category" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "RecommendedSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteToCourse" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteToCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseVideo" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storageType" TEXT NOT NULL DEFAULT 'youtube',
    "youtubeUrl" TEXT,
    "youtubeId" TEXT,
    "r2Key" TEXT,
    "contentType" TEXT,
    "sizeBytes" TEXT,
    "durationSeconds" INTEGER,
    "thumbnailUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "CourseVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlossaryTerm" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "shortDef" TEXT,
    "category" TEXT,
    "relatedTerms" TEXT,
    "leiArticlesArr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedDocs" TEXT,
    "externalUrl" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "search_vector" tsvector,

    CONSTRAINT "GlossaryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegislativeAct" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "fullNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ementa" TEXT NOT NULL,
    "summary" TEXT,
    "issuer" TEXT NOT NULL,
    "publishDate" TIMESTAMP(3) NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "hierarchyLevel" INTEGER NOT NULL,
    "leiArticlesArr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "officialUrl" TEXT,
    "pdfUrl" TEXT,
    "content" TEXT,
    "annexesJson" TEXT,
    "esfera" TEXT NOT NULL DEFAULT 'federal',
    "themes" TEXT,
    "importance" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedNote" TEXT,
    "contentHash" TEXT,
    "lastScrapedAt" TIMESTAMP(3),
    "scrapeStatus" TEXT,
    "scrapeError" TEXT,
    "changeDetectedAt" TIMESTAMP(3),
    "notifyOnChange" BOOLEAN NOT NULL DEFAULT true,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "embeddingStatus" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "embeddedAt" TIMESTAMP(3),
    "search_vector" tsvector,

    CONSTRAINT "LegislativeAct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegislativeActChunk" (
    "id" TEXT NOT NULL,
    "legislativeActId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "charStart" INTEGER NOT NULL,
    "charEnd" INTEGER NOT NULL,
    "embedding" vector(768) NOT NULL,
    "embedding1536" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegislativeActChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FAQ" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "relatedFAQs" TEXT,
    "relatedDocs" TEXT,
    "keywords" TEXT,
    "search_vector" tsvector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "FAQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FAQFeedback" (
    "id" TEXT NOT NULL,
    "faqId" TEXT NOT NULL,
    "wasHelpful" BOOLEAN NOT NULL,
    "comment" TEXT,
    "userEmail" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FAQFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleQuestion" (
    "id" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "contextDocIds" TEXT,
    "answer" TEXT,
    "aiProvider" TEXT,
    "geminiModel" TEXT,
    "geminiTokens" INTEGER,
    "geminiLatency" INTEGER,
    "geminiCached" BOOLEAN,
    "conversationId" TEXT,
    "wasHelpful" BOOLEAN,
    "feedbackComment" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "ip" TEXT,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ArticleQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DOUStagingDocument" (
    "id" TEXT NOT NULL,
    "douId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "publishDate" TEXT NOT NULL,
    "hierarchyStr" TEXT,
    "fullContent" TEXT,
    "edition" TEXT,
    "page" TEXT,
    "organ" TEXT,
    "category" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reasoning" TEXT NOT NULL,
    "isRelevant" BOOLEAN NOT NULL,
    "requiresReview" BOOLEAN NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "finalDecision" TEXT,
    "classificationCorrect" BOOLEAN,
    "correctedCategory" TEXT,
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "importedAt" TIMESTAMP(3),
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editorialScore" INTEGER,
    "editorialReason" TEXT,
    "editorialSummary" TEXT,
    "editorialAffects" TEXT,
    "editorialActType" TEXT,
    "editorialAmbiguous" BOOLEAN NOT NULL DEFAULT false,
    "editorialModel" TEXT,
    "editorialPromptVer" TEXT,
    "editorialClassifiedAt" TIMESTAMP(3),
    "source" TEXT DEFAULT 'cron',

    CONSTRAINT "DOUStagingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DOUSavedFilter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filterConfig" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DOUSavedFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeiArticle" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titulo" TEXT,
    "capituloCompleto" TEXT,
    "ementa" TEXT NOT NULL,
    "capitulo" TEXT NOT NULL,
    "secao" TEXT,
    "professorComment" TEXT,
    "commentUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeiArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'documents',
    "query" TEXT NOT NULL,
    "filters" TEXT,
    "aiAnswer" TEXT,
    "sources" TEXT,
    "legalSources" TEXT,
    "feedback" INTEGER,
    "feedbackNote" TEXT,
    "feedbackAt" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "shareId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexJob" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "r2Key" TEXT,
    "textContent" TEXT,
    "metadata" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),

    CONSTRAINT "IndexJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseStatus" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspensionReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "plannedReturn" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "estimatedMinutes" INTEGER,
    "requiresQuizPass" BOOLEAN NOT NULL DEFAULT false,
    "prerequisiteId" TEXT,
    "aiSummary" TEXT,
    "aiKeyPoints" TEXT,
    "leiArticlesArr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonDocument" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonVideo" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "courseVideoId" TEXT,
    "title" TEXT NOT NULL,
    "youtubeUrl" TEXT,
    "youtubeId" TEXT,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "contentRead" BOOLEAN NOT NULL DEFAULT false,
    "videosWatched" TEXT,
    "documentsViewed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "passingScore" INTEGER NOT NULL DEFAULT 60,
    "maxAttempts" INTEGER,
    "timeLimitMinutes" INTEGER,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "explanation" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "totalPoints" INTEGER NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "timeSpentSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "estimatedHours" INTEGER,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "issueReason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewAt" TIMESTAMP(3),

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "type" TEXT NOT NULL,
    "metadata" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStreak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" TEXT,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "showOnLeaderboard" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TcuHighlight" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "keywordScore" INTEGER NOT NULL,
    "aiArticleWorthiness" INTEGER NOT NULL,
    "aiThesisSummary" TEXT NOT NULL,
    "aiWhyImportant" TEXT NOT NULL,
    "aiArticleAngle" TEXT NOT NULL,
    "aiLeiConnections" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNotes" TEXT,
    "blogPostId" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TcuHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcordaoCitacao" (
    "id" TEXT NOT NULL,
    "origemId" TEXT NOT NULL,
    "numeroAlvo" INTEGER NOT NULL,
    "anoAlvo" INTEGER NOT NULL,
    "colegiadoAlvo" TEXT,
    "noVoto" BOOLEAN NOT NULL DEFAULT false,
    "ocorrencias" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcordaoCitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripePriceId" TEXT,
    "paymentMethod" TEXT,
    "plan" TEXT NOT NULL,
    "billingCycle" TEXT,
    "courseId" TEXT,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeiArticleEmbedding" (
    "id" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeiArticleEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeiArticleNote" (
    "id" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceDocId" TEXT,
    "sourceLegActId" TEXT,
    "detectedBy" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "adminReviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeiArticleNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyClippingSend" (
    "id" TEXT NOT NULL,
    "sentDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "totalSkipped" INTEGER NOT NULL DEFAULT 0,
    "acordaoCount" INTEGER NOT NULL DEFAULT 0,
    "acordaoIdsIncluded" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "DailyClippingSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClippingItemExtract" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "dispositivos" TEXT,
    "extractMethod" TEXT NOT NULL,
    "pdfFetchFailed" BOOLEAN NOT NULL DEFAULT false,
    "aiBullets" TEXT,
    "aiGeneratedAt" TIMESTAMP(3),
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClippingItemExtract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSend" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "opens" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TribunalDecision" (
    "id" TEXT NOT NULL,
    "tribunalCode" TEXT NOT NULL,
    "tribunalName" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "decisionNumber" TEXT NOT NULL,
    "processNumber" TEXT,
    "year" INTEGER NOT NULL,
    "fullIdentifier" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ementa" TEXT NOT NULL,
    "fullText" TEXT,
    "summary" TEXT,
    "relator" TEXT,
    "orgaoJulgador" TEXT,
    "dataJulgamento" TIMESTAMP(3),
    "dataPublicacao" TIMESTAMP(3),
    "url" TEXT,
    "pdfUrl" TEXT,
    "isRelevant" BOOLEAN NOT NULL DEFAULT true,
    "relevanceScore" INTEGER NOT NULL DEFAULT 0,
    "themes" TEXT,
    "leiArticlesArr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestedCourses" TEXT,
    "sourceApi" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceRawData" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "classificationReasoning" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "embeddingStatus" TEXT DEFAULT 'pending',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "embeddedAt" TIMESTAMP(3),
    "aiBullets" TEXT,
    "aiGeneratedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scrapeError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "TribunalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TribunalHighlight" (
    "id" TEXT NOT NULL,
    "tribunalDecisionId" TEXT NOT NULL,
    "keywordScore" INTEGER NOT NULL,
    "aiArticleWorthiness" INTEGER NOT NULL,
    "aiThesisSummary" TEXT NOT NULL,
    "aiWhyImportant" TEXT NOT NULL,
    "aiArticleAngle" TEXT NOT NULL,
    "aiLeiConnections" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNotes" TEXT,
    "blogPostId" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TribunalHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TribunalDecisionChunk" (
    "id" TEXT NOT NULL,
    "tribunalDecisionId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "charStart" INTEGER NOT NULL,
    "charEnd" INTEGER NOT NULL,
    "embedding" vector(768) NOT NULL,
    "embedding1536" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TribunalDecisionChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperHealthLog" (
    "id" TEXT NOT NULL,
    "scraperCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsNew" INTEGER NOT NULL DEFAULT 0,
    "itemsError" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "metadata" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScraperHealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("stripeEventId")
);

-- CreateTable
CREATE TABLE "PlanningSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "natureza" TEXT,
    "trailTemplateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ONBOARDING',
    "learningMode" BOOLEAN NOT NULL DEFAULT true,
    "descricaoLivre" TEXT,
    "classificacaoJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PlanningSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningDocument" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentVersionId" TEXT,
    "decisionRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningDocumentSection" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "discretionary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "contentMd" TEXT,
    "didacticCacheJson" TEXT,
    "generationProvenance" TEXT,
    "sourcesJson" TEXT,
    "justificationSkipped" TEXT,
    "sufficiencyScore" DOUBLE PRECISION,
    "conceptualCheckPassed" BOOLEAN,
    "conceptualCheckAnswerMd" TEXT,
    "conceptualCheckAnsweredAt" TIMESTAMP(3),
    "derivedFromSectionId" TEXT,
    "lastEditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningDocumentSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "diffJson" TEXT,
    "authorKind" TEXT NOT NULL,
    "authorId" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningLibrarySnippet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpoMd" TEXT NOT NULL,
    "tagsJson" TEXT,
    "sourceSectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningLibrarySnippet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningTrailTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "natureza" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "definitionJsonCache" TEXT NOT NULL,
    "changelogMd" TEXT,
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningTrailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningSectionTemplate" (
    "id" TEXT NOT NULL,
    "trailTemplateId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "promptTemplateMd" TEXT,
    "ragFilterJson" TEXT,
    "placeholderTextMd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningSectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningDecisionRun" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "matrixSlug" TEXT NOT NULL,
    "matrixVersion" INTEGER NOT NULL,
    "inputsJson" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningDecisionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningExport" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegislativeActRelation" (
    "id" TEXT NOT NULL,
    "sourceActId" TEXT NOT NULL,
    "targetActId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "excerpt" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "LegislativeActRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeiArticleCrossRef" (
    "id" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "targetNumber" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeiArticleCrossRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeiArticleSuggestedReading" (
    "id" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "internalType" TEXT,
    "internalId" TEXT,
    "externalUrl" TEXT,
    "externalType" TEXT,
    "title" TEXT,
    "description" TEXT,
    "author" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeiArticleSuggestedReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackfillCursor" (
    "id" TEXT NOT NULL,
    "offset" INTEGER NOT NULL DEFAULT 0,
    "ultimoAcordao" TEXT,
    "ultimaData" TEXT,
    "totalInserido" INTEGER NOT NULL DEFAULT 0,
    "totalIgnorado" INTEGER NOT NULL DEFAULT 0,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackfillCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeseDestilacao" (
    "id" TEXT NOT NULL,
    "numeroAlvo" INTEGER NOT NULL,
    "anoAlvo" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "confianca" TEXT NOT NULL,
    "versaoMotor" INTEGER NOT NULL,
    "dossieTrechos" INTEGER NOT NULL,
    "dossieNoVoto" INTEGER NOT NULL,
    "sinais" JSONB,
    "atual" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeseDestilacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeseEnunciado" (
    "id" TEXT NOT NULL,
    "destilacaoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "enunciado" TEXT NOT NULL,
    "inovacao" TEXT NOT NULL,
    "trechosFonte" JSONB NOT NULL,
    "veredito" TEXT,
    "julgadoEm" TIMESTAMP(3),
    "julgadoPor" TEXT,
    "herdadoDe" TEXT,

    CONSTRAINT "TeseEnunciado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeseDivergencia" (
    "id" TEXT NOT NULL,
    "destilacaoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "origemChave" TEXT NOT NULL,
    "precedenteApontado" TEXT NOT NULL,
    "trecho" TEXT NOT NULL,
    "natureza" TEXT NOT NULL,
    "veredito" TEXT,
    "julgadoEm" TIMESTAMP(3),
    "julgadoPor" TEXT,
    "herdadoDe" TEXT,

    CONSTRAINT "TeseDivergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcordaoTema" (
    "id" TEXT NOT NULL,
    "numeroAlvo" INTEGER NOT NULL,
    "anoAlvo" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "subtema" TEXT NOT NULL,
    "fronteirico" BOOLEAN NOT NULL DEFAULT false,
    "fonte" TEXT NOT NULL,
    "insumo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcordaoTema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QRCode_code_key" ON "QRCode"("code");

-- CreateIndex
CREATE INDEX "QRCode_courseId_idx" ON "QRCode"("courseId");

-- CreateIndex
CREATE INDEX "QRCode_validUntil_idx" ON "QRCode"("validUntil");

-- CreateIndex
CREATE INDEX "QRCode_courseId_turma_idx" ON "QRCode"("courseId", "turma");

-- CreateIndex
CREATE INDEX "Document_courseId_idx" ON "Document"("courseId");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE INDEX "Document_courseId_isPublic_idx" ON "Document"("courseId", "isPublic");

-- CreateIndex
CREATE INDEX "Document_uploadedAt_idx" ON "Document"("uploadedAt");

-- CreateIndex
CREATE INDEX "Document_notifiedAt_idx" ON "Document"("notifiedAt");

-- CreateIndex
CREATE INDEX "Document_courseId_notifiedAt_idx" ON "Document"("courseId", "notifiedAt");

-- CreateIndex
CREATE INDEX "Document_isCommon_idx" ON "Document"("isCommon");

-- CreateIndex
CREATE INDEX "Document_isCommon_isPublic_idx" ON "Document"("isCommon", "isPublic");

-- CreateIndex
CREATE INDEX "Document_category_onNumber_onYear_idx" ON "Document"("category", "onNumber", "onYear");

-- CreateIndex
CREATE INDEX "Document_category_acordaoNumero_acordaoAno_idx" ON "Document"("category", "acordaoNumero", "acordaoAno");

-- CreateIndex
CREATE INDEX "Document_reviewed_idx" ON "Document"("reviewed");

-- CreateIndex
CREATE INDEX "Document_reviewed_uploadedAt_idx" ON "Document"("reviewed", "uploadedAt");

-- CreateIndex
CREATE INDEX "Document_feedbackRelevance_idx" ON "Document"("feedbackRelevance");

-- CreateIndex
CREATE INDEX "Document_summary_idx" ON "Document"("summary");

-- CreateIndex
CREATE INDEX "Document_summaryGeneratedAt_idx" ON "Document"("summaryGeneratedAt");

-- CreateIndex
CREATE INDEX "Document_entityType_idx" ON "Document"("entityType");

-- CreateIndex
CREATE INDEX "Document_category_entityType_idx" ON "Document"("category", "entityType");

-- CreateIndex
CREATE INDEX "Document_title_idx" ON "Document"("title");

-- CreateIndex
CREATE INDEX "Document_category_title_idx" ON "Document"("category", "title");

-- CreateIndex
CREATE INDEX "Document_notesImportance_idx" ON "Document"("notesImportance");

-- CreateIndex
CREATE INDEX "Document_tcuNumeroAcordao_idx" ON "Document"("tcuNumeroAcordao");

-- CreateIndex
CREATE INDEX "Document_tcuAutorTese_idx" ON "Document"("tcuAutorTese");

-- CreateIndex
CREATE INDEX "Document_tcuArea_tcuTema_idx" ON "Document"("tcuArea", "tcuTema");

-- CreateIndex
CREATE INDEX "Document_tcuEnriquecimentoStatus_idx" ON "Document"("tcuEnriquecimentoStatus");

-- CreateIndex
CREATE INDEX "Document_tcuRevisadoPorAdmin_idx" ON "Document"("tcuRevisadoPorAdmin");

-- CreateIndex
CREATE INDEX "Document_douData_idx" ON "Document"("douData");

-- CreateIndex
CREATE INDEX "Document_douSecao_idx" ON "Document"("douSecao");

-- CreateIndex
CREATE INDEX "Document_category_douData_idx" ON "Document"("category", "douData");

-- CreateIndex
CREATE INDEX "Document_r2Key_idx" ON "Document"("r2Key");

-- CreateIndex
CREATE INDEX "Document_embeddingStatus_idx" ON "Document"("embeddingStatus");

-- CreateIndex
CREATE INDEX "Document_leiArticlesArr_idx" ON "Document" USING GIN ("leiArticlesArr");

-- CreateIndex
CREATE INDEX "Document_leiArticlesCited_idx" ON "Document" USING GIN ("leiArticlesCited");

-- CreateIndex
CREATE INDEX "Document_leiArticlesDebated_idx" ON "Document" USING GIN ("leiArticlesDebated");

-- CreateIndex
CREATE UNIQUE INDEX "Document_acordaoNumero_acordaoAno_tcuOrgaoJulgador_key" ON "Document"("acordaoNumero", "acordaoAno", "tcuOrgaoJulgador");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentMetaTcu_documentId_key" ON "DocumentMetaTcu"("documentId");

-- CreateIndex
CREATE INDEX "DocumentMetaTcu_numeroAcordao_idx" ON "DocumentMetaTcu"("numeroAcordao");

-- CreateIndex
CREATE INDEX "DocumentMetaTcu_autorTese_idx" ON "DocumentMetaTcu"("autorTese");

-- CreateIndex
CREATE INDEX "DocumentMetaTcu_area_tema_idx" ON "DocumentMetaTcu"("area", "tema");

-- CreateIndex
CREATE INDEX "DocumentMetaTcu_enriquecimentoStatus_idx" ON "DocumentMetaTcu"("enriquecimentoStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentMetaDou_documentId_key" ON "DocumentMetaDou"("documentId");

-- CreateIndex
CREATE INDEX "DocumentMetaDou_data_idx" ON "DocumentMetaDou"("data");

-- CreateIndex
CREATE INDEX "DocumentMetaDou_secao_idx" ON "DocumentMetaDou"("secao");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentNotes_documentId_key" ON "DocumentNotes"("documentId");

-- CreateIndex
CREATE INDEX "DocumentNotes_importance_idx" ON "DocumentNotes"("importance");

-- CreateIndex
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_versionNumber_idx" ON "DocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "DocumentVersion_detectedAt_idx" ON "DocumentVersion"("detectedAt");

-- CreateIndex
CREATE INDEX "DocumentVersion_isCurrentVersion_idx" ON "DocumentVersion"("isCurrentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetPasswordToken_key" ON "User"("resetPasswordToken");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_email_role_idx" ON "User"("email", "role");

-- CreateIndex
CREATE INDEX "User_emailVerified_idx" ON "User"("emailVerified");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_idx" ON "Enrollment"("courseId");

-- CreateIndex
CREATE INDEX "Enrollment_userId_courseId_isLifetime_idx" ON "Enrollment"("userId", "courseId", "isLifetime");

-- CreateIndex
CREATE INDEX "Enrollment_expiresAt_isLifetime_idx" ON "Enrollment"("expiresAt", "isLifetime");

-- CreateIndex
CREATE INDEX "Enrollment_expiresAt_isLifetime_notificationSentAt_idx" ON "Enrollment"("expiresAt", "isLifetime", "notificationSentAt");

-- CreateIndex
CREATE INDEX "Enrollment_isLifetime_idx" ON "Enrollment"("isLifetime");

-- CreateIndex
CREATE INDEX "Enrollment_enrolledAt_idx" ON "Enrollment"("enrolledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_courseId_key" ON "Enrollment"("userId", "courseId");

-- CreateIndex
CREATE INDEX "AccessLog_userId_idx" ON "AccessLog"("userId");

-- CreateIndex
CREATE INDEX "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_userId_action_idx" ON "AccessLog"("userId", "action");

-- CreateIndex
CREATE INDEX "AccessLog_courseId_createdAt_idx" ON "AccessLog"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_documentId_idx" ON "AccessLog"("documentId");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE INDEX "Favorite_courseId_idx" ON "Favorite"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_documentId_key" ON "Favorite"("userId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_legislativeActId_key" ON "Favorite"("userId", "legislativeActId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_slug_idx" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_isPublished_idx" ON "BlogPost"("isPublished");

-- CreateIndex
CREATE INDEX "BlogPost_publishedAt_idx" ON "BlogPost"("publishedAt");

-- CreateIndex
CREATE INDEX "BlogPost_leiArticlesArr_idx" ON "BlogPost" USING GIN ("leiArticlesArr");

-- CreateIndex
CREATE INDEX "SocialMediaPost_blogPostId_idx" ON "SocialMediaPost"("blogPostId");

-- CreateIndex
CREATE INDEX "SocialMediaPost_platform_idx" ON "SocialMediaPost"("platform");

-- CreateIndex
CREATE INDEX "SocialMediaPost_status_idx" ON "SocialMediaPost"("status");

-- CreateIndex
CREATE INDEX "SocialMediaPost_publishedAt_idx" ON "SocialMediaPost"("publishedAt");

-- CreateIndex
CREATE INDEX "Publication_type_idx" ON "Publication"("type");

-- CreateIndex
CREATE INDEX "Publication_isPublished_idx" ON "Publication"("isPublished");

-- CreateIndex
CREATE INDEX "Publication_publishedAt_idx" ON "Publication"("publishedAt");

-- CreateIndex
CREATE INDEX "Publication_type_isPublished_idx" ON "Publication"("type", "isPublished");

-- CreateIndex
CREATE INDEX "Publication_leiArticlesArr_idx" ON "Publication" USING GIN ("leiArticlesArr");

-- CreateIndex
CREATE INDEX "ContactForm_isRead_idx" ON "ContactForm"("isRead");

-- CreateIndex
CREATE INDEX "ContactForm_createdAt_idx" ON "ContactForm"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_isActive_idx" ON "NewsletterSubscriber"("isActive");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_subscribedAt_idx" ON "NewsletterSubscriber"("subscribedAt");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_source_idx" ON "NewsletterSubscriber"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Testimonial_contactFormId_key" ON "Testimonial"("contactFormId");

-- CreateIndex
CREATE INDEX "Testimonial_status_idx" ON "Testimonial"("status");

-- CreateIndex
CREATE INDEX "Testimonial_createdAt_idx" ON "Testimonial"("createdAt");

-- CreateIndex
CREATE INDEX "Testimonial_status_createdAt_idx" ON "Testimonial"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendedSite_isActive_idx" ON "RecommendedSite"("isActive");

-- CreateIndex
CREATE INDEX "RecommendedSite_displayOrder_idx" ON "RecommendedSite"("displayOrder");

-- CreateIndex
CREATE INDEX "SiteToCourse_courseId_idx" ON "SiteToCourse"("courseId");

-- CreateIndex
CREATE INDEX "SiteToCourse_siteId_idx" ON "SiteToCourse"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteToCourse_siteId_courseId_key" ON "SiteToCourse"("siteId", "courseId");

-- CreateIndex
CREATE INDEX "CourseVideo_courseId_idx" ON "CourseVideo"("courseId");

-- CreateIndex
CREATE INDEX "CourseVideo_isActive_idx" ON "CourseVideo"("isActive");

-- CreateIndex
CREATE INDEX "CourseVideo_courseId_isActive_displayOrder_idx" ON "CourseVideo"("courseId", "isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "GlossaryTerm_term_key" ON "GlossaryTerm"("term");

-- CreateIndex
CREATE UNIQUE INDEX "GlossaryTerm_slug_key" ON "GlossaryTerm"("slug");

-- CreateIndex
CREATE INDEX "GlossaryTerm_term_idx" ON "GlossaryTerm"("term");

-- CreateIndex
CREATE INDEX "GlossaryTerm_slug_idx" ON "GlossaryTerm"("slug");

-- CreateIndex
CREATE INDEX "GlossaryTerm_category_idx" ON "GlossaryTerm"("category");

-- CreateIndex
CREATE INDEX "GlossaryTerm_isPublic_idx" ON "GlossaryTerm"("isPublic");

-- CreateIndex
CREATE INDEX "GlossaryTerm_leiArticlesArr_idx" ON "GlossaryTerm" USING GIN ("leiArticlesArr");

-- CreateIndex
CREATE UNIQUE INDEX "LegislativeAct_fullNumber_key" ON "LegislativeAct"("fullNumber");

-- CreateIndex
CREATE INDEX "LegislativeAct_type_idx" ON "LegislativeAct"("type");

-- CreateIndex
CREATE INDEX "LegislativeAct_issuer_idx" ON "LegislativeAct"("issuer");

-- CreateIndex
CREATE INDEX "LegislativeAct_year_idx" ON "LegislativeAct"("year");

-- CreateIndex
CREATE INDEX "LegislativeAct_hierarchyLevel_idx" ON "LegislativeAct"("hierarchyLevel");

-- CreateIndex
CREATE INDEX "LegislativeAct_publishDate_idx" ON "LegislativeAct"("publishDate");

-- CreateIndex
CREATE INDEX "LegislativeAct_type_issuer_idx" ON "LegislativeAct"("type", "issuer");

-- CreateIndex
CREATE INDEX "LegislativeAct_year_type_idx" ON "LegislativeAct"("year", "type");

-- CreateIndex
CREATE INDEX "LegislativeAct_esfera_idx" ON "LegislativeAct"("esfera");

-- CreateIndex
CREATE INDEX "LegislativeAct_notifiedAt_idx" ON "LegislativeAct"("notifiedAt");

-- CreateIndex
CREATE INDEX "LegislativeAct_lastScrapedAt_idx" ON "LegislativeAct"("lastScrapedAt");

-- CreateIndex
CREATE INDEX "LegislativeAct_scrapeStatus_idx" ON "LegislativeAct"("scrapeStatus");

-- CreateIndex
CREATE INDEX "LegislativeAct_embeddingStatus_idx" ON "LegislativeAct"("embeddingStatus");

-- CreateIndex
CREATE INDEX "LegislativeAct_revoked_idx" ON "LegislativeAct"("revoked");

-- CreateIndex
CREATE INDEX "LegislativeAct_leiArticlesArr_idx" ON "LegislativeAct" USING GIN ("leiArticlesArr");

-- CreateIndex
CREATE UNIQUE INDEX "LegislativeAct_type_number_year_key" ON "LegislativeAct"("type", "number", "year");

-- CreateIndex
CREATE INDEX "LegislativeActChunk_legislativeActId_idx" ON "LegislativeActChunk"("legislativeActId");

-- CreateIndex
CREATE INDEX "FAQ_category_idx" ON "FAQ"("category");

-- CreateIndex
CREATE INDEX "FAQ_isPublished_idx" ON "FAQ"("isPublished");

-- CreateIndex
CREATE INDEX "FAQ_displayOrder_idx" ON "FAQ"("displayOrder");

-- CreateIndex
CREATE INDEX "FAQ_isPinned_idx" ON "FAQ"("isPinned");

-- CreateIndex
CREATE INDEX "FAQFeedback_faqId_idx" ON "FAQFeedback"("faqId");

-- CreateIndex
CREATE INDEX "FAQFeedback_wasHelpful_idx" ON "FAQFeedback"("wasHelpful");

-- CreateIndex
CREATE INDEX "FAQFeedback_createdAt_idx" ON "FAQFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "ArticleQuestion_articleNumber_idx" ON "ArticleQuestion"("articleNumber");

-- CreateIndex
CREATE INDEX "ArticleQuestion_conversationId_idx" ON "ArticleQuestion"("conversationId");

-- CreateIndex
CREATE INDEX "ArticleQuestion_userId_idx" ON "ArticleQuestion"("userId");

-- CreateIndex
CREATE INDEX "ArticleQuestion_isPlaceholder_idx" ON "ArticleQuestion"("isPlaceholder");

-- CreateIndex
CREATE INDEX "ArticleQuestion_createdAt_idx" ON "ArticleQuestion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DOUStagingDocument_douId_key" ON "DOUStagingDocument"("douId");

-- CreateIndex
CREATE INDEX "DOUStagingDocument_approvalStatus_idx" ON "DOUStagingDocument"("approvalStatus");

-- CreateIndex
CREATE INDEX "DOUStagingDocument_category_idx" ON "DOUStagingDocument"("category");

-- CreateIndex
CREATE INDEX "DOUStagingDocument_requiresReview_idx" ON "DOUStagingDocument"("requiresReview");

-- CreateIndex
CREATE INDEX "DOUStagingDocument_imported_idx" ON "DOUStagingDocument"("imported");

-- CreateIndex
CREATE INDEX "DOUStagingDocument_publishDate_idx" ON "DOUStagingDocument"("publishDate");

-- CreateIndex
CREATE INDEX "DOUStagingDocument_createdAt_idx" ON "DOUStagingDocument"("createdAt");

-- CreateIndex
CREATE INDEX "DOUStagingDocument_reviewedAt_idx" ON "DOUStagingDocument"("reviewedAt");

-- CreateIndex
CREATE INDEX "DOUStagingDocument_editorialScore_idx" ON "DOUStagingDocument"("editorialScore");

-- CreateIndex
CREATE INDEX "DOUStagingDocument_editorialPromptVer_idx" ON "DOUStagingDocument"("editorialPromptVer");

-- CreateIndex
CREATE INDEX "DOUStagingDocument_source_idx" ON "DOUStagingDocument"("source");

-- CreateIndex
CREATE INDEX "DOUSavedFilter_createdBy_idx" ON "DOUSavedFilter"("createdBy");

-- CreateIndex
CREATE INDEX "DOUSavedFilter_isPublic_idx" ON "DOUSavedFilter"("isPublic");

-- CreateIndex
CREATE INDEX "DOUSavedFilter_lastUsedAt_idx" ON "DOUSavedFilter"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeiArticle_numero_key" ON "LeiArticle"("numero");

-- CreateIndex
CREATE INDEX "LeiArticle_numero_idx" ON "LeiArticle"("numero");

-- CreateIndex
CREATE INDEX "LeiArticle_capitulo_idx" ON "LeiArticle"("capitulo");

-- CreateIndex
CREATE UNIQUE INDEX "SearchHistory_shareId_key" ON "SearchHistory"("shareId");

-- CreateIndex
CREATE INDEX "SearchHistory_userId_createdAt_idx" ON "SearchHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchHistory_userId_idx" ON "SearchHistory"("userId");

-- CreateIndex
CREATE INDEX "SearchHistory_type_createdAt_idx" ON "SearchHistory"("type", "createdAt");

-- CreateIndex
CREATE INDEX "SearchHistory_feedback_idx" ON "SearchHistory"("feedback");

-- CreateIndex
CREATE INDEX "IndexJob_status_idx" ON "IndexJob"("status");

-- CreateIndex
CREATE INDEX "IndexJob_priority_status_idx" ON "IndexJob"("priority", "status");

-- CreateIndex
CREATE INDEX "IndexJob_entityType_entityId_idx" ON "IndexJob"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "IndexJob_createdAt_idx" ON "IndexJob"("createdAt");

-- CreateIndex
CREATE INDEX "IndexJob_scheduledFor_idx" ON "IndexJob"("scheduledFor");

-- CreateIndex
CREATE INDEX "Module_courseId_idx" ON "Module"("courseId");

-- CreateIndex
CREATE INDEX "Module_courseId_displayOrder_idx" ON "Module"("courseId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CourseStatus_courseId_key" ON "CourseStatus"("courseId");

-- CreateIndex
CREATE INDEX "CourseStatus_isSuspended_idx" ON "CourseStatus"("isSuspended");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_idx" ON "Lesson"("moduleId");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_displayOrder_idx" ON "Lesson"("moduleId", "displayOrder");

-- CreateIndex
CREATE INDEX "Lesson_prerequisiteId_idx" ON "Lesson"("prerequisiteId");

-- CreateIndex
CREATE INDEX "Lesson_leiArticlesArr_idx" ON "Lesson" USING GIN ("leiArticlesArr");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_moduleId_slug_key" ON "Lesson"("moduleId", "slug");

-- CreateIndex
CREATE INDEX "LessonDocument_lessonId_idx" ON "LessonDocument"("lessonId");

-- CreateIndex
CREATE INDEX "LessonDocument_documentId_idx" ON "LessonDocument"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonDocument_lessonId_documentId_key" ON "LessonDocument"("lessonId", "documentId");

-- CreateIndex
CREATE INDEX "LessonVideo_lessonId_idx" ON "LessonVideo"("lessonId");

-- CreateIndex
CREATE INDEX "LessonVideo_courseVideoId_idx" ON "LessonVideo"("courseVideoId");

-- CreateIndex
CREATE INDEX "LessonProgress_userId_idx" ON "LessonProgress"("userId");

-- CreateIndex
CREATE INDEX "LessonProgress_lessonId_idx" ON "LessonProgress"("lessonId");

-- CreateIndex
CREATE INDEX "LessonProgress_userId_status_idx" ON "LessonProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_userId_lessonId_key" ON "LessonProgress"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_lessonId_key" ON "Quiz"("lessonId");

-- CreateIndex
CREATE INDEX "Quiz_lessonId_idx" ON "Quiz"("lessonId");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_idx" ON "QuizQuestion"("quizId");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_displayOrder_idx" ON "QuizQuestion"("quizId", "displayOrder");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_idx" ON "QuizAttempt"("quizId");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_idx" ON "QuizAttempt"("userId");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_userId_idx" ON "QuizAttempt"("quizId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "Certificate_userId_idx" ON "Certificate"("userId");

-- CreateIndex
CREATE INDEX "Certificate_courseId_idx" ON "Certificate"("courseId");

-- CreateIndex
CREATE INDEX "Certificate_certificateNumber_idx" ON "Certificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "Certificate_revokedAt_idx" ON "Certificate"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_userId_courseId_key" ON "Certificate"("userId", "courseId");

-- CreateIndex
CREATE INDEX "Badge_userId_idx" ON "Badge"("userId");

-- CreateIndex
CREATE INDEX "Badge_courseId_idx" ON "Badge"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_userId_type_courseId_key" ON "Badge"("userId", "type", "courseId");

-- CreateIndex
CREATE INDEX "UserStreak_courseId_totalXp_idx" ON "UserStreak"("courseId", "totalXp");

-- CreateIndex
CREATE INDEX "UserStreak_courseId_showOnLeaderboard_idx" ON "UserStreak"("courseId", "showOnLeaderboard");

-- CreateIndex
CREATE UNIQUE INDEX "UserStreak_userId_courseId_key" ON "UserStreak"("userId", "courseId");

-- CreateIndex
CREATE INDEX "TcuHighlight_status_idx" ON "TcuHighlight"("status");

-- CreateIndex
CREATE INDEX "TcuHighlight_status_createdAt_idx" ON "TcuHighlight"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TcuHighlight_documentId_idx" ON "TcuHighlight"("documentId");

-- CreateIndex
CREATE INDEX "AcordaoCitacao_numeroAlvo_anoAlvo_idx" ON "AcordaoCitacao"("numeroAlvo", "anoAlvo");

-- CreateIndex
CREATE INDEX "AcordaoCitacao_origemId_idx" ON "AcordaoCitacao"("origemId");

-- CreateIndex
CREATE UNIQUE INDEX "AcordaoCitacao_origemId_numeroAlvo_anoAlvo_key" ON "AcordaoCitacao"("origemId", "numeroAlvo", "anoAlvo");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCheckoutSessionId_key" ON "Subscription"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "LeiArticleEmbedding_articleNumber_key" ON "LeiArticleEmbedding"("articleNumber");

-- CreateIndex
CREATE INDEX "LeiArticleEmbedding_articleNumber_idx" ON "LeiArticleEmbedding"("articleNumber");

-- CreateIndex
CREATE INDEX "LeiArticleNote_articleNumber_idx" ON "LeiArticleNote"("articleNumber");

-- CreateIndex
CREATE INDEX "LeiArticleNote_type_idx" ON "LeiArticleNote"("type");

-- CreateIndex
CREATE INDEX "LeiArticleNote_adminReviewed_idx" ON "LeiArticleNote"("adminReviewed");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClippingSend_sentDate_key" ON "DailyClippingSend"("sentDate");

-- CreateIndex
CREATE INDEX "DailyClippingSend_sentDate_idx" ON "DailyClippingSend"("sentDate");

-- CreateIndex
CREATE INDEX "DailyClippingSend_status_idx" ON "DailyClippingSend"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClippingItemExtract_documentId_key" ON "ClippingItemExtract"("documentId");

-- CreateIndex
CREATE INDEX "ClippingItemExtract_extractMethod_idx" ON "ClippingItemExtract"("extractMethod");

-- CreateIndex
CREATE INDEX "NewsletterSend_sentAt_idx" ON "NewsletterSend"("sentAt");

-- CreateIndex
CREATE INDEX "NewsletterSend_type_idx" ON "NewsletterSend"("type");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TribunalDecision_fullIdentifier_key" ON "TribunalDecision"("fullIdentifier");

-- CreateIndex
CREATE INDEX "TribunalDecision_tribunalCode_idx" ON "TribunalDecision"("tribunalCode");

-- CreateIndex
CREATE INDEX "TribunalDecision_tribunalCode_year_idx" ON "TribunalDecision"("tribunalCode", "year");

-- CreateIndex
CREATE INDEX "TribunalDecision_decisionType_idx" ON "TribunalDecision"("decisionType");

-- CreateIndex
CREATE INDEX "TribunalDecision_approvalStatus_idx" ON "TribunalDecision"("approvalStatus");

-- CreateIndex
CREATE INDEX "TribunalDecision_dataJulgamento_idx" ON "TribunalDecision"("dataJulgamento");

-- CreateIndex
CREATE INDEX "TribunalDecision_isRelevant_approvalStatus_idx" ON "TribunalDecision"("isRelevant", "approvalStatus");

-- CreateIndex
CREATE INDEX "TribunalDecision_embeddingStatus_idx" ON "TribunalDecision"("embeddingStatus");

-- CreateIndex
CREATE INDEX "TribunalDecision_sourceApi_idx" ON "TribunalDecision"("sourceApi");

-- CreateIndex
CREATE INDEX "TribunalDecision_year_idx" ON "TribunalDecision"("year");

-- CreateIndex
CREATE INDEX "TribunalDecision_leiArticlesArr_idx" ON "TribunalDecision" USING GIN ("leiArticlesArr");

-- CreateIndex
CREATE INDEX "TribunalHighlight_status_idx" ON "TribunalHighlight"("status");

-- CreateIndex
CREATE INDEX "TribunalHighlight_status_createdAt_idx" ON "TribunalHighlight"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TribunalHighlight_tribunalDecisionId_idx" ON "TribunalHighlight"("tribunalDecisionId");

-- CreateIndex
CREATE INDEX "TribunalDecisionChunk_tribunalDecisionId_idx" ON "TribunalDecisionChunk"("tribunalDecisionId");

-- CreateIndex
CREATE INDEX "ScraperHealthLog_scraperCode_idx" ON "ScraperHealthLog"("scraperCode");

-- CreateIndex
CREATE INDEX "ScraperHealthLog_scraperCode_runAt_idx" ON "ScraperHealthLog"("scraperCode", "runAt");

-- CreateIndex
CREATE INDEX "ScraperHealthLog_status_idx" ON "ScraperHealthLog"("status");

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_processedAt_idx" ON "ProcessedWebhookEvent"("processedAt");

-- CreateIndex
CREATE INDEX "PlanningSession_userId_status_idx" ON "PlanningSession"("userId", "status");

-- CreateIndex
CREATE INDEX "PlanningSession_userId_deletedAt_idx" ON "PlanningSession"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "PlanningSession_userId_updatedAt_idx" ON "PlanningSession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "PlanningDocument_sessionId_idx" ON "PlanningDocument"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningDocument_sessionId_type_key" ON "PlanningDocument"("sessionId", "type");

-- CreateIndex
CREATE INDEX "PlanningDocumentSection_documentId_ordem_idx" ON "PlanningDocumentSection"("documentId", "ordem");

-- CreateIndex
CREATE INDEX "PlanningDocumentSection_status_idx" ON "PlanningDocumentSection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningDocumentSection_documentId_sectionKey_key" ON "PlanningDocumentSection"("documentId", "sectionKey");

-- CreateIndex
CREATE INDEX "PlanningDocumentVersion_documentId_createdAt_idx" ON "PlanningDocumentVersion"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningDocumentVersion_documentId_versionNumber_key" ON "PlanningDocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "PlanningLibrarySnippet_userId_updatedAt_idx" ON "PlanningLibrarySnippet"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "PlanningLibrarySnippet_userId_titulo_idx" ON "PlanningLibrarySnippet"("userId", "titulo");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningTrailTemplate_slug_key" ON "PlanningTrailTemplate"("slug");

-- CreateIndex
CREATE INDEX "PlanningTrailTemplate_natureza_documentType_idx" ON "PlanningTrailTemplate"("natureza", "documentType");

-- CreateIndex
CREATE INDEX "PlanningTrailTemplate_publishedAt_idx" ON "PlanningTrailTemplate"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningSectionTemplate_trailTemplateId_sectionKey_key" ON "PlanningSectionTemplate"("trailTemplateId", "sectionKey");

-- CreateIndex
CREATE INDEX "PlanningDecisionRun_sessionId_executedAt_idx" ON "PlanningDecisionRun"("sessionId", "executedAt");

-- CreateIndex
CREATE INDEX "PlanningDecisionRun_matrixSlug_matrixVersion_idx" ON "PlanningDecisionRun"("matrixSlug", "matrixVersion");

-- CreateIndex
CREATE INDEX "PlanningExport_documentId_createdAt_idx" ON "PlanningExport"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "LegislativeActRelation_targetActId_idx" ON "LegislativeActRelation"("targetActId");

-- CreateIndex
CREATE INDEX "LegislativeActRelation_sourceActId_idx" ON "LegislativeActRelation"("sourceActId");

-- CreateIndex
CREATE INDEX "LegislativeActRelation_reviewStatus_idx" ON "LegislativeActRelation"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "LegislativeActRelation_sourceActId_targetActId_relationType_key" ON "LegislativeActRelation"("sourceActId", "targetActId", "relationType");

-- CreateIndex
CREATE INDEX "LeiArticleCrossRef_articleNumber_order_idx" ON "LeiArticleCrossRef"("articleNumber", "order");

-- CreateIndex
CREATE INDEX "LeiArticleCrossRef_targetNumber_idx" ON "LeiArticleCrossRef"("targetNumber");

-- CreateIndex
CREATE INDEX "LeiArticleSuggestedReading_articleNumber_order_idx" ON "LeiArticleSuggestedReading"("articleNumber", "order");

-- CreateIndex
CREATE INDEX "TeseDestilacao_numeroAlvo_anoAlvo_atual_idx" ON "TeseDestilacao"("numeroAlvo", "anoAlvo", "atual");

-- CreateIndex
CREATE INDEX "TeseDestilacao_chave_idx" ON "TeseDestilacao"("chave");

-- CreateIndex
CREATE INDEX "TeseEnunciado_destilacaoId_idx" ON "TeseEnunciado"("destilacaoId");

-- CreateIndex
CREATE INDEX "TeseEnunciado_veredito_idx" ON "TeseEnunciado"("veredito");

-- CreateIndex
CREATE INDEX "TeseDivergencia_destilacaoId_idx" ON "TeseDivergencia"("destilacaoId");

-- CreateIndex
CREATE INDEX "AcordaoTema_tema_idx" ON "AcordaoTema"("tema");

-- CreateIndex
CREATE INDEX "AcordaoTema_chave_idx" ON "AcordaoTema"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "AcordaoTema_numeroAlvo_anoAlvo_key" ON "AcordaoTema"("numeroAlvo", "anoAlvo");

-- AddForeignKey
ALTER TABLE "DocumentMetaTcu" ADD CONSTRAINT "DocumentMetaTcu_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentMetaDou" ADD CONSTRAINT "DocumentMetaDou_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNotes" ADD CONSTRAINT "DocumentNotes_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_legislativeActId_fkey" FOREIGN KEY ("legislativeActId") REFERENCES "LegislativeAct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialMediaPost" ADD CONSTRAINT "SocialMediaPost_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteToCourse" ADD CONSTRAINT "SiteToCourse_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "RecommendedSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegislativeActChunk" ADD CONSTRAINT "LegislativeActChunk_legislativeActId_fkey" FOREIGN KEY ("legislativeActId") REFERENCES "LegislativeAct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FAQFeedback" ADD CONSTRAINT "FAQFeedback_faqId_fkey" FOREIGN KEY ("faqId") REFERENCES "FAQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonDocument" ADD CONSTRAINT "LessonDocument_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonDocument" ADD CONSTRAINT "LessonDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonVideo" ADD CONSTRAINT "LessonVideo_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonVideo" ADD CONSTRAINT "LessonVideo_courseVideoId_fkey" FOREIGN KEY ("courseVideoId") REFERENCES "CourseVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TcuHighlight" ADD CONSTRAINT "TcuHighlight_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcordaoCitacao" ADD CONSTRAINT "AcordaoCitacao_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClippingItemExtract" ADD CONSTRAINT "ClippingItemExtract_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TribunalHighlight" ADD CONSTRAINT "TribunalHighlight_tribunalDecisionId_fkey" FOREIGN KEY ("tribunalDecisionId") REFERENCES "TribunalDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TribunalDecisionChunk" ADD CONSTRAINT "TribunalDecisionChunk_tribunalDecisionId_fkey" FOREIGN KEY ("tribunalDecisionId") REFERENCES "TribunalDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningSession" ADD CONSTRAINT "PlanningSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningSession" ADD CONSTRAINT "PlanningSession_trailTemplateId_fkey" FOREIGN KEY ("trailTemplateId") REFERENCES "PlanningTrailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningDocument" ADD CONSTRAINT "PlanningDocument_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlanningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningDocumentSection" ADD CONSTRAINT "PlanningDocumentSection_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PlanningDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningDocumentSection" ADD CONSTRAINT "PlanningDocumentSection_derivedFromSectionId_fkey" FOREIGN KEY ("derivedFromSectionId") REFERENCES "PlanningDocumentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningDocumentVersion" ADD CONSTRAINT "PlanningDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PlanningDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningDocumentVersion" ADD CONSTRAINT "PlanningDocumentVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningLibrarySnippet" ADD CONSTRAINT "PlanningLibrarySnippet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningTrailTemplate" ADD CONSTRAINT "PlanningTrailTemplate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningSectionTemplate" ADD CONSTRAINT "PlanningSectionTemplate_trailTemplateId_fkey" FOREIGN KEY ("trailTemplateId") REFERENCES "PlanningTrailTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningDecisionRun" ADD CONSTRAINT "PlanningDecisionRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlanningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningExport" ADD CONSTRAINT "PlanningExport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PlanningDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegislativeActRelation" ADD CONSTRAINT "LegislativeActRelation_sourceActId_fkey" FOREIGN KEY ("sourceActId") REFERENCES "LegislativeAct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegislativeActRelation" ADD CONSTRAINT "LegislativeActRelation_targetActId_fkey" FOREIGN KEY ("targetActId") REFERENCES "LegislativeAct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeiArticleCrossRef" ADD CONSTRAINT "LeiArticleCrossRef_articleNumber_fkey" FOREIGN KEY ("articleNumber") REFERENCES "LeiArticle"("numero") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeiArticleSuggestedReading" ADD CONSTRAINT "LeiArticleSuggestedReading_articleNumber_fkey" FOREIGN KEY ("articleNumber") REFERENCES "LeiArticle"("numero") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeseEnunciado" ADD CONSTRAINT "TeseEnunciado_destilacaoId_fkey" FOREIGN KEY ("destilacaoId") REFERENCES "TeseDestilacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeseDivergencia" ADD CONSTRAINT "TeseDivergencia_destilacaoId_fkey" FOREIGN KEY ("destilacaoId") REFERENCES "TeseDestilacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
