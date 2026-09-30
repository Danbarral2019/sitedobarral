import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { artigoIndexavel } from '@/lib/lei-14133/metadados-artigo';

/**
 * Texto de um artigo da Lei 14.133 para o HTML do servidor de
 * /lei-14133?artigo=N. A página é montada no cliente, a partir de
 * /api/lei-14133/articles; sem isto, o HTML inicial trazia só "Carregando".
 * A fonte é a mesma da API (tabela LeiArticle, editada à mão), para que o
 * texto pré-renderizado seja o mesmo que o cliente exibe depois.
 */
export interface ArtigoInicial {
  numero: string;
  ementa: string;
  titulo: string | null;
  capituloCompleto: string | null;
}

const buscarArtigo = unstable_cache(
  async (numero: string): Promise<ArtigoInicial | null> =>
    prisma.leiArticle.findUnique({
      where: { numero },
      select: { numero: true, ementa: true, titulo: true, capituloCompleto: true },
    }),
  ['lei-14133-artigo-inicial'],
  { revalidate: 3600 },
);

export async function artigoInicial(numero: string | undefined): Promise<ArtigoInicial | null> {
  if (!numero || !artigoIndexavel(numero)) return null;
  try {
    return await buscarArtigo(numero);
  } catch {
    // Sem o texto no servidor a página continua funcionando: o cliente o carrega.
    return null;
  }
}
