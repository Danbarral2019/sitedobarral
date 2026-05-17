import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError, NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { compareVersions } from '@/lib/agu-modules/versioning';

/**
 * POST: Compara duas versões de um documento
 * Body: { versionId1: string, versionId2: string }
 */
export const POST = withAdminApi(async (request: NextRequest) => {
    const body = await request.json();
    const { versionId1, versionId2 } = body;

    if (!versionId1 || !versionId2) {
      throw new ValidationError('versionId1 e versionId2 são obrigatórios');
    }

    if (versionId1 === versionId2) {
      throw new ValidationError('As versões devem ser diferentes');
    }

    let result;
    try {
      result = await compareVersions(versionId1, versionId2);
    } catch (error) {
      // Converter erros genéricos do versioning.ts em NotFoundError
      if (error instanceof Error && error.message === 'Versões não encontradas') {
        throw new NotFoundError('Versão');
      }
      throw error;
    }

    apiLogger.info(
      { versionId1, versionId2, changesCount: result.changes.length },
      'Versions compared'
    );

    return NextResponse.json(result);
});
