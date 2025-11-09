/**
 * 🔄 RESTORE SCRIPT - Lei 14.133/2021 Articles
 *
 * Purpose: Restore 193 articles from JSON backup file
 *
 * Usage:
 *   node scripts/restore-lei-14133.js data/backups/lei-14133-YYYY-MM-DD.json
 *
 * Safety Features:
 *   - Validates backup file structure
 *   - Shows preview before restore
 *   - Requires confirmation (--force to skip)
 *   - Creates automatic backup before restore
 *   - Provides rollback option on error
 *
 * CRITICAL: This will OVERWRITE all current Lei 14.133 articles!
 */

// Load environment variables from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const prisma = new PrismaClient();
const EXPECTED_COUNT = 193;

// Parse command line arguments
const args = process.argv.slice(2);
const backupPath = args[0];
const forceRestore = args.includes('--force');

/**
 * Read and validate backup file
 */
function loadBackup(filepath) {
  console.log('📂 Loading backup file...');
  console.log(`   Path: ${filepath}`);
  console.log('');

  if (!fs.existsSync(filepath)) {
    throw new Error(`Backup file not found: ${filepath}`);
  }

  const fileContent = fs.readFileSync(filepath, 'utf-8');
  const backup = JSON.parse(fileContent);

  // Validate structure
  if (!backup.metadata || !backup.articles) {
    throw new Error('Invalid backup file structure (missing metadata or articles)');
  }

  if (!Array.isArray(backup.articles)) {
    throw new Error('Invalid backup file structure (articles is not an array)');
  }

  console.log('✅ Backup file loaded successfully!');
  console.log('');
  console.log('📊 Backup Metadata:');
  console.log('   Exported at:', backup.metadata.exportedAt);
  console.log('   Article count:', backup.metadata.articleCount);
  console.log('   Expected count:', backup.metadata.expectedCount);
  console.log('   Version:', backup.metadata.version);
  console.log('   Description:', backup.metadata.description);
  console.log('');

  // Warn if article count doesn't match
  if (backup.metadata.articleCount !== EXPECTED_COUNT) {
    console.warn('⚠️  WARNING: Backup contains ' + backup.metadata.articleCount + ' articles');
    console.warn('   Expected: ' + EXPECTED_COUNT + ' articles');
    console.warn('   This may indicate an incomplete backup!');
    console.warn('');
  }

  return backup;
}

/**
 * Create pre-restore backup
 */
