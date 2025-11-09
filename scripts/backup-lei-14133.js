/**
 * 🔒 BACKUP SCRIPT - Lei 14.133/2021 Articles
 *
 * Purpose: Export all 193 manually edited articles to JSON for version control
 *
 * Usage:
 *   node scripts/backup-lei-14133.js
 *
 * Output:
 *   data/backups/lei-14133-YYYY-MM-DD-HHmm.json
 *
 * CRITICAL: Run this before ANY schema changes to LeiArticle model!
 */

// Load environment variables from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
const EXPECTED_COUNT = 193;

async function main() {
  console.log('🔒 Lei 14.133 Backup Script');
  console.log('='.repeat(50));
  console.log('');

  try {
    // 1. Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log('✅ Created backup directory:', BACKUP_DIR);
    }

    // 2. Fetch all articles from database
    console.log('📊 Fetching articles from PostgreSQL...');
    const articles = await prisma.leiArticle.findMany({
      orderBy: { numero: 'asc' }
    });

    console.log(`   Found: ${articles.length} articles`);

    // 3. Validate count
    if (articles.length !== EXPECTED_COUNT) {
      console.warn('');
      console.warn('⚠️  WARNING: Expected 193 articles but found ' + articles.length);
      console.warn('   This may indicate data loss!');
      console.warn('');
    }

    // 4. Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `lei-14133-${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    // 5. Prepare backup data with metadata
    const backup = {
      metadata: {
        exportedAt: new Date().toISOString(),
        articleCount: articles.length,
        expectedCount: EXPECTED_COUNT,
        version: '1.0',
        description: 'Backup completo dos 193 artigos da Lei 14.133/2021 editados manualmente'
      },
      articles: articles.map(article => ({
        numero: article.numero,
        ementa: article.ementa,
        capitulo: article.capitulo,
        secao: article.secao,
        titulo: article.titulo,
        capituloCompleto: article.capituloCompleto,
        onNumber: article.onNumber,
        onYear: article.onYear,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt
      }))
    };

    // 6. Write to file
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf-8');

    console.log('');
    console.log('✅ Backup saved successfully!');
    console.log('');
    console.log('📁 File:', filepath);
    console.log('📊 Size:', (fs.statSync(filepath).size / 1024).toFixed(2), 'KB');
    console.log('📝 Articles:', articles.length);
    console.log('');

    // 7. Show statistics
    const truncatedCount = articles.filter(a => {
      const suspicious = /\s(do|da|de|dos|das|no|na|nos|nas|ao|à|aos|às|com|por|para|pelo|pela|que|se|e|ou)\s*$/i.test(a.ementa);
      return suspicious || a.ementa.length < 100;
    }).length;

    console.log('📈 Statistics:');
    console.log(`   Complete articles: ${articles.length - truncatedCount}`);
    console.log(`   Truncated articles: ${truncatedCount}`);
    console.log('');

    // 8. Next steps
    console.log('📋 Next Steps:');
    console.log('   1. git add ' + filepath);
    console.log('   2. git commit -m "backup: Lei 14.133 snapshot após edição manual"');
    console.log('   3. git push origin main');
    console.log('');
    console.log('💡 To restore from this backup:');
    console.log('   node scripts/restore-lei-14133.js ' + filepath);
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error);
    console.error('');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
