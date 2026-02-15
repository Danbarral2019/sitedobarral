import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ChatInterface from '@/components/ChatInterface';
import Link from 'next/link';
import { ArrowLeft, Sparkles, BookOpen, MessageSquare, Zap } from 'lucide-react';

export const metadata = {
  title: 'Assistente Inteligente - Prof. Daniel Barral',
  description:
    'Faça perguntas sobre documentos e materiais do curso usando inteligência artificial',
};

// Course titles mapping (from COURSE_IDS_REFERENCE.md)
const COURSE_TITLES: Record<string, string> = {
  '1': 'Nova Lei de Licitações e Contratos (Lei nº 14.133/2021)',
  '2': 'Planejamento das Contratações Públicas',
  '3': 'Gestão e Fiscalização de Contratos Administrativos',
  '4': 'Processo Administrativo Sancionador',
  '5': 'Inovação nas Contratações Públicas',
  '6': 'Terceirização e Formação de Preços',
  '7': 'Assessoramento Jurídico na Nova Lei de Licitações',
  '8': 'Revisão, Reajuste e Repactuação',
  '9': 'Alterações Contratuais',
  '10': 'Contratação Direta',
};

async function getEnrollmentData(userId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId,
      OR: [
        { expiresAt: { gte: new Date() } },
        { isLifetime: true },
      ],
    },
    orderBy: {
      enrolledAt: 'desc',
    },
  });

  return enrollments;
}

export default async function AssistentePage() {
  // 1. Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    redirect('/login');
  }

  const payload = await verifyToken(token);

  if (!payload) {
    redirect('/login');
  }

  // 2. Get user enrollments
  const enrollments = await getEnrollmentData(payload.userId);

  if (enrollments.length === 0) {
    redirect('/area-restrita?error=no-enrollment');
  }

  // 3. Get primary course (most recent enrollment)
  const primaryEnrollment = enrollments[0];
  const courseTitle = COURSE_TITLES[primaryEnrollment.courseId] || 'Curso não encontrado';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="max-w-5xl mx-auto mb-8">
          <Link
            href="/area-restrita"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Área Restrita
          </Link>
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-blue-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Assistente Inteligente
                </h1>
                <p className="text-gray-600 text-lg">
                  Faça perguntas sobre qualquer documento do curso{' '}
                  <span className="font-semibold text-blue-600">
                    {courseTitle}
                  </span>
                </p>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    Busca Semântica
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Entende o contexto da sua pergunta
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg">
                <MessageSquare className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    Citações de Fontes
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Veja exatamente de onde vem cada resposta
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
                <Zap className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    Respostas Instantâneas
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Cache inteligente para consultas rápidas
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <ChatInterface
              courseId={primaryEnrollment.courseId}
              maxResults={5}
              placeholder="Digite sua pergunta sobre o curso..."
              suggestions={[
                'Quais são os requisitos para licitação na modalidade pregão?',
                'O que diz a lei sobre dispensa de licitação?',
                'Como funciona o processo de impugnação?',
                'Quais são os tipos de garantia em contratos administrativos?',
                'Explique o regime de contratação integrada',
              ]}
              className="h-[600px]"
            />
          </div>
        </div>

        {/* Help Section */}
        <div className="max-w-5xl mx-auto mt-8">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              💡 Dicas para melhores resultados
            </h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>
                  Seja específico: quanto mais clara a pergunta, melhor a resposta
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>
                  Use termos técnicos: o assistente conhece todos os documentos do
                  curso
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>
                  Verifique as fontes: cada resposta mostra os documentos consultados
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>
                  Reformule se necessário: tente diferentes formas de perguntar
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
