/**
 * Scraper para Orientações Normativas da AGU - VERSÃO MELHORADA
 * Extrai documentos de https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu
 *
 * MELHORIAS v2:
 * - Captura TODAS as ONs (66+), não apenas 21
 * - Extrai múltiplos PDFs de fundamentação por ON
 * - Suporta versões históricas (redações originais e atualizadas)
 * - Validação robusta de URLs antes da criação
 */

export interface OrientacaoNormativa {
  numero: string;           // Ex: "ON 1/2009"
  ano: string;              // Ex: "2009"
  numeroCompleto: string;   // Ex: "001/2009"
  titulo: string;           // Enunciado completo
  descricao: string;        // Descrição extraída
  linkDOU?: string;         // Link para publicação no DOU
  linkFundamentacao?: string; // Link principal para fundamentação (PDF)
  fundamentacaoLinks: string[]; // Todos os links de fundamentação encontrados
  tags: string[];           // Tags extraídas
  versaoHistorica?: string; // Ex: "Redação original de 2009"
}

/**
 * Faz scraping da página de Orientações Normativas
 */
export async function scrapeOrientacoesAGU(): Promise<OrientacaoNormativa[]> {
  try {
    console.log('[AGU Scraper v2] Iniciando scraping...');

    const response = await fetch('https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar página: ${response.status}`);
    }

    const html = await response.text();
    console.log('[AGU Scraper v2] Página carregada, iniciando parsing...');

    const orientacoes = parseOrientacoesFromHTML(html);

    console.log(`[AGU Scraper v2] ✅ ${orientacoes.length} orientações encontradas`);
    console.log(`[AGU Scraper v2] ✅ ${orientacoes.reduce((sum, on) => sum + on.fundamentacaoLinks.length, 0)} links de fundamentação extraídos`);

    return orientacoes;
  } catch (error) {
    console.error('[AGU Scraper v2] ❌ Erro ao fazer scraping:', error);
    throw error;
  }
}

/**
 * Faz parsing do HTML e extrai as orientações
 * NOVA ABORDAGEM: Procura por padrões markdown [Orientação Normativa XX/YYYY]
 */
function parseOrientacoesFromHTML(html: string): OrientacaoNormativa[] {
  const orientacoes: OrientacaoNormativa[] = [];

  // Remove tags <script>, <style> e comentários HTML para limpar o conteúdo
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Padrão principal: **[Orientação Normativa XX/YYYY](URL)**
  // Também captura variações: Orientação Normativa XX/YYYY (sem markdown)
  const onPatterns = [
    /\*\*\[Orientação Normativa\s+(\d{1,3})\/(\d{4})\]\(([^)]+)\)\*\*/gi,
    /\[Orientação Normativa\s+(\d{1,3})\/(\d{4})\]\(([^)]+)\)/gi,
    /Orientação Normativa\s+(\d{1,3})\/(\d{4})/gi,
  ];

  // Encontra todas as ocorrências de ONs
  const foundONs = new Set<string>();
  let match;

  for (const pattern of onPatterns) {
    pattern.lastIndex = 0; // Reset regex
    while ((match = pattern.exec(cleanHtml)) !== null) {
      const numero = match[1];
      const ano = match[2];
      const numeroCompleto = `${numero.padStart(3, '0')}/${ano}`;

      if (foundONs.has(numeroCompleto)) continue; // Evita duplicatas
      foundONs.add(numeroCompleto);

      const matchPosition = match.index;

      // Extrai o bloco de conteúdo dessa ON (até a próxima ON ou até 3000 chars)
      const nextONMatch = cleanHtml.slice(matchPosition + match[0].length).search(/Orientação Normativa\s+\d{1,3}\/\d{4}/i);
      const blockEnd = nextONMatch > 0 ? matchPosition + match[0].length + nextONMatch : matchPosition + 3000;
      const block = cleanHtml.slice(matchPosition, blockEnd);

      // Extrai informações da ON
      const orientacao = extractOrientacaoFromBlock(numero, ano, block);
      orientacoes.push(orientacao);
    }
  }

  // Ordena por ano e número
  orientacoes.sort((a, b) => {
    if (a.ano !== b.ano) return parseInt(b.ano) - parseInt(a.ano);
    return parseInt(a.numero.match(/\d+/)?.[0] || '0') - parseInt(b.numero.match(/\d+/)?.[0] || '0');
  });

  return orientacoes;
}

