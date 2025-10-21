import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mudado de 'edge' para 'nodejs' devido ao limite de tamanho (1MB) em Edge Functions
// Node.js runtime não tem limite de tamanho
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Buscar post do blog
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      select: {
        title: true,
        excerpt: true,
        author: true,
        publishedAt: true,
      },
    });

    if (!post) {
      return new Response('Post não encontrado', { status: 404 });
    }

    // Gerar imagem OG
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            padding: '80px',
          }}
        >
          {/* Conteúdo Principal */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                padding: '12px 24px',
                borderRadius: '9999px',
                fontSize: '20px',
                fontWeight: '600',
                color: 'white',
              }}
            >
              📚 Blog Prof. Daniel Barral
            </div>

            {/* Título */}
            <div
              style={{
                fontSize: '72px',
                fontWeight: '900',
                color: 'white',
                lineHeight: '1.1',
                maxWidth: '1000px',
                textShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              {post.title}
            </div>

            {/* Excerpt */}
            <div
              style={{
                fontSize: '28px',
                color: 'rgba(255, 255, 255, 0.9)',
                lineHeight: '1.4',
                maxWidth: '900px',
              }}
            >
              {post.excerpt.substring(0, 150)}
              {post.excerpt.length > 150 ? '...' : ''}
            </div>
          </div>

          {/* Rodapé */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
            }}
          >
            {/* Autor e Data */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  color: 'white',
                }}
              >
                {post.author}
              </div>
              <div
                style={{
                  fontSize: '20px',
                  color: 'rgba(255, 255, 255, 0.8)',
                }}
              >
                {new Date(post.publishedAt).toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            </div>

            {/* URL */}
            <div
              style={{
                fontSize: '24px',
                fontWeight: '600',
                color: 'rgba(255, 255, 255, 0.9)',
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '16px 32px',
                borderRadius: '12px',
              }}
            >
              profdanielbarral.com
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Erro ao gerar imagem OG:', error);
    return new Response('Erro ao gerar imagem', { status: 500 });
  }
}
