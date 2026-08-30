'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Instagram, Youtube, Linkedin, Send, CheckCircle, Loader2 } from 'lucide-react';
import { courses } from '@/data/courses';

export default function ContatoPage() {
  return (
    <Suspense fallback={
      <main className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block">
                <h1 className="text-5xl font-bold mb-3 text-ink-primary font-cinzel">Entre em Contato</h1>
                <div className="h-1.5 w-32 bg-surface-raised rounded-full mx-auto mb-6"></div>
              </div>
              <p className="text-xl text-ink-secondary leading-relaxed">
                Tire suas dúvidas, solicite informações sobre cursos ou contrate palestras
              </p>
            </div>
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            </div>
          </div>
        </div>
      </main>
    }>
      <ContatoContent />
    </Suspense>
  );
}

function ContatoContent() {
  const searchParams = useSearchParams();
  const motivo = searchParams.get('motivo');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    courseInterest: motivo === 'depoimento' ? 'depoimento' : '',
    message: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem');
      }

      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setFormData({
          name: '',
          email: '',
          phone: '',
          courseInterest: '',
          message: ''
        });
      }, 5000);
    } catch (err) {
      console.error('Erro ao enviar contato:', err);
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <main className="py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block">
              <h1 className="text-5xl font-bold mb-3 text-ink-primary font-cinzel">Entre em Contato</h1>
              <div className="h-1.5 w-32 bg-surface-raised rounded-full mx-auto mb-6"></div>
            </div>
            <p className="text-xl text-ink-secondary leading-relaxed">
              Tire suas dúvidas, solicite informações sobre cursos ou contrate palestras
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <div className="bg-surface-page rounded-md p-8 border border-border-subtle hover:border-brand-400 hover:shadow-2xl transition-all">
                <div className="inline-block mb-6">
                  <h2 className="text-2xl font-bold mb-2 text-ink-primary">Envie sua mensagem</h2>
                  <div className="h-1 w-24 bg-surface-raised rounded-full"></div>
                </div>

                {error && (
                  <div role="alert" className="bg-surface-raised border border-semantic-error rounded-md p-4 mb-6">
                    <p className="text-semantic-error font-medium">{error}</p>
                  </div>
                )}

                {isSubmitted ? (
                  <div role="alert" className="bg-surface-raised border-2 border-brand-500 rounded-md p-8 text-center">
                    <div className="w-20 h-20 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-12 h-12 text-surface-page" />
                    </div>
                    <h3 className="text-2xl font-bold text-ink-primary mb-3">Mensagem enviada com sucesso!</h3>
                    <p className="text-ink-primary text-lg font-medium">Retornaremos em breve pelo e-mail informado.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="name" className="block text-sm font-semibold text-ink-primary mb-2">
                          Nome completo <span className="text-semantic-error">*</span>
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          required
                          value={formData.name}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-border-strong rounded-[3px] focus:ring-2 focus:ring-primary-500 focus:border-primary-600 text-ink-primary"
                        />
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-ink-primary mb-2">
                          E-mail <span className="text-semantic-error">*</span>
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-border-strong rounded-[3px] focus:ring-2 focus:ring-primary-500 focus:border-primary-600 text-ink-primary"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="phone" className="block text-sm font-semibold text-ink-primary mb-2">
                          Telefone
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="(00) 00000-0000"
                          className="w-full px-4 py-2 border border-border-strong rounded-[3px] focus:ring-2 focus:ring-primary-500 focus:border-primary-600 text-ink-primary placeholder:text-ink-secondary"
                        />
                      </div>

                      <div>
                        <label htmlFor="courseInterest" className="block text-sm font-semibold text-ink-primary mb-2">
                          Curso de interesse
                        </label>
                        <select
                          id="courseInterest"
                          name="courseInterest"
                          value={formData.courseInterest}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-border-strong rounded-[3px] focus:ring-2 focus:ring-primary-500 focus:border-primary-600 text-ink-primary"
                        >
                          <option value="">Selecione um curso</option>
                          {courses.map((course) => (
                            <option key={course.id} value={course.title}>
                              {course.title}
                            </option>
                          ))}
                          <option value="curta-duracao">Cursos de Curta Duração</option>
                          <option value="depoimento">Depoimento ou elogio</option>
                          <option value="outros">Outros</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-sm font-semibold text-ink-primary mb-2">
                        {formData.courseInterest === 'depoimento' ? 'Seu Depoimento' : 'Mensagem'} <span className="text-semantic-error">*</span>
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={6}
                        value={formData.message}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-border-strong rounded-[3px] focus:ring-2 focus:ring-primary-500 focus:border-primary-600 text-ink-primary placeholder:text-ink-secondary"
                        placeholder={
                          formData.courseInterest === 'depoimento'
                            ? "Compartilhe sua experiência com os cursos do Prof. Daniel Barral..."
                            : "Descreva sua dúvida ou solicitação..."
                        }
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      aria-label="Enviar formulário de contato"
                      className="w-full bg-brand-600 text-surface-page px-6 py-4 rounded-md text-lg font-bold hover: transition-all hover:scale-105 flex items-center justify-center gap-2 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Enviar Mensagem
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="md:col-span-1 space-y-6">
              {/* SEÇÃO OCULTA - Informações de Contato
                  Para reativar: remova este comentário e o de fechamento
              <div className="bg-surface-page rounded-md p-6 border border-border-subtle hover:border-brand-400 hover:shadow-2xl transition-all">
                <div className="inline-block mb-4">
                  <h3 className="text-lg font-bold mb-2 text-ink-primary">Informações de Contato</h3>
                  <div className="h-1 w-16 bg-surface-raised rounded-full"></div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 bg-surface-raised p-3 rounded-md border-l-4 border-brand-500">
                    <div className="w-10 h-10 bg-surface-raised rounded-[3px] flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-surface-page" />
                    </div>
                    <div>
                      <p className="font-bold text-ink-primary">E-mail</p>
                      <p className="text-sm text-ink-primary font-medium">contato@profbarral.com.br</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-surface-raised p-3 rounded-md border-l-4 border-brand-600">
                    <div className="w-10 h-10 bg-surface-raised rounded-[3px] flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-surface-page" />
                    </div>
                    <div>
                      <p className="font-bold text-ink-primary">Telefone</p>
                      <p className="text-sm text-ink-primary font-medium">(71) 99999-9999</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-surface-raised p-3 rounded-md border-l-4 border-brand-600">
                    <div className="w-10 h-10 bg-surface-raised rounded-[3px] flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-surface-page" />
                    </div>
                    <div>
                      <p className="font-bold text-ink-primary">Localização</p>
                      <p className="text-sm text-ink-primary font-medium">Salvador - BA</p>
                    </div>
                  </div>
                </div>
              </div>
              FIM DA SEÇÃO OCULTA */}

              <div className="bg-surface-page rounded-md p-6 border border-border-subtle hover:border-brand-400 hover:shadow-2xl transition-all">
                <div className="inline-block mb-4">
                  <h3 className="text-lg font-bold mb-2 text-ink-primary">Redes Sociais</h3>
                  <div className="h-1 w-16 bg-surface-raised rounded-full"></div>
                </div>
                <div className="space-y-3">
                  <a
                    href="https://instagram.com/danbarral"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visite nosso perfil no Instagram"
                    className="flex items-center gap-3 bg-surface-raised p-3 rounded-md border-l-2 border-border-strong  transition-all group"
                  >
                    <div className="w-10 h-10 bg-surface-raised rounded-[3px] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Instagram className="w-5 h-5 text-surface-page" />
                    </div>
                    <span className="text-ink-primary font-bold">@danbarral</span>
                  </a>
                  <a
                    href="https://www.youtube.com/@danbarral"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visite nosso canal no YouTube"
                    className="flex items-center gap-3 bg-surface-raised p-3 rounded-md border-l-2 border-border-strong  transition-all group"
                  >
                    <div className="w-10 h-10 bg-surface-raised rounded-[3px] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Youtube className="w-5 h-5 text-surface-page" />
                    </div>
                    <span className="text-ink-primary font-bold">@danbarral</span>
                  </a>
                  <a
                    href="https://www.linkedin.com/in/daniel-de-andrade-oliveira-barral-b5110870/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visite nosso perfil no LinkedIn"
                    className="flex items-center gap-3 bg-surface-raised p-3 rounded-md border-l-2 border-border-strong  transition-all group"
                  >
                    <div className="w-10 h-10 bg-surface-raised rounded-[3px] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Linkedin className="w-5 h-5 text-surface-page" />
                    </div>
                    <span className="text-ink-primary font-bold">Daniel Barral</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}