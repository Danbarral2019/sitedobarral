'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, Phone, MapPin, Instagram, Youtube, Linkedin, Send, CheckCircle } from 'lucide-react';
import { courses } from '@/data/courses';

export default function ContatoPage() {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
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
    }, 3000);
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
              <h1 className="text-5xl font-bold mb-3 text-gray-900">Entre em Contato</h1>
              <div className="h-1.5 w-32 bg-gradient-to-r from-blue-600 via-green-600 to-purple-600 rounded-full mx-auto mb-6"></div>
            </div>
            <p className="text-xl text-gray-700 leading-relaxed">
              Tire suas dúvidas, solicite informações sobre cursos ou contrate palestras
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200 hover:border-blue-400 hover:shadow-2xl transition-all">
                <div className="inline-block mb-6">
                  <h2 className="text-2xl font-bold mb-2 text-gray-900">Envie sua mensagem</h2>
                  <div className="h-1 w-24 bg-gradient-to-r from-blue-600 to-green-600 rounded-full"></div>
                </div>
                
                {isSubmitted ? (
                  <div className="bg-gradient-to-r from-green-50 to-teal-100 border-2 border-green-500 rounded-2xl p-8 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
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
                          Nome completo *
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
                          E-mail *
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
                          <option value="in-company">Curso In Company</option>
                          <option value="depoimento">⭐ Depoimento/Elogio</option>
                          <option value="outros">Outros</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-sm font-semibold text-gray-900 mb-2">
                        {formData.courseInterest === 'depoimento' ? 'Seu Depoimento *' : 'Mensagem *'}
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
                      aria-label="Enviar formulário de contato"
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-xl text-lg font-bold hover:from-blue-700 hover:to-blue-800 transition-all hover:scale-105 flex items-center justify-center gap-2 shadow-lg hover:shadow-2xl"
                    >
                      <Send className="w-5 h-5" />
                      Enviar Mensagem
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="md:col-span-1 space-y-6">
              {/* SEÇÃO OCULTA - Informações de Contato
                  Para reativar: remova este comentário e o de fechamento
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200 hover:border-blue-400 hover:shadow-2xl transition-all">
                <div className="inline-block mb-4">
                  <h3 className="text-lg font-bold mb-2 text-gray-900">Informações de Contato</h3>
                  <div className="h-1 w-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-xl border-l-4 border-blue-500">
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

              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200 hover:border-purple-400 hover:shadow-2xl transition-all">
                <div className="inline-block mb-4">
                  <h3 className="text-lg font-bold mb-2 text-gray-900">Redes Sociais</h3>
                  <div className="h-1 w-16 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full"></div>
                </div>
                <div className="space-y-3">
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visite nosso perfil no Instagram"
                    className="flex items-center gap-3 bg-gradient-to-r from-pink-50 to-rose-100 p-3 rounded-xl border-l-4 border-pink-500 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Instagram className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-gray-900 font-bold">@profbarral</span>
                  </a>
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visite nosso canal no YouTube"
                    className="flex items-center gap-3 bg-gradient-to-r from-red-50 to-orange-100 p-3 rounded-xl border-l-4 border-red-500 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Youtube className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-gray-900 font-bold">Prof. Daniel Barral</span>
                  </a>
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visite nosso perfil no LinkedIn"
                    className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-cyan-100 p-3 rounded-xl border-l-4 border-blue-500 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Linkedin className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-gray-900 font-bold">Daniel Barral</span>
                  </a>
                </div>
              </div>

              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-600 via-teal-600 to-blue-600 opacity-95"></div>
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02ek0yNCAzOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>
                <div className="relative p-6 rounded-2xl">
                  <div className="inline-block mb-3">
                    <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      <span className="text-white font-semibold text-sm">🎯 Treinamento In Company</span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-white">Cursos In Company</h3>
                  <p className="text-base text-white mb-4 leading-relaxed">
                    Levamos nossos cursos para sua instituição com conteúdo personalizado
                    para as necessidades específicas da sua equipe.
                  </p>
                  <p className="text-base text-white font-semibold">
                    Solicite uma proposta através do formulário ao lado.
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-white">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Conteúdo Customizado</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}