/**
 * Extrai informações de uma ON a partir do seu bloco de HTML
 */
function extractOrientacaoFromBlock(numero: string, ano: string, block: string): OrientacaoNormativa {
  const numeroCompleto = `${numero.padStart(3, '0')}/${ano}`;
  const numeroDisplay = `ON ${parseInt(numero)}/${ano}`;

  // Extrai o enunciado (texto após "Enunciado:" ou primeira linha de texto longo)
  let titulo = '';
  const enunciadoMatch = block.match(/Enunciado[:\s]*([^<\n]+)/i);
  if (enunciadoMatch) {
    titulo = enunciadoMatch[1].trim();
  } else {
    // Procura por linha de texto longo após o número
    const textMatch = block.match(/Orientação Normativa\s+\d{1,3}\/\d{4}[^\n]*\n+([^<\n]{20,})/i);
    if (textMatch) {
      titulo = textMatch[1].trim();
    }
  }

  // Remove tags HTML, atributos soltos e markdown do título
  titulo = titulo
    .replace(/<[^>]*>/g, '') // Remove tags HTML
    .replace(/\*\*/g, '') // Remove markdown bold
    .replace(/\[[^\]]*\]\([^)]*\)/g, '') // Remove markdown links
    .replace(/data-[\w-]+="[^"]*"/g, '') // Remove atributos data-* soltos
    .replace(/class="[^"]*"/g, '') // Remove atributos class soltos
    .replace(/id="[^"]*"/g, '') // Remove atributos id soltos
    .replace(/style="[^"]*"/g, '') // Remove atributos style soltos
    .replace(/title="[^"]*"/g, '') // Remove atributos title soltos
    .replace(/href="[^"]*"/g, '') // Remove atributos href soltos
    .replace(/\s+/g, ' ') // Normaliza espaços múltiplos
    .replace(/^["'\s]+|["'\s]+$/g, '') // Remove aspas e espaços das bordas
    .trim();

  // Se ainda não encontrou título, usa descrição padrão
  if (!titulo || titulo.length < 10) {
    titulo = `Orientação Normativa ${numeroDisplay}`;
  }

  // Trunca título para evitar problemas no banco (máx 150 caracteres)
  const MAX_TITLE_LENGTH = 150;
  if (titulo.length > MAX_TITLE_LENGTH) {
    titulo = titulo.substring(0, MAX_TITLE_LENGTH).trim() + '...';
  }

  // Extrai descrição (primeiros parágrafos após o título)
  const descricao = extractDescription(block, titulo);

  // Extrai todos os links de fundamentação
  const fundamentacaoLinks = extractFundamentacaoLinks(block);

  // Link principal de fundamentação (primeiro da lista)
  const linkFundamentacao = fundamentacaoLinks[0];

  // Extrai link do DOU
  const linkDOU = extractDouLink(block);

  // Detecta versão histórica
  const versaoHistorica = extractVersaoHistorica(block);

  // Extrai tags relevantes
  const tags = extractTags(block, numeroDisplay);

  return {
    numero: numeroDisplay,
    ano,
    numeroCompleto,
    titulo: titulo || `Orientação Normativa ${numeroDisplay}`,
    descricao,
    linkDOU,
    linkFundamentacao,
    fundamentacaoLinks,
    tags,
    versaoHistorica,
  };
}

/**
 * Extrai descrição do bloco de conteúdo
 */
function extractDescription(block: string, titulo: string): string {
  // Remove título da descrição
  let content = block.replace(titulo, '');

  // Remove tags HTML e markdown
  content = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '');

  // Pega os primeiros parágrafos significativos
  const paragraphs = content
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 30 && !p.match(/^(Fundamentação|Publicação|DOU|Redação)/i))
    .slice(0, 3);

  return paragraphs.join(' ').substring(0, 500).trim();
}

