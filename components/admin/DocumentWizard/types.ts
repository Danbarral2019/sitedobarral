/**
 * Tipos compartilhados entre os steps do Document Wizard
 */

export type DocumentCategory =
  | 'apostila'
  | 'acordao'
  | 'parecer'
  | 'edital'
  | 'artigo'
  | 'orientacao-normativa'
  | 'enunciados'
  | 'sumula'
  | 'consulta_tcu'
  | 'informativo'
  | 'outro';

export type DocumentType = 'pdf' | 'doc' | 'link' | 'video';

export type ImportanceLevel = 'baixa' | 'media' | 'alta' | 'critica';

export interface AlternativeUrl {
  url: string;
  label: string;
  type: 'pdf' | 'link';
}

/**
 * Estado completo do formulário do wizard
 */
export interface DocumentFormState {
  // Step 1: Informações Básicas
  title: string;
  description: string;
  category: DocumentCategory;
  courseId: string;
  isPublic: boolean;
  isCommon: boolean;
  url: string;
  type: DocumentType;
  selectedFile: File | null;
  entityType?: string; // Para enunciados
  enunciadoNumber?: string; // Para enunciados

  // Step 2: Artigos da Lei 14.133
  leiArticles: string[];
  tags: string[];

  // Step 3: Conteúdo Educacional
  summary: string;
  keyPoints: string; // 1 por linha
  practicalUse: string;
  publicNotes: string;

  // Step 4: Finalização
  importance: ImportanceLevel | '';
  adminNotes: string;
  alternativeUrls: AlternativeUrl[];
}

/**
 * Resultado do enriquecimento com IA
 */
export interface AIEnhancementResult {
  summary: string;
  highlights: string[];
  keyPoints: string; // Já vem como string (1 por linha)
  practicalUse: string;
  publicNotes: string;
  suggestedImportance: ImportanceLevel;
  tags: string[];
  leiArticles: number[];
  confidence: number;
  reasoning: string;
}

/**
 * Props para cada step do wizard
 */
export interface WizardStepProps {
  formState: DocumentFormState;
  updateForm: (updates: Partial<DocumentFormState>) => void;
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  isFirstStep?: boolean;
  isLastStep?: boolean;
}
