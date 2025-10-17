/**
 * Sistema de Classificação Automática de Documentos
 * Baseado nas regras SQL de map_keywords_subtema
 */

interface ClassificationRule {
  pattern: string[];        // Palavras-chave (separadas por ; no SQL)
  type: 'plain' | 'regex';  // Tipo de busca
  scope: 'titulo' | 'ambos' | 'descricao'; // Onde buscar
  priority: number;         // Prioridade (menor = mais específico)
  courseSlug: string | null; // Slug do curso (null = usar fallback)
  observation?: string;     // Observação da regra
}

// Regras de classificação por tema (baseadas no SQL)
const licitacaoRules: ClassificationRule[] = [
  {
    pattern: ['contratação direta', 'dispensa'],
    type: 'plain',
    scope: 'ambos',
    priority: 20,
    courseSlug: 'contratacao-direta',
    observation: 'Contratação direta/dispensa'
  },
  {
    pattern: ['inexigibilidade'],
    type: 'plain',
    scope: 'ambos',
    priority: 20,
    courseSlug: 'contratacao-direta', // Inexigibilidade também vai para contratação direta
    observation: 'Inexigibilidade'
  },
  {
    pattern: ['pregão'],
    type: 'plain',
    scope: 'titulo',
    priority: 30,
    courseSlug: 'nova-lei-licitacoes',
    observation: 'Menções a pregão no título'
  },
  {
    pattern: ['edital', 'licitação'],
    type: 'plain',
    scope: 'ambos',
    priority: 40,
    courseSlug: 'nova-lei-licitacoes',
    observation: 'Edital de licitação'
  },
  {
    pattern: ['registro de preços'],
    type: 'plain',
    scope: 'ambos',
    priority: 40,
    courseSlug: 'nova-lei-licitacoes',
    observation: 'Registro de preços'
  },
  {
    pattern: ['projeto básico'],
    type: 'plain',
    scope: 'ambos',
    priority: 50,
    courseSlug: 'planejamento-contratacoes',
    observation: 'Projeto básico'
  },
  {
    pattern: ['orçamento estimativo', 'estimativa'],
    type: 'plain',
    scope: 'ambos',
    priority: 50,
    courseSlug: 'planejamento-contratacoes',
    observation: 'Orçamento estimativo'
  },
  {
    pattern: ['parecer jurídico'],
    type: 'plain',
    scope: 'ambos',
    priority: 60,
    courseSlug: 'assessoramento-juridico',
    observation: 'Parecer jurídico'
  },
  {
    pattern: ['homologação'],
    type: 'plain',
    scope: 'ambos',
    priority: 60,
    courseSlug: 'nova-lei-licitacoes',
    observation: 'Homologação'
  },
  {
    pattern: ['comissão de licitação', 'comissão', 'pregoeiro'],
    type: 'plain',
    scope: 'ambos',
    priority: 70,
    courseSlug: 'nova-lei-licitacoes',
    observation: 'Comissão/Pregoeiro'
  },
  {
    pattern: ['fraude', 'frustrar', 'simular', 'conluio'],
    type: 'plain',
    scope: 'ambos',
    priority: 30,
    courseSlug: 'processo-administrativo-sancionador',
    observation: 'Fraude/coadjuvantes'
  },
  {
    pattern: ['revogação'],
    type: 'plain',
    scope: 'ambos',
    priority: 60,
    courseSlug: 'nova-lei-licitacoes',
    observation: 'Revogação'
  },
  {
    pattern: ['gestão', 'fiscalização'],
    type: 'plain',
    scope: 'ambos',
    priority: 65,
    courseSlug: 'gestao-fiscalizacao-contratos',
    observation: 'Gestão e fiscalização'
  },
  {
    pattern: ['alteração contratual', 'aditivo'],
    type: 'plain',
    scope: 'ambos',
    priority: 50,
    courseSlug: 'alteracoes-contratuais',
    observation: 'Alterações contratuais'
  },
  {
    pattern: ['reajuste', 'repactuação', 'revisão'],
    type: 'plain',
    scope: 'ambos',
    priority: 50,
    courseSlug: 'revisao-reajuste-repactuacao',
    observation: 'Reajuste/Repactuação/Revisão'
  },
  {
    pattern: ['terceirização', 'formação de preços'],
    type: 'plain',
    scope: 'ambos',
    priority: 55,
    courseSlug: 'terceirizacao-precos',
    observation: 'Terceirização e formação de preços'
  },
  {
    pattern: ['inovação', 'marketplace'],
    type: 'plain',
    scope: 'ambos',
    priority: 55,
    courseSlug: 'inovacao-contratacoes',
    observation: 'Inovação nas contratações'
  },
  {
    pattern: ['licitação'],
    type: 'plain',
    scope: 'ambos',
    priority: 95,
    courseSlug: null,
    observation: 'Regra ampla: usa fallback (Nova Lei de Licitações)'
  }
];