/**
 * Extrai TODOS os links de fundamentação do bloco
 * Suporta múltiplos formatos:
 * - [Fundamentação](URL)
 * - Fundamentação ([1](URL1), [2](URL2))
 * - Links diretos para PDF
 */
function extractFundamentacaoLinks(block: string): string[] {
  const links = new Set<string>();

  // Padrão 1: [Fundamentação](URL)
  const fundamentacaoPattern = /\[Fundamentação\]\(([^)]+)\)/gi;
  let match;
  while ((match = fundamentacaoPattern.exec(block)) !== null) {
    links.add(normalizeUrl(match[1]));
  }

  // Padrão 2: Links numerados - Fundamentação ([1](URL1), [2](URL2))
  const numberedPattern = /Fundamentação\s*\([^)]*\[(\d+)\]\(([^)]+)\)[^)]*\)/gi;
  while ((match = numberedPattern.exec(block)) !== null) {
    links.add(normalizeUrl(match[2]));
  }

  // Padrão 3: Links diretos para PDFs do AGU
  const pdfPattern = /href="([^"]*fundamentacao[^"]*\.pdf[^"]*)"/gi;
  while ((match = pdfPattern.exec(block)) !== null) {
    links.add(normalizeUrl(match[1]));
  }

  // Padrão 4: Links para sistema SAPIENS
  const sapiensPattern = /sapiens\.agu\.gov\.br[^"\s]*/gi;
  while ((match = sapiensPattern.exec(block)) !== null) {
    links.add(normalizeUrl(match[0]));
  }

  return Array.from(links).filter(isValidUrl);
}

/**
 * Extrai link para publicação no DOU
 */
function extractDouLink(block: string): string | undefined {
  const douPatterns = [
    /\[(?:Publicação no )?DOU\]\(([^)]+)\)/i,
    /href="([^"]*in\.gov\.br[^"]*)"/i,
    /href="([^"]*dou[^"]*)"/i,
  ];

  for (const pattern of douPatterns) {
    const match = block.match(pattern);
    if (match) {
      const url = normalizeUrl(match[1]);
      if (isValidUrl(url)) return url;
    }
  }

  return undefined;
}

/**
 * Detecta se é uma versão histórica (redação original, etc)
 */
function extractVersaoHistorica(block: string): string | undefined {
  const versaoMatch = block.match(/(Redação\s+(original\s+)?de\s+\d{4})/i);
  return versaoMatch ? versaoMatch[1] : undefined;
}

/**
 * Normaliza URLs (adiciona protocolo e domínio se necessário)
 */
function normalizeUrl(url: string): string {
  url = url.trim();

  // Se já é uma URL completa, retorna
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Se começa com //, adiciona https:
  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  // Se é um path relativo do gov.br, adiciona o domínio
  if (url.startsWith('/')) {
    return `https://www.gov.br${url}`;
  }

  // Se é um domínio sem protocolo
  if (url.includes('gov.br') || url.includes('in.gov.br')) {
    return `https://${url}`;
  }

  return url;
}

/**
 * Valida se uma URL é válida e acessível
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Aceita apenas URLs http/https
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extrai tags relevantes do conteúdo
 */
