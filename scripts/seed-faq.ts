/**
 * Popular FAQ inicial — perguntas de acesso, pagamento e administrativas.
 *
 * Uso:
 *   npx tsx scripts/seed-faq.ts --dry-run       # Lista sem inserir
 *   npx tsx scripts/seed-faq.ts                  # Insere se FAQ estiver vazio
 *   npx tsx scripts/seed-faq.ts --force          # Insere mesmo se já houver registros
 *
 * Idempotente por question — usa upsert via findFirst+create pra evitar
 * duplicar se rodado duas vezes.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

type SeedFAQ = {
  question: string;
  answer: string;
  category: string;
  isPinned?: boolean;
  keywords?: string;
};

const CAT_ACESSO = 'Acesso e Conta';
const CAT_PAGAMENTO = 'Planos e Pagamento';
const CAT_CURSOS = 'Cursos e Certificados';
const CAT_OUTROS = 'Suporte e Outros';

const FAQS: SeedFAQ[] = [
  // ===== ACESSO E CONTA =====
  {
    category: CAT_ACESSO,
    isPinned: true,
    question: 'Como faço meu cadastro no site?',
    answer:
      'O cadastro é gratuito e leva menos de 1 minuto:\n\n1. Acesse a página de [registro](/registro)\n2. Informe seu **nome completo**, **e-mail** e crie uma **senha**\n3. Confirme seu e-mail clicando no link que enviamos\n4. Pronto! Você já pode navegar pela [área restrita](/area-restrita) e contratar um plano em [/planos](/planos)\n\nNão é obrigatório ter um QR Code de evento presencial para se cadastrar.',
    keywords: 'cadastro registro criar conta nova inscrever-se sign-up registrar',
  },
  {
    category: CAT_ACESSO,
    question: 'Preciso de QR Code para criar minha conta?',
    answer:
      'Não. O QR Code é **opcional** e era distribuído em eventos presenciais do Prof. Daniel Barral, concedendo **1 mês de acesso gratuito** (modo trial) ao usuário que o validasse.\n\nVocê pode se cadastrar normalmente em [/registro](/registro) sem QR Code e contratar uma assinatura quando quiser.',
    keywords: 'qr code evento presencial trial gratuito',
  },
  {
    category: CAT_ACESSO,
    isPinned: true,
    question: 'Esqueci minha senha. Como recupero o acesso?',
    answer:
      'Use o link [Esqueci minha senha](/redefinir-senha) na tela de login. Você receberá um e-mail com um link seguro para redefinir sua senha (válido por algumas horas).\n\nSe o e-mail não chegar em até 5 minutos, verifique a caixa de **spam/lixo eletrônico**. Caso o problema persista, fale conosco em [/contato](/contato).',
    keywords: 'senha esqueci recuperar redefinir reset password',
  },
  {
    category: CAT_ACESSO,
    question: 'Não recebi o e-mail de confirmação de cadastro. O que fazer?',
    answer:
      'Verifique primeiro a pasta de **spam** ou **lixo eletrônico** do seu e-mail — provedores como Gmail e Outlook às vezes filtram mensagens automáticas.\n\nSe não estiver lá:\n\n- Confirme que digitou o endereço corretamente no cadastro (sem espaços ou caracteres trocados)\n- Acesse a página de login e use a opção **Reenviar e-mail de verificação**\n- Se mesmo assim não chegar, entre em contato em [/contato](/contato) informando o e-mail usado no cadastro',
    keywords: 'email verificação confirmação não recebi spam reenviar',
  },
  {
    category: CAT_ACESSO,
    question: 'Como faço login na área restrita?',
    answer:
      'Acesse [/login](/login), informe seu **e-mail** e **senha** cadastrados e clique em **Entrar**. Após o login, você será direcionado para a [área restrita](/area-restrita) com acesso a cursos, jurisprudência, Lei 14.133 comentada e demais conteúdos do seu plano.',
    keywords: 'login entrar acessar área restrita senha',
  },
  {
    category: CAT_ACESSO,
    question: 'Posso compartilhar minha conta com outra pessoa?',
    answer:
      'Não. A conta é **pessoal e intransferível**, conforme os [Termos de Uso](/termos). Cada assinatura ou matrícula vale para um único usuário. O compartilhamento pode resultar no bloqueio da conta sem reembolso.\n\nSe a sua empresa ou órgão público quer adquirir múltiplos acessos, fale conosco em [/contato](/contato) para negociar uma proposta corporativa.',
    keywords: 'compartilhar conta dividir login conjunto empresa órgão público',
  },
  {
    category: CAT_ACESSO,
    question: 'Como altero meu e-mail ou meus dados de cadastro?',
    answer:
      'Para alterar e-mail, nome ou outros dados cadastrais, envie uma solicitação pelo formulário em [/contato](/contato) a partir do e-mail atualmente cadastrado, indicando os dados que deseja atualizar. Por questões de segurança, alterações de e-mail exigem confirmação manual.',
    keywords: 'alterar mudar trocar email dados cadastro nome perfil',
  },
  {
    category: CAT_ACESSO,
    question: 'Como excluo minha conta? (LGPD)',
    answer:
      'Você tem direito à exclusão dos seus dados pessoais conforme a [LGPD (Lei 13.709/2018)](/privacidade). Para solicitar a exclusão da conta:\n\n1. Envie um e-mail para **dpo@profdanielbarral.com** ou use o formulário em [/contato](/contato)\n2. Informe o e-mail cadastrado e a confirmação do pedido\n3. A exclusão será processada em até **15 dias úteis**\n\nAtenção: dados que precisam ser mantidos por obrigação legal (ex: registros fiscais de pagamentos) serão preservados pelo prazo legal exigido.',
    keywords: 'excluir deletar apagar conta lgpd privacidade dados pessoais',
  },

  // ===== PLANOS E PAGAMENTO =====
  {
    category: CAT_PAGAMENTO,
    isPinned: true,
    question: 'Quais são os planos disponíveis?',
    answer:
      'Atualmente oferecemos dois planos de assinatura:\n\n- **Básico — R$ 49,90/mês** (ou R$ 499/ano): acesso a **1 curso específico** + Assistente IA + biblioteca pública\n- **Premium — R$ 89,90/mês** (ou R$ 899/ano): acesso a **todos os cursos** + Assistente IA + biblioteca pública\n\nVeja a comparação completa em [/planos](/planos).',
    keywords: 'planos preços valores assinatura básico premium custo quanto custa',
  },
  {
    category: CAT_PAGAMENTO,
    question: 'Qual a diferença entre o plano Básico e o Premium?',
    answer:
      'A principal diferença está no **número de cursos** que você pode acessar:\n\n| Recurso | Básico | Premium |\n|---|---|---|\n| Cursos | 1 curso à escolha | Todos os cursos |\n| Assistente IA | ✅ Sim | ✅ Sim |\n| Lei 14.133 comentada | ✅ Sim | ✅ Sim |\n| Jurisprudência | ✅ Sim | ✅ Sim |\n| Base de conhecimento pública | ✅ Sim | ✅ Sim |\n| Certificados de conclusão | ✅ Sim | ✅ Sim |\n\nSe você pretende fazer mais de um curso, o **Premium compensa** já a partir do 2º curso.',
    keywords: 'diferença básico premium comparar planos qual escolher',
  },
  {
    category: CAT_PAGAMENTO,
    isPinned: true,
    question: 'Quais formas de pagamento são aceitas?',
    answer:
      'Aceitamos:\n\n- **Cartão de crédito** (Visa, Mastercard, Elo, Amex e outras bandeiras principais)\n- **PIX** (PIX Automático, com cobrança recorrente autorizada uma única vez)\n\nO processamento é feito pela **Stripe**, padrão internacional de segurança. Não armazenamos dados do seu cartão nos nossos servidores.',
    keywords: 'pagamento formas cartão crédito pix débito boleto stripe',
  },
  {
    category: CAT_PAGAMENTO,
    question: 'O PIX funciona com renovação automática?',
    answer:
      'Sim. Usamos o **PIX Automático** da Stripe, em que você autoriza a cobrança recorrente uma única vez no momento da assinatura e o valor é debitado automaticamente a cada ciclo (mensal ou anual). Você pode revogar a autorização a qualquer momento pelo seu banco ou cancelando a assinatura.',
    keywords: 'pix automático recorrente renovação automática débito',
  },
  {
    category: CAT_PAGAMENTO,
    isPinned: true,
    question: 'Como cancelo minha assinatura?',
    answer:
      'Envie sua solicitação pelo formulário em [/contato](/contato) a partir do e-mail cadastrado, com o assunto **"Cancelamento de assinatura"**. O processamento é feito em até **2 dias úteis** e você mantém acesso até o fim do ciclo já pago.\n\n**Não há multa nem prazo de fidelidade** — você pode cancelar a qualquer momento.',
    keywords: 'cancelar cancelamento assinatura encerrar parar pagar',
  },
  {
    category: CAT_PAGAMENTO,
    question: 'Tenho direito a reembolso se desistir?',
    answer:
      'Sim, conforme o **Código de Defesa do Consumidor (art. 49)**, você tem **7 dias corridos** a partir da contratação para solicitar reembolso integral, independentemente do motivo (direito de arrependimento em compras online).\n\nApós esse prazo, o cancelamento encerra a renovação futura mas não gera reembolso retroativo do período já consumido. Para solicitar reembolso, use [/contato](/contato) informando o e-mail cadastrado e a data da contratação.',
    keywords: 'reembolso devolução arrependimento estorno desistir cdc 7 dias',
  },
  {
    category: CAT_PAGAMENTO,
    question: 'Posso trocar de plano depois de assinar?',
    answer:
      'Sim. Envie sua solicitação pelo formulário em [/contato](/contato) indicando o novo plano desejado:\n\n- **Upgrade (Básico → Premium):** ajustamos seu acesso imediatamente, com cobrança proporcional ao tempo restante do ciclo\n- **Downgrade (Premium → Básico):** mudança aplicada no próximo ciclo de renovação',
    keywords: 'trocar mudar plano upgrade downgrade básico premium migrar',
  },
  {
    category: CAT_PAGAMENTO,
    question: 'A assinatura é renovada automaticamente?',
    answer:
      'Sim. Tanto a cobrança mensal quanto a anual têm **renovação automática** no fim de cada ciclo, garantindo que você não perca acesso por esquecimento. Você pode cancelar a qualquer momento, sem multa, e o acesso permanece ativo até o fim do ciclo já pago.',
    keywords: 'renovação automática recorrente renova sozinha cobrança mensal anual',
  },
  {
    category: CAT_PAGAMENTO,
    question: 'Preciso de comprovante para reembolso pelo meu órgão/empresa?',
    answer:
      'Após o pagamento, você recebe automaticamente um **recibo da Stripe** no e-mail cadastrado, com valor, data e identificação do serviço. Esse recibo é aceito pela maioria dos órgãos públicos e empresas para fins de reembolso de capacitação.\n\nSe o seu órgão exigir documento fiscal específico (NF-e com CNPJ do contratante, por exemplo), entre em contato em [/contato](/contato) **antes** da contratação para alinharmos.',
    keywords: 'comprovante recibo nota fiscal nf cnpj cpf reembolso órgão público empresa',
  },

  // ===== CURSOS E CERTIFICADOS =====
  {
    category: CAT_CURSOS,
    isPinned: true,
    question: 'Como acesso meu curso após o pagamento?',
    answer:
      'Após a confirmação do pagamento (instantânea para cartão, alguns segundos para PIX), você recebe um e-mail de boas-vindas e o curso já fica disponível na [área restrita](/area-restrita).\n\nSe passaram mais de 10 minutos e o curso não apareceu, faça **logout e login novamente** para forçar o refresh da sessão. Caso o problema persista, contate [/contato](/contato).',
    keywords: 'acessar curso pagamento liberação ativação aulas confirmar',
  },
  {
    category: CAT_CURSOS,
    question: 'Por quanto tempo tenho acesso ao curso?',
    answer:
      'O acesso é vinculado à sua **assinatura ativa**. Enquanto a cobrança mensal ou anual estiver em dia, você tem acesso integral ao curso (Básico) ou a todos os cursos (Premium).\n\nUsuários que entraram via **QR Code de evento presencial** têm 1 mês de acesso trial. Após esse período, podem contratar uma assinatura para continuar.',
    keywords: 'tempo acesso curso quanto duração validade prazo expira',
  },
  {
    category: CAT_CURSOS,
    question: 'As aulas são ao vivo ou gravadas?',
    answer:
      'As aulas são **gravadas** e ficam disponíveis sob demanda — você assiste no seu ritmo, quantas vezes quiser, no horário que for melhor. Acompanhe seu progresso na seção **Meu Progresso** da área restrita, que registra automaticamente as aulas concluídas, XP acumulado e badges conquistados.',
    keywords: 'aulas ao vivo gravadas online ritmo sob demanda quando assistir',
  },
  {
    category: CAT_CURSOS,
    isPinned: true,
    question: 'Recebo certificado ao concluir o curso?',
    answer:
      'Sim! Quando você completa **100% das aulas** + **100% dos quizzes obrigatórios** de um curso, um certificado digital é emitido automaticamente em seu nome.\n\nO certificado tem:\n\n- **Número único** rastreável publicamente em `/certificado/[numero]`\n- **QR Code** para verificação\n- **PDF para download**\n- **Botão de compartilhamento no LinkedIn**\n\nVocê encontra todos os seus certificados em [/area-restrita/meus-certificados](/area-restrita/meus-certificados).',
    keywords: 'certificado conclusão concluir terminar diploma linkedin pdf comprovante',
  },
  {
    category: CAT_CURSOS,
    question: 'Existe ordem obrigatória para assistir as aulas?',
    answer:
      'Em geral, você pode navegar livremente. Algumas aulas específicas têm **pré-requisitos** definidos pelo professor (ex: uma aula avançada exige que você tenha concluído a aula introdutória correspondente). Nesses casos, um ícone de **cadeado** indica que a aula ainda está bloqueada, e você verá qual aula precisa concluir antes.',
    keywords: 'ordem aulas pré-requisito bloqueada cadeado sequência módulos',
  },
  {
    category: CAT_CURSOS,
    question: 'Posso baixar os materiais em PDF?',
    answer:
      'Sim. Materiais complementares (slides, planilhas, modelos de documentos, ementas em PDF) ficam disponíveis para download dentro de cada aula. A maior parte da [base de conhecimento](/base-conhecimento) (Orientações Normativas da AGU, Pareceres do CONUNI, Acórdãos TCU) também é pública e pode ser baixada sem assinatura.',
    keywords: 'baixar download pdf material slides planilha modelo offline',
  },

  // ===== SUPORTE E OUTROS =====
  {
    category: CAT_OUTROS,
    isPinned: true,
    question: 'Como entro em contato com o suporte?',
    answer:
      'O canal oficial é o formulário em [/contato](/contato). Respondemos em até **2 dias úteis** (geralmente bem mais rápido).\n\nPara questões urgentes envolvendo cobrança, inclua no assunto **"Cobrança urgente"** e nós priorizamos.\n\nNão fazemos atendimento jurídico personalizado por esse canal — o site é uma plataforma educacional, não substitui consulta a advogado para casos concretos.',
    keywords: 'contato suporte ajuda atendimento falar com email telefone',
  },
  {
    category: CAT_OUTROS,
    question: 'Posso pedir parecer ou consulta jurídica pelo site?',
    answer:
      'Não. O site é uma **plataforma educacional** de Direito Administrativo, Licitações e Contratos. Os materiais, aulas, jurisprudência comentada e Assistente IA têm finalidade exclusivamente **didática e informativa**, e não substituem a consultoria de um advogado em casos concretos.\n\nO Prof. Daniel Barral é Procurador Federal e Mestre em Direito Público, mas não atua em consultoria privada particular pelo site.',
    keywords: 'parecer consulta jurídica advogado caso concreto particular processo',
  },
  {
    category: CAT_OUTROS,
    question: 'O site funciona bem em celular?',
    answer:
      'Sim. O site é **100% responsivo** e foi otimizado para uso em smartphones e tablets. Toda a navegação, leitura de aulas, jurisprudência, Lei 14.133 comentada e área restrita funcionam normalmente em telas pequenas.\n\nVocê também pode **instalar o site como aplicativo** (PWA — Progressive Web App): no Chrome do Android, toque em **"Adicionar à tela inicial"**; no Safari do iPhone, toque em compartilhar → **"Adicionar à Tela de Início"**.',
    keywords: 'celular mobile smartphone tablet responsivo app aplicativo pwa instalar',
  },
];

async function main() {
  console.log(`\n📋 Seed FAQ — ${FAQS.length} perguntas`);
  console.log(`   Categorias: ${Array.from(new Set(FAQS.map((f) => f.category))).join(', ')}`);
  console.log(`   Pinned: ${FAQS.filter((f) => f.isPinned).length}`);

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN — nenhuma alteração será feita\n');
    const byCat: Record<string, SeedFAQ[]> = {};
    for (const f of FAQS) {
      byCat[f.category] = byCat[f.category] || [];
      byCat[f.category].push(f);
    }
    for (const [cat, items] of Object.entries(byCat)) {
      console.log(`\n📂 ${cat} (${items.length})`);
      items.forEach((f, i) => {
        console.log(`   ${i + 1}. ${f.isPinned ? '📌 ' : ''}${f.question}`);
      });
    }
    await prisma.$disconnect();
    return;
  }

  const existing = await prisma.fAQ.count();
  console.log(`\n📊 FAQs existentes no banco: ${existing}`);

  if (existing > 0 && !FORCE) {
    console.log('\n⚠️  Já existem FAQs no banco. Use --force para inserir mesmo assim.');
    await prisma.$disconnect();
    return;
  }

  let created = 0;
  let skipped = 0;
  const byCatOrder: Record<string, number> = {};

  for (const seed of FAQS) {
    const order = (byCatOrder[seed.category] = (byCatOrder[seed.category] ?? -10) + 10);

    const dup = await prisma.fAQ.findFirst({
      where: { question: seed.question },
      select: { id: true },
    });
    if (dup) {
      skipped++;
      console.log(`   ⏭️  já existe: ${seed.question.slice(0, 60)}…`);
      continue;
    }

    await prisma.fAQ.create({
      data: {
        question: seed.question,
        answer: seed.answer,
        category: seed.category,
        displayOrder: order,
        isPinned: seed.isPinned ?? false,
        isPublished: true,
        keywords: seed.keywords ?? null,
      },
    });
    created++;
  }

  console.log(`\n✅ ${created} FAQs criadas, ${skipped} ignoradas (duplicatas).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Erro no seed:', err);
  prisma.$disconnect();
  process.exit(1);
});
