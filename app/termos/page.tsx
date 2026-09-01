import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Termos e condições de uso da plataforma de cursos e serviços do Site do Prof. Daniel Barral.',
  alternates: { canonical: '/termos' },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = '25 de abril de 2026';

export default function TermosPage() {
  return (
    <main className="py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <header className="mb-10">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-ink-primary mb-3">
              Termos de Uso
            </h1>
            <div className="h-1 w-32 bg-brand-500 rounded-full mb-4" />
            <p className="text-sm text-ink-muted font-sans">
              Última atualização: {LAST_UPDATED}
            </p>
          </header>

          <article className="bg-white rounded-[6px] p-8 md:p-10 border-2 border-border-subtle font-sans text-ink-secondary leading-relaxed">
            <Section number="1" title="Identificação">
              <p>
                Este site e os serviços associados são oferecidos por{' '}
                <strong>LICITAÇÃOPRO TREINAMENTOS AVANÇADOS EM PROCESSOS CONTRATUAIS LTDA.</strong>,
                inscrita no CNPJ sob o nº <strong>53.875.260/0001-77</strong>, com sede na
                Rua 15, Lote 27, Setor Leste, Padre Bernardo-GO, CEP 73700-000
                (doravante, &quot;Site do Prof. Daniel Barral&quot; ou &quot;nós&quot;).
              </p>
              <p className="mt-3">
                Contato:{' '}
                <a href="mailto:contato@profdanielbarral.com" className="text-brand-600 hover:underline">
                  contato@profdanielbarral.com
                </a>{' '}
                · Telefone: (32) 3025-0102
              </p>
            </Section>

            <Section number="2" title="Objeto">
              <p>
                Disponibilizamos uma plataforma online de cursos sobre Direito Administrativo,
                com foco na Lei nº 14.133/2021 (Nova Lei de Licitações), incluindo videoaulas,
                materiais de apoio, glossário, jurisprudência selecionada, atos normativos,
                assistente de inteligência artificial jurídica e demais recursos divulgados
                no site.
              </p>
            </Section>

            <Section number="3" title="Cadastro e conta de usuário">
              <ul className="list-disc pl-6 space-y-1.5">
                <li>O acesso à área restrita exige cadastro com dados verdadeiros e atualizados.</li>
                <li>A conta é pessoal e intransferível; o compartilhamento de credenciais é vedado.</li>
                <li>Você é responsável pela guarda de sua senha e por qualquer uso da sua conta.</li>
                <li>Reservamo-nos o direito de suspender contas que descumpram estes Termos.</li>
              </ul>
            </Section>

            <Section number="4" title="Planos, preços e formas de pagamento">
              <ul className="list-disc pl-6 space-y-1.5">
                <li>
                  <strong>Plano Básico:</strong> acesso a 1 (um) curso à sua escolha durante a vigência
                  da assinatura.
                </li>
                <li>
                  <strong>Plano Premium:</strong> acesso a todos os cursos disponíveis e ao Assistente
                  de IA jurídica.
                </li>
                <li>
                  Cobrança recorrente (mensal ou anual) processada pela{' '}
                  <strong>Stripe Pagamentos do Brasil Ltda.</strong>
                </li>
                <li>
                  Aceitamos cartões de crédito (Visa, Mastercard, Elo, American Express e outros
                  suportados pela Stripe). Pix Automático será disponibilizado em breve.
                </li>
                <li>
                  Preços em reais (BRL). Reajustes anuais, quando aplicáveis, observarão índice
                  oficial (IPCA) e serão comunicados com 30 dias de antecedência.
                </li>
              </ul>
            </Section>

            <Section number="5" title="Renovação automática e cancelamento">
              <ul className="list-disc pl-6 space-y-1.5">
                <li>
                  A assinatura é renovada automaticamente ao fim de cada ciclo (mensal ou anual)
                  até que você cancele.
                </li>
                <li>
                  O cancelamento pode ser feito a qualquer momento pelo <em>Portal do Cliente</em>,
                  acessível pelo badge de seu plano dentro da Área Restrita.
                </li>
                <li>
                  O cancelamento passa a vigorar ao final do ciclo de cobrança já pago — seu acesso
                  é mantido até essa data.
                </li>
                <li>Não há multa de fidelidade nem taxa de cancelamento.</li>
              </ul>
            </Section>

            <Section number="6" title="Direito de arrependimento (CDC, art. 49)">
              <p>
                Você pode desistir da contratação em até <strong>7 (sete) dias corridos</strong>,
                contados da assinatura, sem necessidade de justificativa, com direito ao
                <strong> reembolso integral</strong> do valor pago. Para exercer este direito,
                envie um e-mail para{' '}
                <a href="mailto:contato@profdanielbarral.com" className="text-brand-600 hover:underline">
                  contato@profdanielbarral.com
                </a>{' '}
                com o assunto &quot;Direito de arrependimento&quot;. O reembolso é processado pela
                Stripe e pode levar alguns dias úteis para aparecer no seu cartão.
              </p>
            </Section>

            <Section number="7" title="Acesso ao conteúdo">
              <ul className="list-disc pl-6 space-y-1.5">
                <li>
                  Durante a vigência da assinatura, você tem acesso aos cursos do plano contratado,
                  exclusivamente para uso pessoal e não comercial.
                </li>
                <li>
                  O conteúdo é disponibilizado por <em>streaming</em>; não oferecemos download
                  oficial dos vídeos.
                </li>
                <li>
                  O acesso a conteúdo adquirido por matrícula presencial ou via QR Code segue as
                  regras específicas dessa contratação.
                </li>
              </ul>
            </Section>

            <Section number="8" title="Propriedade intelectual">
              <p>
                Todo o conteúdo da plataforma — textos, vídeos, slides, imagens, software, marca,
                identidade visual e layout — é de titularidade da LICITAÇÃOPRO TREINAMENTOS
                AVANÇADOS LTDA. ou de terceiros que nos licenciaram seu uso, protegido pela Lei
                de Direitos Autorais (Lei nº 9.610/98) e demais normas aplicáveis.
              </p>
              <p className="mt-3">É <strong>expressamente proibido</strong>:</p>
              <ul className="list-disc pl-6 space-y-1.5 mt-2">
                <li>Copiar, reproduzir, distribuir, comercializar ou disponibilizar conteúdo;</li>
                <li>Compartilhar credenciais de acesso com terceiros;</li>
                <li>Gravar, baixar ou retransmitir aulas, ao vivo ou gravadas;</li>
                <li>
                  Utilizar o conteúdo como base para criação de materiais didáticos próprios
                  sem autorização escrita.
                </li>
              </ul>
              <p className="mt-3">
                A violação acarreta cancelamento da conta sem reembolso e responsabilização nas
                esferas civil e penal.
              </p>
            </Section>

            <Section number="9" title="Conduta vedada">
              <p>Você concorda em não:</p>
              <ul className="list-disc pl-6 space-y-1.5 mt-2">
                <li>Utilizar engenharia reversa em qualquer parte do sistema;</li>
                <li>Tentar acesso a áreas restritas sem autorização;</li>
                <li>Inserir conteúdo ofensivo, ilegal ou difamatório nos comentários ou interações;</li>
                <li>Compartilhar a conta com terceiros;</li>
                <li>Praticar qualquer ato que prejudique a operação da plataforma.</li>
              </ul>
            </Section>

            <Section number="10" title="Limitação de responsabilidade">
              <ul className="list-disc pl-6 space-y-1.5">
                <li>
                  O conteúdo tem natureza educacional e <strong>não substitui consultoria
                  jurídica individualizada</strong>.
                </li>
                <li>
                  Não nos responsabilizamos por decisões tomadas com base no conteúdo dos cursos.
                </li>
                <li>
                  Não garantimos disponibilidade ininterrupta — manutenções programadas serão
                  comunicadas previamente sempre que possível.
                </li>
                <li>
                  Em caso de indisponibilidade prolongada da plataforma por causa exclusiva nossa,
                  prorrogaremos a assinatura pelo período equivalente.
                </li>
              </ul>
            </Section>

            <Section number="11" title="Modificações destes Termos">
              <p>
                Podemos modificar estes Termos a qualquer tempo. Alterações relevantes serão
                comunicadas por e-mail com pelo menos <strong>30 dias de antecedência</strong>.
                O uso continuado da plataforma após a vigência das mudanças implica aceitação.
              </p>
            </Section>

            <Section number="12" title="Tratamento de dados pessoais">
              <p>
                O tratamento dos seus dados pessoais segue nossa{' '}
                <Link href="/privacidade" className="text-brand-600 hover:underline">
                  Política de Privacidade
                </Link>
                , em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
              </p>
            </Section>

            <Section number="13" title="Lei aplicável e foro">
              <p>
                Estes Termos são regidos pelas leis da República Federativa do Brasil. Eventuais
                conflitos serão dirimidos no <strong>foro do domicílio do consumidor</strong>,
                conforme art. 101, I, do Código de Defesa do Consumidor.
              </p>
            </Section>

            <p className="mt-10 text-sm text-ink-muted italic">
              Em caso de dúvida sobre qualquer cláusula, entre em contato conosco pelo e-mail{' '}
              <a href="mailto:contato@profdanielbarral.com" className="text-brand-600 hover:underline">
                contato@profdanielbarral.com
              </a>
              .
            </p>
          </article>
        </div>
      </div>
    </main>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="font-heading font-semibold text-xl md:text-2xl text-ink-primary mb-3">
        <span className="text-brand-600 mr-2">{number}.</span>
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
