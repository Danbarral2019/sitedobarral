import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listR2FilesWithMetadata, deleteFromR2 } from '@/lib/storage/r2-client';
import { apiLogger } from '@/lib/logger';

// ===========================
// Configuration
// ===========================

const CRON_SECRET = process.env.CRON_SECRET;

// Files older than this threshold (in hours) without DB records will be deleted
const ORPHAN_THRESHOLD_HOURS = 24; // 24 hours

// Maximum files to process per run (to avoid timeout)
const MAX_FILES_PER_RUN = 100;

// Dry run mode (set to false to actually delete files)
const DRY_RUN = process.env.NODE_ENV === 'development';

// ===========================
// Types
// ===========================

interface OrphanedFile {
  key: string;
  size: number;
  lastModified: Date;
  ageHours: number;
}

interface CleanupResult {
  scanned: number;
  orphaned: number;
  deleted: number;
  skipped: number;
  errors: number;
  dryRun: boolean;
  orphanedFiles: OrphanedFile[];
}

// ===========================
// Helper Functions
// ===========================

function isFileOldEnough(fileDate: Date, thresholdHours: number): boolean {
  const now = new Date();
  const ageMs = now.getTime() - fileDate.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  return ageHours >= thresholdHours;
}

function getAgeInHours(fileDate: Date): number {
  const now = new Date();
  const ageMs = now.getTime() - fileDate.getTime();
  return ageMs / (1000 * 60 * 60);
}

// ===========================
// Main Cleanup Logic
// ===========================

async function findOrphanedFiles(): Promise<OrphanedFile[]> {
  console.log('🔍 Scanning R2 for orphaned files...');

  // 1. List all files in R2 (documents prefix)
  const r2Files = await listR2FilesWithMetadata('documents/', MAX_FILES_PER_RUN);

  console.log(`📦 Found ${r2Files.length} files in R2`);

  if (r2Files.length === 0) {
    return [];
  }

  // 2. Get all r2Keys from database
  const dbDocuments = await prisma.document.findMany({
    where: {
      r2Key: {
        not: null,
      },
    },
    select: {
      r2Key: true,
    },
  });

  const dbKeys = new Set(dbDocuments.map((doc) => doc.r2Key).filter(Boolean));

  console.log(`💾 Found ${dbKeys.size} documents with R2 keys in database`);

  // 3. Find orphaned files (exist in R2 but not in DB)
  const orphanedFiles: OrphanedFile[] = [];

  for (const file of r2Files) {
    // Skip if file is in database
    if (dbKeys.has(file.key)) {
      continue;
    }

    // Check if file is old enough
    const ageHours = getAgeInHours(file.lastModified);
    if (!isFileOldEnough(file.lastModified, ORPHAN_THRESHOLD_HOURS)) {
      console.log(
        `⏳ Skipping recent file: ${file.key} (${ageHours.toFixed(1)}h old, threshold: ${ORPHAN_THRESHOLD_HOURS}h)`
      );
      continue;
    }

    orphanedFiles.push({
      key: file.key,
      size: file.size,
      lastModified: file.lastModified,
      ageHours,
    });
  }

  console.log(`🗑️  Found ${orphanedFiles.length} orphaned files`);

  return orphanedFiles;
}

async function deleteOrphanedFiles(
  orphanedFiles: OrphanedFile[],
  dryRun: boolean
): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  for (const file of orphanedFiles) {
    try {
      if (dryRun) {
        console.log(
          `🔍 [DRY RUN] Would delete: ${file.key} (${(file.size / 1024).toFixed(1)} KB, ${file.ageHours.toFixed(1)}h old)`
        );
        deleted++;
      } else {
        console.log(
          `🗑️  Deleting: ${file.key} (${(file.size / 1024).toFixed(1)} KB, ${file.ageHours.toFixed(1)}h old)`
        );
        await deleteFromR2(file.key);
        deleted++;
        console.log(`✅ Deleted: ${file.key}`);
      }
    } catch (error) {
      apiLogger.error({ err: error }, `❌ Error deleting ${file.key}:`);
      errors++;
    }
  }

  return { deleted, errors };
}

// ===========================
// API Route
// ===========================

export async function GET(req: NextRequest) {
  try {
    // 1. Verify cron secret
    const authHeader = req.headers.get('authorization');

    if (!CRON_SECRET) {
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🧹 Starting orphaned files cleanup...');
    console.log(`⚙️  Configuration:`);
    console.log(`   - Orphan threshold: ${ORPHAN_THRESHOLD_HOURS} hours`);
    console.log(`   - Max files per run: ${MAX_FILES_PER_RUN}`);
    console.log(`   - Dry run: ${DRY_RUN ? 'YES' : 'NO'}`);

    // 2. Find orphaned files
    const orphanedFiles = await findOrphanedFiles();

    // 3. Delete orphaned files (or simulate in dry run)
    const { deleted, errors } = await deleteOrphanedFiles(orphanedFiles, DRY_RUN);

    // 4. Calculate statistics
    const totalSize = orphanedFiles.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    const result: CleanupResult = {
      scanned: orphanedFiles.length + deleted,
      orphaned: orphanedFiles.length,
      deleted,
      skipped: orphanedFiles.length - deleted,
      errors,
      dryRun: DRY_RUN,
      orphanedFiles: orphanedFiles.slice(0, 10), // Return first 10 for inspection
    };

    console.log(`✅ Cleanup completed:`);
    console.log(`   - Scanned: ${result.scanned} files`);
    console.log(`   - Orphaned: ${result.orphaned} files (${totalSizeMB} MB)`);
    console.log(`   - ${DRY_RUN ? 'Would delete' : 'Deleted'}: ${result.deleted} files`);
    console.log(`   - Errors: ${result.errors}`);

    if (DRY_RUN && orphanedFiles.length > 0) {
      console.log('');
      console.log('💡 To actually delete files, set NODE_ENV=production or DRY_RUN=false');
    }

    return NextResponse.json({
      success: true,
      ...result,
      totalSizeMB,
    });
  } catch (error) {
    apiLogger.error({ err: error }, '❌ Cleanup error:');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ===========================
// Manual Trigger Endpoint
// ===========================

/**
 * POST endpoint for manual cleanup trigger (admin only)
 * Useful for testing and emergency cleanups
 */
export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated admin
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    if (!CRON_SECRET || secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow overriding dry run mode via query parameter
    const forceDryRun = searchParams.get('dryRun') === 'true';
    const forceDelete = searchParams.get('force') === 'true';

    const effectiveDryRun = forceDryRun || (!forceDelete && DRY_RUN);

    console.log('🧹 Manual cleanup triggered');
    console.log(`   - Dry run: ${effectiveDryRun ? 'YES' : 'NO'}`);

    const orphanedFiles = await findOrphanedFiles();
    const { deleted, errors } = await deleteOrphanedFiles(orphanedFiles, effectiveDryRun);

    const totalSize = orphanedFiles.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    return NextResponse.json({
      success: true,
      manual: true,
      scanned: orphanedFiles.length,
      orphaned: orphanedFiles.length,
      deleted,
      errors,
      dryRun: effectiveDryRun,
      totalSizeMB,
      orphanedFiles: orphanedFiles.slice(0, 20), // Return first 20 for manual inspection
    });
  } catch (error) {
    apiLogger.error({ err: error }, '❌ Manual cleanup error:');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