function extractTags(content: string, numero: string): string[] {
  const tags: Set<string> = new Set(['AGU', numero]);

  const cleanContent = content.toLowerCase();

  // Temas comuns
  const temas = [
    { keyword: 'licitação|licitacao', tag: 'Licitação' },
    { keyword: 'contrato', tag: 'Contratos' },
    { keyword: 'dispensa|inexigibilidade', tag: 'Contratação Direta' },
    { keyword: 'pregão|pregao', tag: 'Pregão' },
    { keyword: 'registro de preços', tag: 'Registro de Preços' },
    { keyword: 'lei 14.133|lei 14133', tag: 'Lei 14.133/2021' },
    { keyword: 'lei 8.666|lei 8666', tag: 'Lei 8.666/93' },
    { keyword: 'convênio|convenio', tag: 'Convênios' },
    { keyword: 'parceria', tag: 'Parcerias' },
    { keyword: 'fiscal', tag: 'Fiscalização' },
    { keyword: 'gestão|gestao', tag: 'Gestão' },
    { keyword: 'terceirização|terceirizacao', tag: 'Terceirização' },
    { keyword: 'administrativo', tag: 'Direito Administrativo' },
  ];

  for (const { keyword, tag } of temas) {
    if (new RegExp(keyword, 'i').test(cleanContent)) {
      tags.add(tag);
    }
  }

  return Array.from(tags);
}

/**
 * Converte Orientações para formato de documento para importação
 * VERSÃO MELHORADA: Cria múltiplos documentos quando há vários links de fundamentação
 */
export function convertOrientacoesToDocuments(
  orientacoes: OrientacaoNormativa[]
): Array<{
  title: string;
  description: string;
  category: string;
  url: string;
  tags: string[];
  isPublic: boolean;
}> {
  const documents: Array<{
    title: string;
    description: string;
    category: string;
    url: string;
    tags: string[];
    isPublic: boolean;
  }> = [];

  for (const on of orientacoes) {
    // IMPORTANTE: Não cria documentos sem links de fundamentação (PDFs)
    // Os links do DOU (in.gov.br) estão quebrados, então só usamos PDFs válidos
    if (on.fundamentacaoLinks.length === 0) {
      console.log(`[AGU Scraper] ⚠️ Pulando ${on.numero} - sem links de fundamentação (PDF)`);
      continue; // Pula ONs sem PDFs
    }

    // Se tem apenas 1 link de fundamentação, cria 1 documento
    if (on.fundamentacaoLinks.length === 1) {
      documents.push({
        title: `${on.numero} - ${on.titulo}`,
        description: on.descricao || `Orientação Normativa da AGU nº ${on.numeroCompleto}`,
        category: 'orientacao-normativa',
        url: on.fundamentacaoLinks[0],
        tags: on.tags,
        isPublic: true,
      });
      continue;
    }

    // Se tem múltiplos links de fundamentação, cria documento para cada um
    on.fundamentacaoLinks.forEach((link, index) => {
      const suffix = index === 0 ? '' : ` (Fundamentação ${index + 1})`;
      const versionSuffix = on.versaoHistorica ? ` - ${on.versaoHistorica}` : '';

      documents.push({
        title: `${on.numero}${suffix}${versionSuffix} - ${on.titulo}`,
        description: on.descricao || `Orientação Normativa da AGU nº ${on.numeroCompleto}`,
        category: 'orientacao-normativa',
        url: link,
        tags: [...on.tags, index === 0 ? 'Fundamentação Principal' : `Fundamentação ${index + 1}`],
        isPublic: true,
      });
    });
  }

  return documents;
}

/**
 * Gera planilha Excel com as orientações para revisão manual
 */
export function generateOrientacoesExcel(orientacoes: OrientacaoNormativa[]): string[][] {
  const headers = ['Titulo', 'Descricao', 'Categoria', 'Curso', 'Publico', 'Tags', 'Artigos', 'URL', 'Arquivo'];

  const rows = orientacoes
    .filter(on => on.fundamentacaoLinks.length > 0) // Só inclui ONs com PDFs
    .map(on => [
      `${on.numero} - ${on.titulo}`,
      on.descricao || `Orientação Normativa da AGU nº ${on.numeroCompleto}`,
      'orientacao-normativa',
      'TODOS', // Adiciona a todos os cursos
      'Sim',
      on.tags.join(', '),
      '', // Artigos (vazio)
      on.linkFundamentacao || '', // Usa apenas link de fundamentação (PDF)
      '', // Arquivo (vazio - é link externo)
    ]);

  return [headers, ...rows];
}
