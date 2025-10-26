/**
 * Processador de arquivos Excel para importação de documentos
 */

import * as XLSX from 'xlsx';
import { autoClassifyDocument, suggestCategory, extractTags } from './auto-classifier';

export interface ExcelDocumentRow {
  titulo: string;
  descricao?: string;
  categoria?: string;
  curso?: string;
  publico?: string;
  tags?: string;
  artigos?: string; // Números de artigos da Lei 14.133/2021 separados por vírgula
  url?: string;
  arquivo?: string;
}

export interface ProcessedDocument {
  title: string;
  description: string;
  category: 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'outro';
  courseId?: string;
  courseSlug?: string;
  // Múltiplos cursos
  courseIds?: string[];
  courseSlugs?: string[];
  isMultipleCourses: boolean;
  isAllCourses: boolean;
  isPublic: boolean;
  tags: string[];
  leiArticles: string[]; // Números de artigos da Lei 14.133/2021
  url?: string;
  fileName?: string;
  // Classificação automática
  autoClassified: boolean;
  confidence?: number;
  suggestedCourse?: string;
  // Validação
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImportValidationResult {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  documents: ProcessedDocument[];
  errors: string[];
}

/**
 * Valida se o arquivo Excel tem o formato correto
 */
function validateExcelStructure(worksheet: XLSX.WorkSheet): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Pega os headers (primeira linha)
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const headers: string[] = [];

  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = worksheet[cellAddress];
    if (cell && cell.v) {
      headers.push(String(cell.v).toLowerCase().trim());
    }
  }

  // Verifica se tem pelo menos o campo obrigatório (título)
  if (!headers.includes('titulo') && !headers.includes('título')) {
    errors.push('Coluna "Titulo" é obrigatória');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Mapeia slug do curso para ID
 */
function getCourseIdFromSlug(slug: string): string | undefined {
  const courseMap: Record<string, string> = {
    'nova-lei-licitacoes': '1',
    'planejamento-contratacoes': '2',
    'gestao-fiscalizacao-contratos': '3',
    'processo-administrativo-sancionador': '4',
    'inovacao-contratacoes': '5',
    'terceirizacao-precos': '6',
    'assessoramento-juridico': '7',
    'revisao-reajuste-repactuacao': '8',
    'alteracoes-contratuais': '9',
    'contratacao-direta': '10'
  };

  return courseMap[slug];
}

/**
 * Retorna todos os cursos disponíveis
 */
function getAllCourses(): Array<{ id: string; slug: string }> {
  return [
    { id: '1', slug: 'nova-lei-licitacoes' },
    { id: '2', slug: 'planejamento-contratacoes' },
    { id: '3', slug: 'gestao-fiscalizacao-contratos' },
    { id: '4', slug: 'processo-administrativo-sancionador' },
    { id: '5', slug: 'inovacao-contratacoes' },
    { id: '6', slug: 'terceirizacao-precos' },
    { id: '7', slug: 'assessoramento-juridico' },
    { id: '8', slug: 'revisao-reajuste-repactuacao' },
    { id: '9', slug: 'alteracoes-contratuais' },
    { id: '10', slug: 'contratacao-direta' }
  ];
}

/**
 * Valida e processa uma linha do Excel
 */
function processRow(
  row: ExcelDocumentRow,
  rowIndex: number
): ProcessedDocument {
  const errors: string[] = [];
  const warnings: string[] = [];
  let autoClassified = false;
  let confidence = 0;
  let suggestedCourse = '';

  // Validação: Título é obrigatório
  if (!row.titulo || row.titulo.trim() === '') {
    errors.push(`Linha ${rowIndex}: Título é obrigatório`);
  }

  const title = row.titulo?.trim() || '';
  const description = row.descricao?.trim() || '';

  // Categoria: usa sugerida ou auto-classifica
  let category: ProcessedDocument['category'] = 'outro';
  if (row.categoria) {
    const normalizedCategory = row.categoria.toLowerCase().trim();
    const validCategories = ['apostila', 'acordao', 'parecer', 'edital', 'artigo', 'outro'];
    if (validCategories.includes(normalizedCategory)) {
      category = normalizedCategory as ProcessedDocument['category'];
    } else {
      warnings.push(`Linha ${rowIndex}: Categoria "${row.categoria}" inválida, usando sugestão automática`);
      category = suggestCategory(title, description);
    }
  } else {
    category = suggestCategory(title, description);
    autoClassified = true;
  }

  // Curso: usa informado ou auto-classifica
  // Suporta: curso único, múltiplos cursos (separados por vírgula), ou "TODOS"
  let courseSlug = '';
  let courseId = '';
  let courseIds: string[] = [];
  let courseSlugs: string[] = [];
  let isMultipleCourses = false;
  let isAllCourses = false;

  if (row.curso) {
    const courseInput = row.curso.trim();

    // Detecta "TODOS" ou "*"
    if (courseInput.toLowerCase() === 'todos' || courseInput === '*') {
      const allCourses = getAllCourses();
      courseIds = allCourses.map(c => c.id);
      courseSlugs = allCourses.map(c => c.slug);
      isMultipleCourses = true;
      isAllCourses = true;
      courseId = courseIds[0]; // Primeiro curso como referência
      courseSlug = courseSlugs[0];
    }
    // Detecta múltiplos cursos separados por vírgula
    else if (courseInput.includes(',')) {
      const courseInputs = courseInput.split(',').map(c => c.toLowerCase().trim());
      const validCourses: Array<{ id: string; slug: string }> = [];
      const invalidCourses: string[] = [];

      courseInputs.forEach(inputSlug => {
        const foundId = getCourseIdFromSlug(inputSlug);
        if (foundId) {
          validCourses.push({ id: foundId, slug: inputSlug });
        } else {
          invalidCourses.push(inputSlug);
        }
      });

      if (validCourses.length > 0) {
        courseIds = validCourses.map(c => c.id);
        courseSlugs = validCourses.map(c => c.slug);
        isMultipleCourses = true;
        courseId = courseIds[0]; // Primeiro curso como referência
        courseSlug = courseSlugs[0];

        if (invalidCourses.length > 0) {
          warnings.push(`Linha ${rowIndex}: Cursos não encontrados: ${invalidCourses.join(', ')}`);
        }
      } else {
        warnings.push(`Linha ${rowIndex}: Nenhum curso válido encontrado em "${courseInput}", usando classificação automática`);
        const classification = autoClassifyDocument(title, description);
        courseSlug = classification.courseSlug;
        courseId = getCourseIdFromSlug(courseSlug) || '1';
        autoClassified = true;
        confidence = classification.confidence;
        suggestedCourse = courseSlug;
      }
    }
    // Curso único
    else {
      courseSlug = courseInput.toLowerCase();
      const foundCourseId = getCourseIdFromSlug(courseSlug);
      if (foundCourseId) {
        courseId = foundCourseId;
      } else {
        warnings.push(`Linha ${rowIndex}: Curso "${row.curso}" não encontrado, usando classificação automática`);
        const classification = autoClassifyDocument(title, description);
        courseSlug = classification.courseSlug;
        courseId = getCourseIdFromSlug(courseSlug) || '1';
        autoClassified = true;
        confidence = classification.confidence;
        suggestedCourse = courseSlug;
      }
    }
  } else {
    const classification = autoClassifyDocument(title, description);
    courseSlug = classification.courseSlug;
    courseId = getCourseIdFromSlug(courseSlug) || '1';
    autoClassified = true;
    confidence = classification.confidence;
    suggestedCourse = courseSlug;
  }

  // Tags: usa informadas ou extrai automaticamente
  let tags: string[] = [];
  if (row.tags && row.tags.trim() !== '') {
    tags = row.tags.split(/[,;]/).map(t => t.trim()).filter(t => t.length > 0);
  } else {
    tags = extractTags(title, description);
    if (tags.length > 0) {
      autoClassified = true;
    }
  }

  // Artigos da Lei 14.133/2021: processa números separados por vírgula
  let leiArticles: string[] = [];
  if (row.artigos && row.artigos.trim() !== '') {
    // Remove espaços e split por vírgula ou ponto e vírgula
    leiArticles = row.artigos
      .split(/[,;]/)
      .map(num => num.trim())
      .filter(num => {
        // Valida se é um número válido (1-193)
        const articleNum = parseInt(num);
        if (isNaN(articleNum) || articleNum < 1 || articleNum > 193) {
          warnings.push(`Linha ${rowIndex}: Artigo "${num}" inválido (deve ser entre 1 e 193)`);
          return false;
        }
        return true;
      });
  }

  // Público: padrão é false (restrito)
  let isPublic = false;
  if (row.publico) {
    const publicValue = row.publico.toLowerCase().trim();
    isPublic = ['sim', 'true', '1', 's', 'público', 'publico'].includes(publicValue);
  }

  // URL ou arquivo
  const url = row.url?.trim() || undefined;
  const fileName = row.arquivo?.trim() || undefined;

  if (!url && !fileName) {
    warnings.push(`Linha ${rowIndex}: Nenhum arquivo ou URL fornecido`);
  }

  return {
    title,
    description,
    category,
    courseId,
    courseSlug,
    courseIds: isMultipleCourses ? courseIds : undefined,
    courseSlugs: isMultipleCourses ? courseSlugs : undefined,
    isMultipleCourses,
    isAllCourses,
    isPublic,
    tags,
    leiArticles,
    url,
    fileName,
    autoClassified,
    confidence,
    suggestedCourse,
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Processa arquivo Excel e retorna documentos validados
 */
export async function processExcelFile(
  fileBuffer: Buffer
): Promise<ImportValidationResult> {
  try {
    // Lê o arquivo Excel
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Pega a primeira planilha
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        isValid: false,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        documents: [],
        errors: ['Arquivo Excel não contém planilhas']
      };
    }

    const worksheet = workbook.Sheets[sheetName];

    // Valida estrutura
    const structureValidation = validateExcelStructure(worksheet);
    if (!structureValidation.isValid) {
      return {
        isValid: false,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        documents: [],
        errors: structureValidation.errors
      };
    }

    // Converte para JSON
    const rows: ExcelDocumentRow[] = XLSX.utils.sheet_to_json(worksheet, {
      header: ['titulo', 'descricao', 'categoria', 'curso', 'publico', 'tags', 'artigos', 'url', 'arquivo'],
      range: 1 // Pula a primeira linha (headers)
    });

    if (rows.length === 0) {
      return {
        isValid: false,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        documents: [],
        errors: ['Planilha não contém dados']
      };
    }

    // Processa cada linha
    const documents = rows.map((row, index) => processRow(row, index + 2)); // +2 porque linha 1 é header

    const validDocuments = documents.filter(doc => doc.isValid);
    const invalidDocuments = documents.filter(doc => !doc.isValid);

    // Coleta todos os erros globais
    const globalErrors: string[] = [];
    invalidDocuments.forEach(doc => {
      globalErrors.push(...doc.errors);
    });

    return {
      isValid: invalidDocuments.length === 0,
      totalRows: documents.length,
      validRows: validDocuments.length,
      invalidRows: invalidDocuments.length,
      documents,
      errors: globalErrors
    };
  } catch (error) {
    console.error('Erro ao processar Excel:', error);
    return {
      isValid: false,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      documents: [],
      errors: [`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]
    };
  }
}

/**
 * Gera template Excel para download
 */
export function generateExcelTemplate(): Buffer {
  const headers = [
    'Titulo',
    'Descricao',
    'Categoria',
    'Curso',
    'Publico',
    'Tags',
    'Artigos',
    'URL',
    'Arquivo'
  ];

  const exampleRows = [
    {
      Titulo: 'Acórdão 1234/2023 - Dispensa de Licitação',
      Descricao: 'Dispensa de licitação por valor. Análise dos requisitos legais.',
      Categoria: 'acordao',
      Curso: 'contratacao-direta',
      Publico: 'Não',
      Tags: 'TCU, dispensa, valor',
      Artigos: '72, 74, 75',
      URL: '',
      Arquivo: 'acordao_1234_2023.pdf'
    },
    {
      Titulo: 'Parecer AGU sobre Registro de Preços',
      Descricao: 'Orientações sobre sistema de registro de preços na nova lei',
      Categoria: 'parecer',
      Curso: 'nova-lei-licitacoes',
      Publico: 'Sim',
      Tags: 'AGU, registro de preços, Lei 14.133',
      Artigos: '81, 82, 83, 84',
      URL: 'https://exemplo.com/parecer.pdf',
      Arquivo: ''
    },
    {
      Titulo: 'Lei 14.133/2021 Comentada - Artigos Principais',
      Descricao: 'Comentários sobre os artigos mais relevantes da nova lei',
      Categoria: 'apostila',
      Curso: 'TODOS',
      Publico: 'Sim',
      Tags: 'Lei 14.133, legislação, comentários',
      Artigos: '6, 29, 30, 155',
      URL: '',
      Arquivo: 'lei_14133_comentada.pdf'
    },
    {
      Titulo: 'Acórdão 5678/2023 - Fiscalização e Planejamento',
      Descricao: 'Aspectos de fiscalização contratual e planejamento de contratações',
      Categoria: 'acordao',
      Curso: 'gestao-fiscalizacao-contratos, planejamento-contratacoes',
      Publico: 'Não',
      Tags: 'TCU, fiscalização, planejamento',
      Artigos: '22, 115, 116, 117',
      URL: '',
      Arquivo: 'acordao_5678_2023.pdf'
    }
  ];

  // Cria workbook
  const worksheet = XLSX.utils.json_to_sheet(exampleRows, { header: headers });

  // Define largura das colunas
  worksheet['!cols'] = [
    { wch: 50 }, // Titulo
    { wch: 60 }, // Descricao
    { wch: 12 }, // Categoria
    { wch: 30 }, // Curso
    { wch: 8 },  // Publico
    { wch: 30 }, // Tags
    { wch: 20 }, // Artigos
    { wch: 40 }, // URL
    { wch: 30 }  // Arquivo
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Documentos');

  // Gera buffer
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
