import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  try {
    const { numero } = await params;
    const cert = await prisma.certificate.findUnique({
      where: { certificateNumber: numero },
      select: {
        studentName: true,
        courseTitle: true,
        estimatedHours: true,
        issuedAt: true,
        revokedAt: true,
      },
    });

    if (!cert) {
      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0f172a',
              color: 'white',
              fontSize: 48,
              fontFamily: 'sans-serif',
            }}
          >
            Certificado não encontrado
          </div>
        ),
        { width: 1200, height: 630 },
      );
    }

    const revoked = Boolean(cert.revokedAt);
    const issuedDate = new Date(cert.issuedAt).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #20364e 0%, #142232 100%)',
            color: 'white',
            padding: 60,
            fontFamily: 'sans-serif',
          }}
        >
          {/* Status banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              padding: '6px 16px',
              borderRadius: 999,
              background: revoked ? '#dc2626' : '#059669',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {revoked ? 'Certificado Revogado' : 'Certificado Verificado'}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
              alignItems: 'flex-start',
              marginTop: 40,
            }}
          >
            <p
              style={{
                fontSize: 18,
                color: '#cbd5e1',
                letterSpacing: 4,
                textTransform: 'uppercase',
                margin: 0,
                marginBottom: 12,
              }}
            >
              Prof. Daniel Barral · profdanielbarral.com
            </p>
            <p style={{ fontSize: 22, color: '#e2e8f0', margin: 0, marginBottom: 8 }}>
              Certifica que
            </p>
            <p
              style={{
                fontSize: revoked ? 60 : 72,
                fontWeight: 700,
                lineHeight: 1.05,
                margin: 0,
                marginBottom: 16,
                color: 'white',
                opacity: revoked ? 0.7 : 1,
              }}
            >
              {cert.studentName}
            </p>
            <p style={{ fontSize: 22, color: '#e2e8f0', margin: 0, marginBottom: 8 }}>
              concluiu o curso
            </p>
            <p
              style={{
                fontSize: 38,
                fontWeight: 600,
                color: 'white',
                margin: 0,
                opacity: revoked ? 0.7 : 1,
              }}
            >
              {cert.courseTitle}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              borderTop: '1px solid rgba(255,255,255,0.15)',
              paddingTop: 24,
              fontSize: 18,
              color: '#cbd5e1',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase' }}>
                Emitido em
              </span>
              <span style={{ fontSize: 22, color: 'white', marginTop: 4 }}>{issuedDate}</span>
            </div>
            {cert.estimatedHours ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  style={{ fontSize: 13, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase' }}
                >
                  Carga horária
                </span>
                <span style={{ fontSize: 22, color: 'white', marginTop: 4 }}>
                  {cert.estimatedHours} h
                </span>
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span
                style={{ fontSize: 13, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase' }}
              >
                Número
              </span>
              <span
                style={{
                  fontSize: 20,
                  color: 'white',
                  marginTop: 4,
                  fontFamily: 'monospace',
                }}
              >
                {numero}
              </span>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  } catch {
    return new Response('Erro ao gerar imagem', { status: 500 });
  }
}
