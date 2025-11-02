import Link from 'next/link';
import { memo } from 'react';
import { Instagram, Youtube, Linkedin, Mail } from 'lucide-react';

export const Footer = memo(function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Prof. Daniel Barral</h3>
            <p className="text-sm mb-2">Procurador Federal</p>
            <p className="text-sm mb-2">Mestre em Direito Público</p>
            <p className="text-sm">Especialista em Licitações e Contratos Administrativos</p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Links Rápidos</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/sobre" className="text-sm hover:text-primary-400 transition-colors">
                  Sobre o Professor
                </Link>
              </li>
              <li>
                <Link href="/cursos" className="text-sm hover:text-primary-400 transition-colors">
                  Cursos Disponíveis
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-sm hover:text-primary-400 transition-colors">
                  Blog Jurídico
                </Link>
              </li>
              <li>
                <Link href="/glossario" className="text-sm hover:text-primary-400 transition-colors">
                  Glossário
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm hover:text-primary-400 transition-colors">
                  Perguntas Frequentes
                </Link>
              </li>
              <li>
                <Link href="/contato" className="text-sm hover:text-primary-400 transition-colors">
                  Contato
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Principais Cursos</h4>
            <ul className="space-y-2">
              <li>
                <Link 
                  href="/cursos/nova-lei-licitacoes" 
                  className="text-sm hover:text-primary-400 transition-colors"
                >
                  Nova Lei de Licitações
                </Link>
              </li>
              <li>
                <Link 
                  href="/cursos/gestao-fiscalizacao-contratos" 
                  className="text-sm hover:text-primary-400 transition-colors"
                >
                  Gestão de Contratos
                </Link>
              </li>
              <li>
                <Link 
                  href="/cursos/processo-sancionador" 
                  className="text-sm hover:text-primary-400 transition-colors"
                >
                  Processo Sancionador
                </Link>
              </li>
              <li>
                <Link 
                  href="/cursos/contratacao-direta" 
                  className="text-sm hover:text-primary-400 transition-colors"
                >
                  Contratação Direta
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Redes Sociais</h4>
            <div className="flex flex-wrap gap-3 mb-6">
              <a
                href="https://instagram.com/danbarral"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram do Prof. Daniel Barral"
                className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-primary-600 transition-colors"
              >
                <Instagram className="w-6 h-6" />
              </a>
              <a
                href="https://www.youtube.com/@danbarral"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube do Prof. Daniel Barral"
                className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-primary-600 transition-colors"
              >
                <Youtube className="w-6 h-6" />
              </a>
              <a
                href="https://www.linkedin.com/in/daniel-de-andrade-oliveira-barral-b5110870/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn do Prof. Daniel Barral"
                className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-primary-600 transition-colors"
              >
                <Linkedin className="w-6 h-6" />
              </a>
            </div>

            <h4 className="text-white font-semibold mb-3">Newsletter</h4>
            <p className="text-sm mb-3">Receba novidades e materiais exclusivos</p>
            <form className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="Seu e-mail"
                className="flex-1 px-4 py-2.5 bg-gray-800 rounded-lg sm:rounded-l-lg sm:rounded-r-none text-sm focus:outline-none focus:bg-gray-700 focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                className="bg-primary-600 px-6 py-2.5 rounded-lg sm:rounded-l-none sm:rounded-r-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                <span className="sm:hidden">Assinar</span>
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-6 md:mt-8 pt-6 md:pt-8 text-center">
          <p className="text-sm px-4">
            © {new Date().getFullYear()} Prof. Daniel Barral. Todos os direitos reservados.
          </p>
          <p className="text-xs mt-2 text-gray-500 px-4">
            Desenvolvido com dedicação para compartilhar conhecimento em Direito Administrativo
          </p>
        </div>
      </div>
    </footer>
  );
});