/**
 * Atualiza enunciados INCP 44-54 com o texto OFICIAL da 3ª edição
 * (fornecido pelo Prof. Daniel Barral em 2026-05-01).
 *
 * 5 enunciados (45, 47, 49, 51, 54) estavam com texto extraído do site
 * INCP em /informativo-enunciados-2a-edicao/ — mas o site na verdade
 * mostra texto da 2ª edição com numeração 44-54 (renumeração entre
 * edições). O texto autoritativo da 3ª edição é o passado pelo user.
 */
import { prisma } from '../lib/prisma';

const TEXTO_3A_EDICAO: Record<number, string> = {
  44: 'A ausência de previsão no edital não impede a autorização excepcional da subcontratação em contratos regidos pela Lei 13.303/2016, no caso de fato superveniente, observado o dever de motivação.',
  45: 'O fiscal e o gestor do contrato devem adotar postura colaborativa e dialógica com o contratado, buscando prevenir conflitos, mediante reuniões periódicas e tratativas formais para solução de problemas.',
  46: 'A Lei 14.133/2021 não obriga a adoção de dispensa eletrônica.',
  47: 'Considerando que a Lei 13.303/2016 não estabelece critérios específicos para a dosimetria das sanções aplicáveis pelas estatais, admite-se que os regulamentos internos definam aspectos objetivos — tais como gravidade, risco ao negócio, impacto reputacional, reincidência e colaboração do fornecedor — para parametrizar a decisão sancionadora.',
  48: 'Os instrumentos hábeis a substituir o termo de contrato sujeitam-se às normas de contratos administrativos.',
  49: 'A verificação de informações e documentos pelo agente público diretamente nos sítios eletrônicos oficiais de órgãos e entidades, desde que atestado nos autos, constitui meio legal de prova para todos os fins.',
  50: 'A omissão no dever de implementar a governança das contratações poderá ensejar responsabilização aos membros da alta administração de órgãos e entidades da Administração Pública.',
  51: 'Caso não seja realizada, durante o certame, a análise da proposta e da habilitação dos fornecedores incluídos no cadastro reserva do sistema de registro de preços, caberá a interposição de recurso administrativo por ocasião do chamamento desses fornecedores.',
  52: 'A adoção do orçamento sigiloso não afasta o dever de indicar a data do orçamento estimado no instrumento convocatório, para fins de definição da data-base para o reajustamento em sentido estrito.',
  53: 'Nas pesquisas de preços para obras e serviços de engenharia, é admissível a cotação com potenciais fornecedores, como fonte de preço subsidiária, caso esgotados os parâmetros previstos no art. 23, § 2º, da Lei 14.133/2021.',
  54: 'A previsão de regulamento do Poder Executivo federal no inciso VII do § 1º do art. 79 da Lei 14.133/2021 não impede a edição de regulamento pelos demais entes federativos e demais órgãos independentes.',
};

async function main() {
  const apply = process.argv.includes('--apply');
  let updated = 0;
  for (const [n, oficial] of Object.entries(TEXTO_3A_EDICAO)) {
    const d = await prisma.document.findFirst({
      where: { category: 'enunciados', title: `Enunciado do INCP nº ${n}` },
      select: { id: true, description: true },
    });
    if (!d) { console.log(`${n}: NÃO ENCONTRADO`); continue; }
    const atual = (d.description ?? '').replace(/\s*\(Aprovado por (?:unanimidade|maioria(?:\s+qualificada)?)\)\.?\s*$/i, '').trim();
    if (atual === oficial.trim()) {
      console.log(`${n}: ✅ já está correto`);
      continue;
    }
    console.log(`${n}: ❌ atualizar`);
    if (apply) {
      await prisma.document.update({
        where: { id: d.id },
        data: { description: oficial, content: oficial },
      });
      updated++;
    }
  }
  console.log(`\n${updated} updates ${apply ? 'aplicados' : '(dry-run)'}`);
  await prisma.$disconnect();
}
main();
