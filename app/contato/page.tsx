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
                <h1 className="text-5xl font-bold mb-3 text-gray-900 font-cinzel">Entre em Contato</h1>
                <div className="h-1.5 w-32 bg-gradient-to-r from-brand-500 to-brand-600 rounded-full mx-auto mb-6"></div>
              </div>
              <p className="text-xl text-gray-700 leading-relaxed">
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
              <h1 className="text-5xl font-bold mb-3 text-gray-900 font-cinzel">Entre em Contato</h1>
              <div className="h-1.5 w-32 bg-gradient-to-r from-brand-500 to-brand-600 rounded-full mx-auto mb-6"></div>
            </div>
            <p className="text-xl text-gray-700 leading-relaxed">
              Tire suas dúvidas, solicite informações sobre cursos ou contrate palestras
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200 hover:border-brand-400 hover:shadow-2xl transition-all">
                <div className="inline-block mb-6">
                  <h2 className="text-2xl font-bold mb-2 text-gray-900">Envie sua mensagem</h2>
                  <div className="h-1 w-24 bg-gradient-to-r from-brand-500 to-brand-600 rounded-full"></div>
                </div>

                {error && (
                  <div role="alert" className="bg-red-50 border-2 border-red-500 rounded-xl p-4 mb-6">
                    <p className="text-red-800 font-medium">{error}</p>
                  </div>
                )}

                {isSubmitted ? (
                  <div role="alert" className="bg-gradient-to-r from-brand-50 to-brand-100 border-2 border-brand-500 rounded-2xl p-8 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-brand-500 to-brand-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <CheckCircle className="w-12 h-12 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">Mensagem enviada com sucesso!</h3>
                    <p className="text-gray-800 text-lg font-medium">Retornaremos em breve pelo e-mail informado.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="name" className="block text-sm font-semibold text-gray-900 mb-2">
                          Nome completo <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          required
                          value={formData.name}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-600 text-gray-900"
                        />
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                          E-mail <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-600 text-gray-900"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="phone" className="block text-sm font-semibold text-gray-900 mb-2">
                          Telefone
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="(00) 00000-0000"
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-600 text-gray-900 placeholder:text-gray-600"
                        />
                      </div>

                      <div>
                        <label htmlFor="courseInterest" className="block text-sm font-semibold text-gray-900 mb-2">
                          Curso de interesse
                        </label>
                        <select
                          id="courseInterest"
                          name="courseInterest"
                          value={formData.courseInterest}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-600 text-gray-900"
                        >
                          <option value="">Selecione um curso</option>
                          {courses.map((course) => (
                            <option key={course.id} value={course.title}>
                              {course.title}
                            </option>
                          ))}
                          <option value="curta-duracao">Cursos de Curta Duração</option>
                          <option value="depoimento">⭐ Depoimento/Elogio</option>
                          <option value="outros">Outros</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-sm font-semibold text-gray-900 mb-2">
                        {formData.courseInterest === 'depoimento' ? 'Seu Depoimento' : 'Mensagem'} <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={6}
                        value={formData.message}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-600 text-gray-900 placeholder:text-gray-600"
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
                      className="w-full bg-gradient-to-r from-brand-600 to-brand-700 text-white px-6 py-4 rounded-xl text-lg font-bold hover:from-blue-700 hover:to-blue-800 transition-all hover:scale-105 flex items-center justify-center gap-2 shadow-lg hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200 hover:border-brand-400 hover:shadow-2xl transition-all">
                <div className="inline-block mb-4">
                  <h3 className="text-lg font-bold mb-2 text-gray-900">Informações de Contato</h3>
                  <div className="h-1 w-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 bg-gradient-to-r from-brand-50 to-brand-100 p-3 rounded-xl border-l-4 border-brand-500">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">E-mail</p>
                      <p className="text-sm text-gray-800 font-medium">contato@profbarral.com.br</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-xl border-l-4 border-green-500">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">Telefone</p>
                      <p className="text-sm text-gray-800 font-medium">(71) 99999-9999</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-gradient-to-r from-purple-50 to-purple-100 p-3 rounded-xl border-l-4 border-purple-500">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">Localização</p>
                      <p className="text-sm text-gray-800 font-medium">Salvador - BA</p>
                    </div>
                  </div>
                </div>
              </div>
              FIM DA SEÇÃO OCULTA */}

              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200 hover:border-brand-400 hover:shadow-2xl transition-all">
                <div className="inline-block mb-4">
                  <h3 className="text-lg font-bold mb-2 text-gray-900">Redes Sociais</h3>
                  <div className="h-1 w-16 bg-gradient-to-r from-brand-500 to-brand-600 rounded-full"></div>
                </div>
                <div className="space-y-3">
                  <a
                    href="https://instagram.com/danbarral"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visite nosso perfil no Instagram"
                    className="flex items-center gap-3 bg-gradient-to-r from-pink-50 to-purple-50 p-3 rounded-xl border-l-4 border-pink-500 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Instagram className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-gray-900 font-bold">@danbarral</span>
                  </a>
                  <a
                    href="https://www.youtube.com/@danbarral"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visite nosso canal no YouTube"
                    className="flex items-center gap-3 bg-gradient-to-r from-red-50 to-red-100 p-3 rounded-xl border-l-4 border-red-600 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Youtube className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-gray-900 font-bold">@danbarral</span>
                  </a>
                  <a
                    href="https://www.linkedin.com/in/daniel-de-andrade-oliveira-barral-b5110870/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visite nosso perfil no LinkedIn"
                    className="flex items-center gap-3 bg-gradient-to-r from-brand-50 to-brand-100 p-3 rounded-xl border-l-4 border-blue-700 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-brand-700 to-brand-800 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Linkedin className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-gray-900 font-bold">Daniel Barral</span>
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