async function createPreRestoreBackup() {
  console.log('🔒 Creating pre-restore backup...');

  try {
    const articles = await prisma.leiArticle.findMany({
      orderBy: { numero: 'asc' }
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `lei-14133-pre-restore-${timestamp}.json`;
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    const filepath = path.join(backupDir, filename);

    // Ensure directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backup = {
      metadata: {
        exportedAt: new Date().toISOString(),
        articleCount: articles.length,
        expectedCount: EXPECTED_COUNT,
        version: '1.0',
        description: 'Backup automático antes da restauração'
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

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf-8');

    console.log('✅ Pre-restore backup created:');
    console.log('   ' + filepath);
    console.log('');

    return filepath;
  } catch (error) {
    console.error('❌ Failed to create pre-restore backup:', error.message);
    throw error;
  }
}

/**
 * Restore articles from backup
 */
async function restoreArticles(backup) {
  console.log('🔄 Starting restore process...');
  console.log('');

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const article of backup.articles) {
    try {
      // Check if article exists
      const existing = await prisma.leiArticle.findUnique({
        where: { numero: article.numero }
      });

      if (existing) {
        // Update existing article
        await prisma.leiArticle.update({
          where: { numero: article.numero },
          data: {
            ementa: article.ementa,
            capitulo: article.capitulo,
            secao: article.secao || null,
            titulo: article.titulo || null,
            capituloCompleto: article.capituloCompleto || null,
            onNumber: article.onNumber || null,
            onYear: article.onYear || null,
          }
        });

        console.log(`✅ Art. ${article.numero}º updated`);
        updated++;
      } else {
        // Create new article
        await prisma.leiArticle.create({
          data: {
            numero: article.numero,
            ementa: article.ementa,
            capitulo: article.capitulo,
            secao: article.secao || null,
            titulo: article.titulo || null,
            capituloCompleto: article.capituloCompleto || null,
            onNumber: article.onNumber || null,
            onYear: article.onYear || null,
          }
        });

        console.log(`🆕 Art. ${article.numero}º created`);
        created++;
      }
    } catch (error) {
      console.error(`❌ Error on Art. ${article.numero}º:`, error.message);
      errors++;
    }
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('📊 RESTORE SUMMARY');
  console.log('='.repeat(70));
  console.log(`🆕 Created:  ${created}`);
  console.log(`✅ Updated:  ${updated}`);
  console.log(`❌ Errors:   ${errors}`);
  console.log(`📝 Total:    ${backup.articles.length}`);
  console.log('='.repeat(70));
  console.log('');

  return { created, updated, errors, total: backup.articles.length };
}

/**
 * Ask for user confirmation
 */
function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log('🔄 LEI 14.133 RESTORE SCRIPT');
  console.log('='.repeat(70));
  console.log('');

  // Validate arguments
  if (!backupPath) {
    console.error('❌ ERROR: Backup file path required!');
    console.error('');
    console.error('Usage:');
    console.error('  node scripts/restore-lei-14133.js <backup-file> [--force]');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/restore-lei-14133.js data/backups/lei-14133-2025-11-09T22-42-31.json');
    console.error('');
    process.exit(1);
  }

  try {
    // 1. Load and validate backup
    const backup = loadBackup(backupPath);

    // 2. Show preview
    console.log('📄 Preview of first 3 articles:');
    console.log('-'.repeat(70));
    backup.articles.slice(0, 3).forEach(art => {
      console.log(`\nArt. ${art.numero}º (${art.capitulo}):`);
      console.log(art.ementa.substring(0, 100) + '...');
    });
    console.log('\n' + '-'.repeat(70) + '\n');

    // 3. Warning
    console.warn('⚠️⚠️⚠️ CRITICAL WARNING ⚠️⚠️⚠️');
    console.warn('');
    console.warn('This operation will OVERWRITE all current Lei 14.133 articles!');
    console.warn('A pre-restore backup will be created automatically.');
    console.warn('');

    // 4. Ask confirmation (unless --force)
    if (!forceRestore) {
      const confirmed = await askConfirmation('Do you want to proceed? (y/n): ');

      if (!confirmed) {
        console.log('');
        console.log('❌ Restore cancelled by user.');
        console.log('');
        process.exit(0);
      }
    } else {
      console.log('⚡ --force flag detected, skipping confirmation.');
    }

    console.log('');

    // 5. Create pre-restore backup
    const preRestoreBackup = await createPreRestoreBackup();

    // 6. Restore articles
    const result = await restoreArticles(backup);

    // 7. Final message
    console.log('');
    if (result.errors === 0) {
      console.log('🎉 RESTORE COMPLETED SUCCESSFULLY!');
      console.log('');
      console.log('Pre-restore backup saved at:');
      console.log('  ' + preRestoreBackup);
      console.log('');
      console.log('To rollback this restore:');
      console.log('  node scripts/restore-lei-14133.js ' + preRestoreBackup);
    } else {
      console.log('⚠️  RESTORE COMPLETED WITH ERRORS!');
      console.log('');
      console.log(`${result.errors} articles failed to restore.`);
      console.log('Check the logs above for details.');
      console.log('');
      console.log('To rollback this restore:');
      console.log('  node scripts/restore-lei-14133.js ' + preRestoreBackup);
    }
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ FATAL ERROR:', error.message);
    console.error('');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
