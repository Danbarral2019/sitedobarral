import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function checkUrl(url: string): Promise<{ status: number; redirectsToLogin: boolean; finalUrl: string }> {
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
    const finalUrl = response.url;
    const text = await response.text();

    // Check if it redirects to a login page
    const redirectsToLogin =
      finalUrl.includes('/login') ||
      finalUrl.includes('/auth') ||
      finalUrl.includes('/signin') ||
      text.includes('Fazer login') ||
      text.includes('fazer login') ||
      text.includes('Entrar no sistema') ||
      text.includes('Autenticação') ||
      text.includes('autenticacao') ||
      text.includes('Login') && text.includes('Senha') && !text.includes('validacao-assinatura') ||
      text.includes('gov.br/conecta') ||
      text.includes('sso.acesso.gov.br') ||
      text.includes('accounts.acesso.gov.br');

    return { status: response.status, redirectsToLogin, finalUrl };
  } catch (error) {
    return { status: 0, redirectsToLogin: true, finalUrl: url };
  }
}

async function main() {
  const sapiensDocs = await prisma.document.findMany({
    where: {
      OR: [
        { url: { contains: 'sapiens.agu.gov.br' } },
        { url: { contains: 'supersapiens.agu.gov.br' } },
      ]
    },
    select: { id: true, title: true, url: true },
    orderBy: { title: 'asc' }
  });

  console.log(`Verificando ${sapiensDocs.length} documentos com URLs Sapiens...\n`);

  let publicCount = 0;
  let loginCount = 0;
  let errorCount = 0;
  const loginDocs: { id: string; title: string; url: string; finalUrl: string }[] = [];
  const publicDocs: { id: string; title: string }[] = [];

  // Process in batches of 5 to avoid overwhelming the server
  for (let i = 0; i < sapiensDocs.length; i += 5) {
    const batch = sapiensDocs.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (doc) => {
        const result = await checkUrl(doc.url);
        return { doc, result };
      })
    );

    for (const { doc, result } of results) {
      if (result.status === 0) {
        errorCount++;
        loginDocs.push({ id: doc.id, title: doc.title, url: doc.url, finalUrl: 'TIMEOUT/ERROR' });
        console.log(`  [ERRO] ${doc.title.substring(0, 80)}`);
      } else if (result.redirectsToLogin || result.status === 401 || result.status === 403) {
        loginCount++;
        loginDocs.push({ id: doc.id, title: doc.title, url: doc.url, finalUrl: result.finalUrl });
        console.log(`  [LOGIN] ${doc.title.substring(0, 80)} → ${result.finalUrl.substring(0, 60)}`);
      } else {
        publicCount++;
        publicDocs.push({ id: doc.id, title: doc.title });
        console.log(`  [OK] ${doc.title.substring(0, 80)} (${result.status})`);
      }
    }

    // Progress
    console.log(`  --- Progresso: ${Math.min(i + 5, sapiensDocs.length)}/${sapiensDocs.length} ---`);
  }

  console.log('\n=== RESUMO ===');
  console.log(`Públicos (OK): ${publicCount}`);
  console.log(`Exigem login: ${loginCount}`);
  console.log(`Erro/Timeout: ${errorCount}`);
  console.log(`\nDocumentos que exigem login ou falharam (${loginDocs.length}):`);
  for (const doc of loginDocs) {
    console.log(`  ${doc.id} | ${doc.title.substring(0, 70)} | ${doc.finalUrl.substring(0, 60)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
