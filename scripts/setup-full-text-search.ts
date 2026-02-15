/**
 * Setup Full-Text Search — PostgreSQL tsvector + GIN indexes
 *
 * Este script configura busca textual completa com stemming português,
 * tratamento de acentos (unaccent), e ranking por relevância (ts_rank).
 *
 * Tabelas afetadas (7):
 *   Document, GlossaryTerm, LegislativeAct, CourseVideo,
 *   RecommendedSite, BlogPost, FAQ
 *
 * Uso:
 *   npx tsx scripts/setup-full-text-search.ts             # Setup completo (DDL + backfill)
 *   npx tsx scripts/setup-full-text-search.ts --dry-run   # Simular sem alterar
 *   npx tsx scripts/setup-full-text-search.ts --backfill  # Só backfill (pular DDL)
 *   npx tsx scripts/setup-full-text-search.ts --verify    # Verificar status
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['error', 'warn'] });

// ===========================
// Configuration
// ===========================

interface SetupOptions {
  dryRun: boolean;
  backfillOnly: boolean;
  verify: boolean;
}

interface TableConfig {
  table: string;
  weightA: string; // title fields (highest priority)
  weightB: string; // description fields
  weightC: string; // content fields (lowest priority)
  triggerFields: string[]; // columns that trigger search_vector update
}

const TABLES: TableConfig[] = [
  {
    table: 'Document',
    weightA: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.title, '')), 'A')`,
    weightB: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.description, '')), 'B')`,
    weightC: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.content, '') || ' ' || coalesce(NEW.tags, '')), 'C')`,
    triggerFields: ['title', 'description', 'content', 'tags'],
  },
  {
    table: 'GlossaryTerm',
    weightA: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.term, '')), 'A')`,
    weightB: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW."shortDef", '')), 'B')`,
    weightC: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.definition, '')), 'C')`,
    triggerFields: ['term', 'shortDef', 'definition'],
  },
  {
    table: 'LegislativeAct',
    weightA: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.title, '') || ' ' || coalesce(NEW."fullNumber", '')), 'A')`,
    weightB: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.ementa, '')), 'B')`,
    weightC: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.summary, '')), 'C')`,
    triggerFields: ['title', 'fullNumber', 'ementa', 'summary'],
  },
  {
    table: 'CourseVideo',
    weightA: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.title, '')), 'A')`,
    weightB: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.description, '')), 'B')`,
    weightC: `to_tsvector('portuguese_unaccent', '')`,
    triggerFields: ['title', 'description'],
  },
  {
    table: 'RecommendedSite',
    weightA: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.title, '')), 'A')`,
    weightB: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.description, '')), 'B')`,
    weightC: `to_tsvector('portuguese_unaccent', '')`,
    triggerFields: ['title', 'description'],
  },
  {
    table: 'BlogPost',
    weightA: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.title, '')), 'A')`,
    weightB: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.excerpt, '')), 'B')`,
    weightC: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.content, '') || ' ' || coalesce(NEW.tags, '')), 'C')`,
    triggerFields: ['title', 'excerpt', 'content', 'tags'],
  },
  {
    table: 'FAQ',
    weightA: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.question, '')), 'A')`,
    weightB: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.answer, '')), 'B')`,
    weightC: `setweight(to_tsvector('portuguese_unaccent', coalesce(NEW.keywords, '')), 'C')`,
    triggerFields: ['question', 'answer', 'keywords'],
  },
];

// ===========================
// Backfill SQL per table (uses column names directly, not NEW.xxx)
// ===========================

function getBackfillSQL(table: string): string {
  switch (table) {
    case 'Document':
      return `
        UPDATE "Document" SET search_vector =
          setweight(to_tsvector('portuguese_unaccent', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('portuguese_unaccent', coalesce(description, '')), 'B') ||
          setweight(to_tsvector('portuguese_unaccent', coalesce(content, '') || ' ' || coalesce(tags, '')), 'C')
      `;
    case 'GlossaryTerm':
      return `
        UPDATE "GlossaryTerm" SET search_vector =
          setweight(to_tsvector('portuguese_unaccent', coalesce(term, '')), 'A') ||
          setweight(to_tsvector('portuguese_unaccent', coalesce("shortDef", '')), 'B') ||
          setweight(to_tsvector('portuguese_unaccent', coalesce(definition, '')), 'C')
      `;
    case 'LegislativeAct':
      return `
        UPDATE "LegislativeAct" SET search_vector =
          setweight(to_tsvector('portuguese_unaccent', coalesce(title, '') || ' ' || coalesce("fullNumber", '')), 'A') ||
          setweight(to_tsvector('portuguese_unaccent', coalesce(ementa, '')), 'B') ||
          setweight(to_tsvector('portuguese_unaccent', coalesce(summary, '')), 'C')
      `;
    case 'CourseVideo':
      return `
        UPDATE "CourseVideo" SET search_vector =
          setweight(to_tsvector('portuguese_unaccent', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('portuguese_unaccent', coalesce(description, '')), 'B')
      `;
    case 'RecommendedSite':
      return `
        UPDATE "RecommendedSite" SET search_vector =
          setweight(to_tsvector('portuguese_unaccent', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('portuguese_unaccent', coalesce(description, '')), 'B')
      `;
    case 'BlogPost':
      return `
        UPDATE "BlogPost" SET search_vector =
          setweight(to_tsvector('portuguese_unaccent', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('portuguese_unaccent', coalesce(excerpt, '')), 'B') ||
          setweight(to_tsvector('portuguese_unaccent', coalesce(content, '') || ' ' || coalesce(tags, '')), 'C')
      `;
    case 'FAQ':
      return `
        UPDATE "FAQ" SET search_vector =
          setweight(to_tsvector('portuguese_unaccent', coalesce(question, '')), 'A') ||
          setweight(to_tsvector('portuguese_unaccent', coalesce(answer, '')), 'B') ||
          setweight(to_tsvector('portuguese_unaccent', coalesce(keywords, '')), 'C')
      `;
    default:
      throw new Error(`Unknown table: ${table}`);
  }
}

// ===========================
// DDL Setup
// ===========================

async function setupDDL(dryRun: boolean): Promise<void> {
  // Step 1: Enable unaccent extension
  console.log('📦 Step 1: Enabling unaccent extension...');
  if (!dryRun) {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    console.log('  ✅ unaccent extension enabled');
  } else {
    console.log('  [DRY RUN] Would enable unaccent extension');
  }

  // Step 2: Create portuguese_unaccent text search config
  console.log('\n📦 Step 2: Creating portuguese_unaccent text search config...');
  if (!dryRun) {
    // Drop and recreate to ensure it's up-to-date
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_ts_config WHERE cfgname = 'portuguese_unaccent'
        ) THEN
          CREATE TEXT SEARCH CONFIGURATION portuguese_unaccent (COPY = portuguese);
          ALTER TEXT SEARCH CONFIGURATION portuguese_unaccent
            ALTER MAPPING FOR hword, hword_part, word
            WITH unaccent, portuguese_stem;
        END IF;
      END
      $$
    `);
    console.log('  ✅ portuguese_unaccent config created');
  } else {
    console.log('  [DRY RUN] Would create portuguese_unaccent config');
  }

  // Step 3: Add search_vector column to each table
  console.log('\n📦 Step 3: Adding search_vector columns...');
  for (const config of TABLES) {
    if (!dryRun) {
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '${config.table}' AND column_name = 'search_vector'
          ) THEN
            ALTER TABLE "${config.table}" ADD COLUMN search_vector tsvector;
          END IF;
        END
        $$
      `);
      console.log(`  ✅ ${config.table}.search_vector added`);
    } else {
      console.log(`  [DRY RUN] Would add search_vector to ${config.table}`);
    }
  }

  // Step 4: Create GIN indexes
  console.log('\n📦 Step 4: Creating GIN indexes...');
  for (const config of TABLES) {
    const indexName = `idx_${config.table.toLowerCase()}_search_vector`;
    if (!dryRun) {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "${indexName}"
        ON "${config.table}" USING GIN (search_vector)
      `);
      console.log(`  ✅ GIN index ${indexName} created`);
    } else {
      console.log(`  [DRY RUN] Would create GIN index ${indexName}`);
    }
  }

  // Step 5: Create trigger functions and triggers
  console.log('\n📦 Step 5: Creating triggers...');
  for (const config of TABLES) {
    const funcName = `${config.table.toLowerCase()}_search_vector_update`;
    const triggerName = `trg_${config.table.toLowerCase()}_search_vector`;

    if (!dryRun) {
      // Create or replace trigger function
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION ${funcName}() RETURNS trigger AS $$
        BEGIN
          NEW.search_vector :=
            ${config.weightA} ||
            ${config.weightB} ||
            ${config.weightC};
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql
      `);

      // Create trigger (drop first to avoid duplicate)
      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS "${triggerName}" ON "${config.table}"
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "${triggerName}"
        BEFORE INSERT OR UPDATE OF ${config.triggerFields.map(f => `"${f}"`).join(', ')}
        ON "${config.table}"
        FOR EACH ROW
        EXECUTE FUNCTION ${funcName}()
      `);

      console.log(`  ✅ Trigger ${triggerName} created`);
    } else {
      console.log(`  [DRY RUN] Would create trigger ${triggerName}`);
    }
  }
}

// ===========================
// Backfill
// ===========================

async function runBackfill(dryRun: boolean): Promise<void> {
  console.log('\n📋 Backfilling search_vector for existing rows...\n');

  for (const config of TABLES) {
    const sql = getBackfillSQL(config.table);

    if (!dryRun) {
      const result = await prisma.$executeRawUnsafe(sql);
      console.log(`  ✅ ${config.table}: ${result} rows updated`);
    } else {
      // Count rows for dry run info (may fail if no DB connection)
      try {
        const count = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
          `SELECT count(*) FROM "${config.table}"`
        );
        console.log(`  [DRY RUN] Would update ${count[0].count} rows in ${config.table}`);
      } catch {
        console.log(`  [DRY RUN] Would update all rows in ${config.table}`);
      }
    }
  }
}

// ===========================
// Verify
// ===========================

async function verifySetup(): Promise<void> {
  console.log('\n🔍 Verifying Full-Text Search setup...\n');

  // Check extension
  const extensions = await prisma.$queryRawUnsafe<{ extname: string }[]>(
    `SELECT extname FROM pg_extension WHERE extname = 'unaccent'`
  );
  console.log(`  Extension unaccent: ${extensions.length > 0 ? '✅' : '❌'}`);

  // Check text search config
  const configs = await prisma.$queryRawUnsafe<{ cfgname: string }[]>(
    `SELECT cfgname FROM pg_ts_config WHERE cfgname = 'portuguese_unaccent'`
  );
  console.log(`  Config portuguese_unaccent: ${configs.length > 0 ? '✅' : '❌'}`);

  // Check each table
  console.log('\n  Table Status:');
  console.log('  ' + '-'.repeat(65));
  console.log(`  ${'Table'.padEnd(20)} ${'Column'.padEnd(10)} ${'Index'.padEnd(10)} ${'Trigger'.padEnd(10)} ${'Indexed'.padEnd(10)}`);
  console.log('  ' + '-'.repeat(65));

  for (const config of TABLES) {
    // Check column exists
    const col = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*) FROM information_schema.columns WHERE table_name = '${config.table}' AND column_name = 'search_vector'`
    );
    const hasColumn = Number(col[0].count) > 0;

    // Check GIN index
    const idx = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*) FROM pg_indexes WHERE tablename = '${config.table}' AND indexname = 'idx_${config.table.toLowerCase()}_search_vector'`
    );
    const hasIndex = Number(idx[0].count) > 0;

    // Check trigger
    const trg = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_${config.table.toLowerCase()}_search_vector'`
    );
    const hasTrigger = Number(trg[0].count) > 0;

    // Check indexed percentage
    let indexedPct = '—';
    if (hasColumn) {
      const stats = await prisma.$queryRawUnsafe<[{ total: bigint; indexed: bigint }]>(
        `SELECT count(*) as total, count(search_vector) as indexed FROM "${config.table}"`
      );
      const total = Number(stats[0].total);
      const indexed = Number(stats[0].indexed);
      indexedPct = total > 0 ? `${indexed}/${total} (${Math.round((indexed / total) * 100)}%)` : '0/0';
    }

    console.log(
      `  ${config.table.padEnd(20)} ${(hasColumn ? '✅' : '❌').padEnd(10)} ${(hasIndex ? '✅' : '❌').padEnd(10)} ${(hasTrigger ? '✅' : '❌').padEnd(10)} ${indexedPct}`
    );
  }

  // Test a sample FTS query
  console.log('\n  Sample FTS Query Test:');
  try {
    const result = await prisma.$queryRawUnsafe<{ title: string; rank: number }[]>(`
      SELECT title, ts_rank(search_vector, websearch_to_tsquery('portuguese_unaccent', 'licitacao')) as rank
      FROM "Document"
      WHERE search_vector @@ websearch_to_tsquery('portuguese_unaccent', 'licitacao')
      ORDER BY rank DESC
      LIMIT 3
    `);
    if (result.length > 0) {
      console.log(`  ✅ FTS query works! Found ${result.length} results for "licitacao":`);
      result.forEach(r => console.log(`     - ${r.title} (rank: ${r.rank.toFixed(4)})`));
    } else {
      console.log('  ⚠️  FTS query returned 0 results (may need backfill)');
    }
  } catch (err) {
    console.log(`  ❌ FTS query failed: ${(err as Error).message}`);
  }
}

// ===========================
// Main
// ===========================

async function main() {
  const args = process.argv.slice(2);
  const options: SetupOptions = {
    dryRun: args.includes('--dry-run'),
    backfillOnly: args.includes('--backfill'),
    verify: args.includes('--verify'),
  };

  console.log('🔤 Full-Text Search Setup for PostgreSQL');
  console.log('=========================================\n');

  if (options.verify) {
    await verifySetup();
    return;
  }

  console.log('Options:', {
    dryRun: options.dryRun,
    backfillOnly: options.backfillOnly,
  });
  console.log('');

  if (!options.backfillOnly) {
    await setupDDL(options.dryRun);
  }

  await runBackfill(options.dryRun);

  console.log('\n=========================================');
  if (options.dryRun) {
    console.log('✅ Dry run complete. No changes were made.');
    console.log('   Run without --dry-run to apply changes.');
  } else {
    console.log('✅ Full-Text Search setup complete!');
    console.log('   Run with --verify to check status.');
  }
}

main()
  .catch((err) => {
    console.error('\n❌ Setup failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