/**
 * Normaliza texto para busca (remove acentos, lowercase)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Verifica se o texto contém alguma das palavras-chave
 */
function matchesPattern(text: string, pattern: string[]): boolean {
  const normalizedText = normalizeText(text);

  return pattern.some(keyword => {
    const normalizedKeyword = normalizeText(keyword);
    return normalizedText.includes(normalizedKeyword);
  });
}

/**
 * Classifica um documento automaticamente com base no título e descrição
 * Retorna o slug do curso sugerido
 */
export function autoClassifyDocument(
  title: string,
  description: string = ''
): {
  courseSlug: string;
  confidence: number;
  matchedRule?: ClassificationRule;
} {
  // Ordena regras por prioridade (menor = mais específico)
  const sortedRules = [...licitacaoRules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    let textToSearch = '';

    // Define onde buscar baseado no escopo
    switch (rule.scope) {
      case 'titulo':
        textToSearch = title;
        break;
      case 'descricao':
        textToSearch = description;
        break;
      case 'ambos':
        textToSearch = `${title} ${description}`;
        break;
    }

    // Verifica se o padrão corresponde
    if (matchesPattern(textToSearch, rule.pattern)) {
      // Calcula confiança baseada na prioridade
      // Prioridade menor = mais confiança (mais específico)
      const confidence = Math.max(10, 100 - rule.priority);

      return {
        courseSlug: rule.courseSlug || 'nova-lei-licitacoes', // Fallback
        confidence,
        matchedRule: rule
      };
    }
  }

  // Se nenhuma regra corresponder, usa curso padrão
  return {
    courseSlug: 'nova-lei-licitacoes',
    confidence: 5, // Baixa confiança
  };
}

/**
 * Sugere categorias baseadas no tipo de documento mencionado no texto
 */
export function suggestCategory(
  title: string,
  description: string = ''
): 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'outro' {
  const text = normalizeText(`${title} ${description}`);

  if (text.includes('acordao') || text.includes('acórdão')) {
    return 'acordao';
  }
  if (text.includes('parecer')) {
    return 'parecer';
  }
  if (text.includes('edital')) {
    return 'edital';
  }
  if (text.includes('artigo') || text.includes('doutrina')) {
    return 'artigo';
  }
  if (text.includes('apostila') || text.includes('manual')) {
    return 'apostila';
  }

  return 'outro';
}

/**
 * Extrai tags relevantes do texto
 */
export function extractTags(title: string, description: string = ''): string[] {
  const text = normalizeText(`${title} ${description}`);
  const tags: Set<string> = new Set();

  // Lista de possíveis tags relevantes
  const possibleTags = [
    'TCU', 'AGU', 'Lei 14.133/2021', 'Lei 8.666/93',
    'pregão', 'dispensa', 'inexigibilidade',
    'contrato', 'aditivo', 'rescisão',
    'fiscalização', 'gestão', 'planejamento',
    'fraude', 'sanção', 'penalidade',
    'registro de preços', 'projeto básico',
    'terceirização', 'inovação'
  ];

  for (const tag of possibleTags) {
    if (text.includes(normalizeText(tag))) {
      tags.add(tag);
    }
  }

  return Array.from(tags);
}

/**
 * Classifica múltiplos documentos de uma vez
 */
export function bulkClassify(
  documents: Array<{ title: string; description?: string }>
): Array<{
  courseSlug: string;
  category: string;
  tags: string[];
  confidence: number;
}> {
  return documents.map(doc => {
    const classification = autoClassifyDocument(doc.title, doc.description || '');
    const category = suggestCategory(doc.title, doc.description || '');
    const tags = extractTags(doc.title, doc.description || '');

    return {
      courseSlug: classification.courseSlug,
      category,
      tags,
      confidence: classification.confidence
    };
  });
}
