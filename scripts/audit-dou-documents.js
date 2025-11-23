/**
 * Script de Auditoria de Documentos DOU
 *
 * Identifica todos os documentos DOU no banco de dados que não deveriam
 * estar visíveis na área de alunos.
 *
 * Critérios de identificação:
 * - Keywords: EXTRATO, CONTRATO, CAFIN, INEXIGIBILIDADE, AVISO
 * - Categoria contém "dou" ou "extrato"
 * - Campo douUrl preenchido mas não é documento AGU/oficial
 *
 * Uso: node scripts/audit-dou-documents.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

// Keywords que identificam documentos DOU indesejados
const DOU_KEYWORDS = [
  'EXTRATO DE CONTRATO',
  'AVISO DE INEXIGIBILIDADE',
  'AVISO DE LICITAÇÃO',
  'CAFIN',
  'UASG',
  'DISPENSA DE LICITAÇÃO',
  'PREGÃO ELETRÔNICO',
  'RESULTADO DE JULGAMENTO',
  'HOMOLOGAÇÃO',
  'ADJUDICAÇÃO'
];

// Categorias suspeitas
const SUSPICIOUS_CATEGORIES = [
  'dou',
  'extrato',
  'licitacao-dou',
  'contratos-dou'
];

async function auditDouDocuments() {
  console.log('🔍 Iniciando auditoria de documentos DOU...\n');

  try {
    // 1. Buscar documentos por keywords no título
    console.log('📋 Buscando documentos por keywords...');
    const keywordConditions = DOU_KEYWORDS.map(keyword => ({
      title: {
        contains: keyword,
        mode: 'insensitive'
      }
    }));

    const documentsByKeyword = await prisma.document.findMany({
      where: {
        OR: keywordConditions
      },
      select: {
        id: true,
        title: true,
        category: true,
        courseId: true,
        isCommon: true,
        douUrl: true,
        douData: true,
        url: true,
        uploadedAt: true,
        updatedAt: true
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    console.log(`   Encontrados ${documentsByKeyword.length} documentos por keyword\n`);

    // 2. Buscar documentos por categoria suspeita
    console.log('📂 Buscando documentos por categoria suspeita...');
    const documentsByCategory = await prisma.document.findMany({
      where: {
        category: {
          in: SUSPICIOUS_CATEGORIES
        }
      },
      select: {
        id: true,
        title: true,
        category: true,
        courseId: true,
        isCommon: true,
        douUrl: true,
        douData: true,
        url: true,
        uploadedAt: true,
        updatedAt: true
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    console.log(`   Encontrados ${documentsByCategory.length} documentos por categoria\n`);

    // 3. Buscar documentos com douUrl mas não são AGU
    console.log('🔗 Buscando documentos com douUrl suspeito...');
    const documentsByDouUrl = await prisma.document.findMany({
      where: {
        AND: [
          { douUrl: { not: null } },
          {
            NOT: {
              OR: [
                { onNumber: { not: null } }, // Não é ON da AGU
                { category: 'parecer-vinculante' }, // Não é Parecer
                { category: 'orientacao-normativa' }
              ]
            }
          }
        ]
      },
      select: {
        id: true,
        title: true,
        category: true,
        courseId: true,
        isCommon: true,
        douUrl: true,
        douData: true,
        url: true,
        onNumber: true,
        onYear: true,
        uploadedAt: true,
        updatedAt: true
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    console.log(`   Encontrados ${documentsByDouUrl.length} documentos com douUrl suspeito\n`);

    // 4. Unificar resultados (remover duplicatas)
    const allDocumentsMap = new Map();

    [...documentsByKeyword, ...documentsByCategory, ...documentsByDouUrl].forEach(doc => {
      if (!allDocumentsMap.has(doc.id)) {
        allDocumentsMap.set(doc.id, doc);
      }
    });

    const allDocuments = Array.from(allDocumentsMap.values());

    // 5. Gerar relatório detalhado
    console.log('📊 RELATÓRIO DE AUDITORIA');
    console.log('='.repeat(80));
    console.log(`Total de documentos DOU encontrados: ${allDocuments.length}\n`);

    if (allDocuments.length === 0) {
      console.log('✅ Nenhum documento DOU indesejado encontrado!');
      return;
    }

    // Agrupar por categoria
    const byCategory = {};
    allDocuments.forEach(doc => {
      const cat = doc.category || 'sem-categoria';
      if (!byCategory[cat]) {
        byCategory[cat] = [];
      }
      byCategory[cat].push(doc);
    });

    console.log('📂 Documentos por categoria:');
    Object.entries(byCategory).forEach(([category, docs]) => {
      console.log(`   ${category}: ${docs.length} documentos`);
    });
    console.log('');

    // Agrupar por curso
    const byCourse = {};
    allDocuments.forEach(doc => {
      const course = doc.courseId || (doc.isCommon ? 'comum' : 'sem-curso');
      if (!byCourse[course]) {
        byCourse[course] = [];
      }
      byCourse[course].push(doc);
    });

    console.log('🎓 Documentos por curso:');
    Object.entries(byCourse).forEach(([courseId, docs]) => {
      console.log(`   Curso ${courseId}: ${docs.length} documentos`);
    });
    console.log('');

    // Mostrar primeiros 10 documentos
    console.log('📄 Primeiros 10 documentos encontrados:');
    allDocuments.slice(0, 10).forEach((doc, index) => {
      console.log(`\n${index + 1}. ID: ${doc.id}`);
      console.log(`   Título: ${doc.title.substring(0, 80)}...`);
      console.log(`   Categoria: ${doc.category || 'N/A'}`);
      console.log(`   Curso: ${doc.courseId || (doc.isCommon ? 'Comum' : 'N/A')}`);
      console.log(`   Criado em: ${doc.uploadedAt.toISOString().split('T')[0]}`);
    });

    if (allDocuments.length > 10) {
      console.log(`\n... e mais ${allDocuments.length - 10} documentos`);
    }

    // 6. Salvar relatório completo em JSON
    const reportPath = path.join(__dirname, '..', 'data', 'backups', 'dou-audit-report.json');

    // Criar diretório se não existir
    await fs.mkdir(path.dirname(reportPath), { recursive: true });

    const report = {
      auditDate: new Date().toISOString(),
      totalDocuments: allDocuments.length,
      byCategory,
      byCourse,
      documents: allDocuments.map(doc => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        courseId: doc.courseId,
        isCommon: doc.isCommon,
        douUrl: doc.douUrl,
        url: doc.url,
        uploadedAt: doc.uploadedAt
      }))
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Relatório completo salvo em: ${reportPath}`);

    // 7. Verificar dependências (favorites, versions, access logs)
    console.log('\n🔗 Verificando dependências...');

    const documentIds = allDocuments.map(d => d.id);

    const [favorites, versions, accessLogs] = await Promise.all([
      prisma.favorite.count({
        where: { documentId: { in: documentIds } }
      }),
      prisma.documentVersion.count({
        where: { documentId: { in: documentIds } }
      }),
      prisma.accessLog.count({
        where: {
          resourceType: 'document',
          resourceId: { in: documentIds }
        }
      })
    ]);

    console.log(`   Favorites: ${favorites}`);
    console.log(`   Versões: ${versions}`);
    console.log(`   Logs de acesso: ${accessLogs}`);

    // 8. Avisos e próximos passos
    console.log('\n⚠️  PRÓXIMOS PASSOS:');
    console.log('1. Revisar o relatório em data/backups/dou-audit-report.json');
    console.log('2. Confirmar que os documentos listados devem ser excluídos');
    console.log('3. Executar: node scripts/delete-dou-documents.js');
    console.log('   (Este script criará backup automático antes da exclusão)');

  } catch (error) {
    console.error('❌ Erro durante auditoria:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar auditoria
auditDouDocuments()
  .then(() => {
    console.log('\n✅ Auditoria concluída com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Auditoria falhou:', error);
    process.exit(1);
  });
