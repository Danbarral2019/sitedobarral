import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Site do Prof. Daniel Barral',
  description: 'Como tratamos seus dados pessoais em conformidade com a LGPD (Lei nº 13.709/2018).',
  alternates: { canonical: '/privacidade' },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = '25 de abril de 2026';
const DPO_EMAIL = 'dpo@profdanielbarral.com';

export default function PrivacidadePage() {
  return (
    <main className="py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <header className="mb-10">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-ink-primary mb-3">
              Política de Privacidade
            </h1>
            <div className="h-1 w-32 bg-brand-500 rounded-full mb-4" />
            <p className="text-sm text-ink-muted font-sans">
              Última atualização: {LAST_UPDATED}
            </p>
          </header>

          <article className="bg-white rounded-[6px] p-8 md:p-10 border-2 border-border-subtle font-sans text-ink-secondary leading-relaxed">
            <p className="mb-8 text-ink-secondary">
              Esta Política descreve como tratamos seus dados pessoais quando você utiliza o
              Site do Prof. Daniel Barral, em conformidade com a Lei Geral de Proteção de Dados
              Pessoais — <strong>LGPD (Lei nº 13.709/2018)</strong>.
            </p>

            <Section number="1" title="Quem somos (Controlador dos dados)">
              <p>
                <strong>LICITAÇÃOPRO TREINAMENTOS AVANÇADOS EM PROCESSOS CONTRATUAIS LTDA.</strong>
                <br />
                CNPJ: 53.875.260/0001-77
                <br />
                Endereço: Rua 15, Lote 27, Setor Leste, Padre Bernardo-GO, CEP 73700-000
                <br />
                Site:{' '}
                <a href="https://www.profdanielbarral.com" className="text-brand-600 hover:underline">
                  www.profdanielbarral.com
                </a>
              </p>
            </Section>

            <Section number="2" title="Quais dados coletamos">
              <h3 className="font-semibold text-ink-primary mt-4 mb-2">a) Dados de cadastro</h3>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>Nome completo</li>
                <li>E-mail</li>
                <li>Senha (armazenada com hash criptográfico irreversível)</li>
              </ul>

              <h3 className="font-semibold text-ink-primary mt-4 mb-2">b) Dados de pagamento</h3>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>
                  Os dados do seu cartão são processados <strong>diretamente pela Stripe</strong>;
                  não armazenamos número do cartão, CVV ou data de validade em nossos servidores.
                </li>
                <li>Mantemos apenas referências (ID do cliente Stripe e ID da assinatura).</li>
              </ul>

              <h3 className="font-semibold text-ink-primary mt-4 mb-2">c) Dados de uso da plataforma</h3>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>Histórico de buscas (para melhorar a relevância da busca por IA)</li>
                <li>Progresso em cursos e marcações</li>
                <li>Endereço IP, navegador e sistema operacional (logs técnicos)</li>
                <li>Páginas visitadas (Vercel Analytics — métricas agregadas, sem cookies)</li>
                <li>Erros técnicos (Sentry — IP, navegador, contexto da falha)</li>
              </ul>

              <h3 className="font-semibold text-ink-primary mt-4 mb-2">d) Dados de matrícula presencial (QR Code)</h3>
              <p>
                Quando aplicável, os dados coletados em eventos presenciais com matrícula via
                QR Code seguem as regras do contrato firmado naquela ocasião.
              </p>
            </Section>

            <Section number="3" title="Por que tratamos esses dados (finalidades e bases legais)">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-border-subtle text-left">
                      <th className="py-2 pr-3 font-semibold">Dados</th>
                      <th className="py-2 pr-3 font-semibold">Finalidade</th>
                      <th className="py-2 font-semibold">Base legal (LGPD art. 7º)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <Row d="Cadastro" f="Criar e manter sua conta" b="Execução de contrato" />
                    <Row d="Pagamento" f="Cobrar a assinatura" b="Execução de contrato" />
                    <Row d="Histórico de busca" f="Melhorar relevância da busca por IA" b="Legítimo interesse" />
                    <Row d="Logs técnicos" f="Operar a plataforma e prevenir fraudes" b="Legítimo interesse" />
                    <Row d="E-mails transacionais" f="Notificar sobre cobranças, cancelamentos, etc." b="Execução de contrato" />
                    <Row d="Newsletter (opcional)" f="Enviar conteúdo jurídico" b="Consentimento" />
                  </tbody>
                </table>
              </div>
            </Section>

            <Section number="4" title="Com quem compartilhamos">
              <p>
                Compartilhamos apenas os dados estritamente necessários, com prestadores de
                serviço que adotam padrões adequados de segurança e privacidade:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>
                  <strong>Stripe Pagamentos do Brasil Ltda.</strong> — processamento de pagamentos.{' '}
                  <a href="https://stripe.com/br/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                    Política da Stripe
                  </a>
                </li>
                <li>
                  <strong>Resend Inc.</strong> (EUA) — envio de e-mails transacionais.{' '}
                  <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                    Política da Resend
                  </a>
                </li>
                <li>
                  <strong>Vercel Inc.</strong> (EUA) — hospedagem e analytics.{' '}
                  <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                    Política da Vercel
                  </a>
                </li>
                <li>
                  <strong>Neon Inc.</strong> (EUA) — banco de dados.{' '}
                  <a href="https://neon.tech/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                    Política da Neon
                  </a>
                </li>
                <li>
                  <strong>Functional Software Inc. (Sentry)</strong> (EUA) — monitoramento de erros.{' '}
                  <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                    Política da Sentry
                  </a>
                </li>
              </ul>
              <p className="mt-3">
                Eventuais transferências internacionais ocorrem com base em garantias adequadas
                (LGPD art. 33, II — provedores que adotam padrões equivalentes ao GDPR).
              </p>
              <p className="mt-3">
                <strong>Não vendemos seus dados pessoais para terceiros.</strong>
              </p>
            </Section>

            <Section number="5" title="Por quanto tempo guardamos">
              <ul className="list-disc pl-6 space-y-1.5">
                <li>
                  <strong>Dados de cadastro:</strong> enquanto a conta estiver ativa e por
                  até 5 anos após o encerramento (CDC, art. 27).
                </li>
                <li>
                  <strong>Dados de pagamento e faturas:</strong> 5 anos para fins fiscais e de
                  auditoria.
                </li>
                <li>
                  <strong>Logs técnicos:</strong> até 12 meses.
                </li>
                <li>
                  <strong>Registros de e-mails transacionais:</strong> até 2 anos.
                </li>
              </ul>
            </Section>

            <Section number="6" title="Seus direitos como titular (LGPD art. 18)">
              <p>Você pode, a qualquer momento e gratuitamente:</p>
              <ul className="list-disc pl-6 space-y-1.5 mt-3">
                <li>Confirmar a existência de tratamento dos seus dados;</li>
                <li>Acessar seus dados;</li>
                <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
                <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários;</li>
                <li>Portar seus dados para outro fornecedor;</li>
                <li>Eliminar dados tratados com base em consentimento;</li>
                <li>Obter informação sobre as entidades com quem compartilhamos dados;</li>
                <li>Revogar consentimento.</li>
              </ul>
              <p className="mt-3">
                Para exercer qualquer direito, envie um e-mail para{' '}
                <a href={`mailto:${DPO_EMAIL}`} className="text-brand-600 hover:underline">
                  {DPO_EMAIL}
                </a>
                , identificando-se e descrevendo sua solicitação. Responderemos em até{' '}
                <strong>15 (quinze) dias</strong>.
              </p>
              <p className="mt-3">
                Você também pode apresentar reclamação à{' '}
                <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                  Autoridade Nacional de Proteção de Dados (ANPD)
                </a>
                .
              </p>
            </Section>

            <Section number="7" title="Cookies">
              <p>Utilizamos cookies estritamente necessários para:</p>
              <ul className="list-disc pl-6 space-y-1.5 mt-3">
                <li>Manter sua sessão autenticada após o login;</li>
                <li>Lembrar suas preferências de exibição.</li>
              </ul>
              <p className="mt-3">
                <strong>Não usamos cookies de rastreamento publicitário</strong> nem cookies de
                terceiros para perfil de marketing. O Vercel Analytics opera sem cookies, com
                métricas estritamente agregadas.
              </p>
            </Section>

            <Section number="8" title="Segurança">
              <p>Adotamos medidas técnicas e administrativas para proteger seus dados:</p>
              <ul className="list-disc pl-6 space-y-1.5 mt-3">
                <li>Criptografia em trânsito (HTTPS/TLS);</li>
                <li>Hashing de senhas com algoritmo bcrypt;</li>
                <li>Acesso restrito ao banco de dados, com credenciais isoladas por ambiente;</li>
                <li>Logs de auditoria para acessos administrativos;</li>
                <li>Atualizações regulares de dependências e patches de segurança.</li>
              </ul>
              <p className="mt-3">
                Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos
                titulares, notificaremos os afetados e a ANPD nos prazos legais.
              </p>
            </Section>

            <Section number="9" title="Encarregado pela Proteção de Dados (DPO)">
              <p>
                Para qualquer assunto relacionado ao tratamento de dados pessoais, contate
                nosso Encarregado pelo e-mail:{' '}
                <a href={`mailto:${DPO_EMAIL}`} className="text-brand-600 hover:underline font-semibold">
                  {DPO_EMAIL}
                </a>
              </p>
            </Section>

            <Section number="10" title="Alterações desta Política">
              <p>
                Podemos atualizar esta Política periodicamente. Mudanças relevantes serão
                comunicadas por e-mail aos titulares com pelo menos <strong>30 dias de
                antecedência</strong>. A versão mais recente está sempre disponível em{' '}
                <Link href="/privacidade" className="text-brand-600 hover:underline">
                  www.profdanielbarral.com/privacidade
                </Link>
                .
              </p>
            </Section>

            <p className="mt-10 text-sm text-ink-muted italic">
              Esta Política deve ser lida em conjunto com nossos{' '}
              <Link href="/termos" className="text-brand-600 hover:underline">
                Termos de Uso
              </Link>
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

function Row({ d, f, b }: { d: string; f: string; b: string }) {
  return (
    <tr className="border-b border-border-subtle">
      <td className="py-2 pr-3 align-top">{d}</td>
      <td className="py-2 pr-3 align-top">{f}</td>
      <td className="py-2 align-top">{b}</td>
    </tr>
  );
}
