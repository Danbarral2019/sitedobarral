import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

/**
 * POST /api/admin/migrate-lei-14133
 * Executa migração dos artigos da Lei 14.133 para o banco de dados
 *
 * TEMPORÁRIO: Este endpoint deve ser removido após execução bem-sucedida
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🚀 Iniciando migração Lei 14.133/2021 → Banco de Dados');

    const artigos = Object.entries(LEI_14133_ARTIGOS);
    console.log(`📊 Total de artigos a migrar: ${artigos.length}`);

    let importados = 0;
    let atualizados = 0;
    let erros = 0;
    const erroDetalhes: Array<{ numero: string; erro: string }> = [];

    for (const [numero, artigo] of artigos) {
      try {
        // Tentar encontrar artigo existente
        const existente = await prisma.leiArticle.findUnique({
          where: { numero },
        });

        if (existente) {
          // Atualizar artigo existente
          await prisma.leiArticle.update({
            where: { numero },
            data: {
              titulo: artigo.titulo || null,
              capituloCompleto: artigo.capituloCompleto || null,
              ementa: artigo.ementa,
              capitulo: artigo.capitulo,
              secao: artigo.secao || null,
            },
          });
          atualizados++;
          console.log(`✓ Atualizado: Art. ${numero}`);
        } else {
          // Criar novo artigo
          await prisma.leiArticle.create({
            data: {
              numero,
              titulo: artigo.titulo || null,
              capituloCompleto: artigo.capituloCompleto || null,
              ementa: artigo.ementa,
              capitulo: artigo.capitulo,
              secao: artigo.secao || null,
            },
          });
          importados++;
          console.log(`✓ Importado: Art. ${numero}`);
        }
      } catch (error) {
        erros++;
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        erroDetalhes.push({ numero, erro: errorMsg });
        console.error(`✗ Erro no Art. ${numero}:`, errorMsg);
      }
    }

    // Verificar contagem final no banco
    const totalNoBanco = await prisma.leiArticle.count();

    const resultado = {
      sucesso: totalNoBanco === artigos.length,
      resumo: {
        importados,
        atualizados,
        erros,
        total: artigos.length,
        totalNoBanco,
      },
      erroDetalhes: erroDetalhes.length > 0 ? erroDetalhes : undefined,
    };

    console.log('📊 Resumo da Migração:', resultado.resumo);

    if (resultado.sucesso) {
      console.log('🎉 Migração concluída com sucesso!');
      return NextResponse.json({
        success: true,
        message: `Migração concluída! ${importados} importados, ${atualizados} atualizados.`,
        ...resultado,
      });
    } else {
      console.log(`⚠️ Atenção: Esperado ${artigos.length}, mas encontrado ${totalNoBanco} no banco`);
      return NextResponse.json({
        success: false,
        message: `Migração parcial: ${totalNoBanco}/${artigos.length} artigos no banco`,
        ...resultado,
      }, { status: 207 }); // 207 Multi-Status
    }
  } catch (error) {
    console.error('❌ Erro durante migração:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao executar migração',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrate-lei-14133
 * Verifica status da migração (quantos artigos já estão no banco)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const totalEsperado = Object.keys(LEI_14133_ARTIGOS).length;
    const totalNoBanco = await prisma.leiArticle.count();
    const migrado = totalNoBanco === totalEsperado;

    return NextResponse.json({
      migrado,
      totalEsperado,
      totalNoBanco,
      faltam: totalEsperado - totalNoBanco,
    });
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar status' },
      { status: 500 }
    );
  }
}
