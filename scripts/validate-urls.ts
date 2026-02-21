import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

// ============================================================================
// Types
// ============================================================================

interface UrlCheckResult {
  url: string;
  status: number;
  ok: boolean;
  redirectsToLogin: boolean;
  finalUrl: string;
  error?: string;
}

interface RecordUrl {
  table: string;
  id: string;
  title: string;
  field: string; // 'url' | 'officialUrl' | 'pdfUrl' | 'tcuLinkPDF' | 'douUrl'
  url: string;
}

// ============================================================================
// URL Checker
// ============================================================================

const LOGIN_INDICATORS = [
  'login', 'sapiens', 'autenticação', 'autenticacao',
  'fazer login', 'entrar no sistema', 'gov.br/conecta',
  'sso.acesso.gov.br', 'accounts.acesso.gov.br',
  'signin', 'sign-in', 'conecte-se',
];

async function checkUrl(url: string): Promise<UrlCheckResult> {
  // Skip non-HTTP URLs (data:, blob:, etc.)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { url, status: 0, ok: false, redirectsToLogin: false, finalUrl: url, error: 'Non-HTTP URL' };
  }

  try {
    // Try HEAD first (lighter)
    const headController = new AbortController();
    const headTimeout = setTimeout(() => headController.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: headController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(headTimeout);

      // Some servers return 405 for HEAD, fallback to GET
      if (response.status === 405 || response.status === 501) {
        throw new Error('HEAD not allowed, fallback to GET');
      }

      // For HEAD, we can't check body for login pages, so only check URL and status
      const finalUrl = response.url;
      const redirectsToLogin = finalUrl.toLowerCase().includes('/login') ||
        finalUrl.toLowerCase().includes('/signin') ||
        finalUrl.toLowerCase().includes('/auth');

      return {
        url,
        status: response.status,
        ok: response.status >= 200 && response.status < 400,
        redirectsToLogin,
        finalUrl,
      };
    } catch {
      clearTimeout(headTimeout);
      // Fallback to GET
    }

    // GET fallback
    const getController = new AbortController();
    const getTimeout = setTimeout(() => getController.abort(), 20000);

    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: getController.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(getTimeout);

    const finalUrl = response.url;

    // Read partial body to check for login indicators (limit to 50KB)
    let bodySnippet = '';
    try {
      const reader = response.body?.getReader();
      if (reader) {
        let totalBytes = 0;
        const maxBytes = 50 * 1024;
        const chunks: Uint8Array[] = [];
        while (totalBytes < maxBytes) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalBytes += value.length;
        }
        reader.cancel();
        bodySnippet = new TextDecoder().decode(Buffer.concat(chunks)).toLowerCase();
      }
    } catch {
      // Ignore body read errors
    }

    const redirectsToLogin = LOGIN_INDICATORS.some(indicator =>
      bodySnippet.includes(indicator) || finalUrl.toLowerCase().includes(indicator)
    );

    return {
      url,
      status: response.status,
      ok: response.status >= 200 && response.status < 400,
      redirectsToLogin,
      finalUrl,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = message.includes('abort') || message.includes('timeout');
    return {
      url,
      status: 0,
      ok: false,
      redirectsToLogin: false,
      finalUrl: url,
      error: isTimeout ? 'TIMEOUT (20s)' : message,
    };
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  console.log('='.repeat(80));
  console.log('  VALIDADOR DE URLs - Documentos e Atos Legislativos');
  console.log(`  Data de corte: ${threeDaysAgo.toISOString().split('T')[0]} (ultimos 3 dias)`);
  console.log('='.repeat(80));
  console.log();

  // ---- 1. Fetch Documents ----
  const recentDocs = await prisma.document.findMany({
    where: { uploadedAt: { gte: threeDaysAgo } },
    select: {
      id: true,
      title: true,
      url: true,
      douUrl: true,
      tcuLinkPDF: true,
      category: true,
      uploadedAt: true,
    },
    orderBy: { uploadedAt: 'desc' },
  });

  // ---- 2. Fetch LegislativeActs ----
  const recentActs = await prisma.legislativeAct.findMany({
    where: { createdAt: { gte: threeDaysAgo } },
    select: {
      id: true,
      fullNumber: true,
      title: true,
      officialUrl: true,
      pdfUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Documentos inseridos nos ultimos 3 dias: ${recentDocs.length}`);
  console.log(`Atos legislativos inseridos nos ultimos 3 dias: ${recentActs.length}`);
  console.log();

  // ---- 3. Build URL list ----
  const urlsToCheck: RecordUrl[] = [];

  for (const doc of recentDocs) {
    if (doc.url) {
      urlsToCheck.push({
        table: 'Document',
        id: doc.id,
        title: doc.title,
        field: 'url',
        url: doc.url,
      });
    }
    if (doc.douUrl) {
      urlsToCheck.push({
        table: 'Document',
        id: doc.id,
        title: doc.title,
        field: 'douUrl',
        url: doc.douUrl,
      });
    }
    if (doc.tcuLinkPDF) {
      urlsToCheck.push({
        table: 'Document',
        id: doc.id,
        title: doc.title,
        field: 'tcuLinkPDF',
        url: doc.tcuLinkPDF,
      });
    }
  }

  for (const act of recentActs) {
    if (act.officialUrl) {
      urlsToCheck.push({
        table: 'LegislativeAct',
        id: act.id,
        title: act.fullNumber || act.title,
        field: 'officialUrl',
        url: act.officialUrl,
      });
    }
    if (act.pdfUrl) {
      urlsToCheck.push({
        table: 'LegislativeAct',
        id: act.id,
        title: act.fullNumber || act.title,
        field: 'pdfUrl',
        url: act.pdfUrl,
      });
    }
  }

  // Deduplicate by URL
  const uniqueUrls = new Map<string, RecordUrl[]>();
  for (const entry of urlsToCheck) {
    const existing = uniqueUrls.get(entry.url);
    if (existing) {
      existing.push(entry);
    } else {
      uniqueUrls.set(entry.url, [entry]);
    }
  }

  const totalUrls = urlsToCheck.length;
  const uniqueCount = uniqueUrls.size;
  console.log(`Total de URLs a verificar: ${totalUrls} (${uniqueCount} unicas)`);
  console.log();

  if (uniqueCount === 0) {
    console.log('Nenhuma URL encontrada para verificar. Encerrando.');
    return;
  }

  // ---- 4. Check URLs in batches ----
  const okResults: { entry: RecordUrl; result: UrlCheckResult }[] = [];
  const errorResults: { entry: RecordUrl; result: UrlCheckResult }[] = [];
  const loginResults: { entry: RecordUrl; result: UrlCheckResult }[] = [];

  const urlEntries = Array.from(uniqueUrls.entries());
  const batchSize = 5;

  for (let i = 0; i < urlEntries.length; i += batchSize) {
    const batch = urlEntries.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async ([url, entries]) => {
        const result = await checkUrl(url);
        return { entries, result };
      })
    );

    for (const { entries, result } of results) {
      const primaryEntry = entries[0];

      if (result.error || (!result.ok && !result.redirectsToLogin)) {
        // Error (404, 403, timeout, etc.)
        errorResults.push({ entry: primaryEntry, result });
        const statusStr = result.error || `HTTP ${result.status}`;
        console.log(`  [ERRO]  ${statusStr.padEnd(20)} ${primaryEntry.title.substring(0, 60)}`);
      } else if (result.redirectsToLogin) {
        // Redirects to login
        loginResults.push({ entry: primaryEntry, result });
        console.log(`  [LOGIN] HTTP ${result.status}             ${primaryEntry.title.substring(0, 60)}`);
      } else {
        // OK
        okResults.push({ entry: primaryEntry, result });
        console.log(`  [OK]    HTTP ${result.status}             ${primaryEntry.title.substring(0, 60)}`);
      }

      // Log duplicate entries for same URL
      if (entries.length > 1) {
        for (let j = 1; j < entries.length; j++) {
          console.log(`          ^ tambem usado por: ${entries[j].table}.${entries[j].field} (${entries[j].title.substring(0, 40)})`);
        }
      }
    }

    const progress = Math.min(i + batchSize, urlEntries.length);
    console.log(`  --- Progresso: ${progress}/${urlEntries.length} URLs verificadas ---`);
  }

  // ---- 5. Summary Report ----
  console.log();
  console.log('='.repeat(80));
  console.log('  RELATORIO FINAL');
  console.log('='.repeat(80));
  console.log();
  console.log(`  URLs OK (2xx/3xx):              ${okResults.length}`);
  console.log(`  URLs com erro (4xx/5xx/timeout): ${errorResults.length}`);
  console.log(`  URLs que redirecionam p/ login:  ${loginResults.length}`);
  console.log(`  Total verificado:                ${uniqueCount}`);
  console.log();

  // ---- Detail: Errors ----
  if (errorResults.length > 0) {
    console.log('-'.repeat(80));
    console.log('  URLS COM ERRO');
    console.log('-'.repeat(80));
    for (const { entry, result } of errorResults) {
      console.log();
      console.log(`  Tabela:  ${entry.table}`);
      console.log(`  Campo:   ${entry.field}`);
      console.log(`  Titulo:  ${entry.title}`);
      console.log(`  URL:     ${entry.url}`);
      console.log(`  Status:  ${result.error || `HTTP ${result.status}`}`);
      if (result.finalUrl !== entry.url) {
        console.log(`  Redir:   ${result.finalUrl}`);
      }
      console.log(`  ID:      ${entry.id}`);
    }
  }

  // ---- Detail: Login redirects ----
  if (loginResults.length > 0) {
    console.log();
    console.log('-'.repeat(80));
    console.log('  URLS QUE REDIRECIONAM PARA LOGIN');
    console.log('-'.repeat(80));
    for (const { entry, result } of loginResults) {
      console.log();
      console.log(`  Tabela:  ${entry.table}`);
      console.log(`  Campo:   ${entry.field}`);
      console.log(`  Titulo:  ${entry.title}`);
      console.log(`  URL:     ${entry.url}`);
      console.log(`  Status:  HTTP ${result.status}`);
      if (result.finalUrl !== entry.url) {
        console.log(`  Redir:   ${result.finalUrl}`);
      }
      console.log(`  ID:      ${entry.id}`);
    }
  }

  // ---- Detail: OK ----
  if (okResults.length > 0) {
    console.log();
    console.log('-'.repeat(80));
    console.log('  URLS OK');
    console.log('-'.repeat(80));
    for (const { entry, result } of okResults) {
      console.log(`  [${result.status}] ${entry.table}.${entry.field.padEnd(12)} ${entry.title.substring(0, 60)}`);
    }
  }

  console.log();
  console.log('='.repeat(80));
  console.log('  Validacao concluida. Nenhuma modificacao feita no banco de dados.');
  console.log('='.repeat(80));
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
