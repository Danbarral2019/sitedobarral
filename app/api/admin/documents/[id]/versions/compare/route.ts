import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError, NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { compareVersions } from '@/lib/agu-modules/versioning';

/**
 * POST: Compara duas versões de um documento
 * Body: { versionId1: string, versionId2: string }
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { versionId1, versionId2 } = body;

    if (!versionId1 || !versionId2) {
      throw new ValidationError('versionId1 e versionId2 são obrigatórios');
    }

    if (versionId1 === versionId2) {
      throw new ValidationError('As versões devem ser diferentes');
    }

    const result = await compareVersions(versionId1, versionId2);

    apiLogger.info(
      { versionId1, versionId2, changesCount: result.changes.length },
      'Versions compared'
    );

    return NextResponse.json(result);
  } catch (error) {
    // Converter erros genéricos do versioning.ts em NotFoundError
    if (error instanceof Error && error.message === 'Versões não encontradas') {
      return handleApiError(new NotFoundError('Versão'));
    }
    return handleApiError(error);
  }
});
