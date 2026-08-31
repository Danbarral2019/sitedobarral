import { listarCursosVendaveis } from '@/lib/lms/cursos-vendaveis';
import PlanosClient from './PlanosClient';

/**
 * A escolha do curso no plano Básico é resolvida no servidor, não no cliente:
 * o seletor chega pronto, sem piscar uma lista completa antes de filtrar.
 */
export default async function PlanosPage() {
  const cursosVendaveis = await listarCursosVendaveis();
  return <PlanosClient cursosVendaveis={cursosVendaveis} />;
}
