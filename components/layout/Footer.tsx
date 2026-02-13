import Link from 'next/link';
import Image from 'next/image';
import { memo } from 'react';
import { Instagram, Youtube, Linkedin } from 'lucide-react';

export const Footer = memo(function Footer() {
  return (
    <footer className="bg-brand-700 text-brand-100">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {/* Coluna 1: Sobre */}
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 relative">
                <Image
                  src="/brand/logo-icon.png"
                  alt="Logo Prof. Daniel Barral"
                  fill
                  className="object-contain opacity-90"
                />
              </div>
              <h3 className="text-white font-cinzel font-semibold text-lg tracking-wide">
                Daniel Barral
              </h3>
            </div>
            <p className="text-sm font-poppins text-brand-200 mb-2">Procurador Federal</p>
            <p className="text-sm font-poppins text-brand-200 mb-2">Mestre em Direito Público</p>
            <p className="text-sm font-poppins text-brand-200">
              Especialista em Licitações e Contratos Administrativos
            </p>

            {/* Redes Sociais */}
            <div className="flex gap-3 mt-6">
              <a
                href="https://instagram.com/danbarral"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram do Prof. Daniel Barral"
                className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center hover:bg-brand-500 transition-colors"
              >
                <Instagram className="w-5 h-5 text-white" />
              </a>
              <a
                href="https://www.youtube.com/@danbarral"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube do Prof. Daniel Barral"
                className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center hover:bg-brand-500 transition-colors"
              >
                <Youtube className="w-5 h-5 text-white" />
              </a>
              <a
                href="https://www.linkedin.com/in/daniel-de-andrade-oliveira-barral-b5110870/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn do Prof. Daniel Barral"
                className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center hover:bg-brand-500 transition-colors"
              >
                <Linkedin className="w-5 h-5 text-white" />
              </a>
            </div>
          </div>

          {/* Coluna 2: Links Rapidos */}
          <div>
            <h4 className="text-white font-cinzel font-semibold mb-4 tracking-wide">
              Links Rápidos
            </h4>
            <ul className="space-y-2 font-poppins">
              <li>
                <Link href="/sobre" className="text-sm text-brand-200 hover:text-white transition-colors">
                  Sobre o Professor
                </Link>
              </li>
              <li>
                <Link href="/cursos" className="text-sm text-brand-200 hover:text-white transition-colors">
                  Cursos Disponíveis
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-sm text-brand-200 hover:text-white transition-colors">
                  Blog Jurídico
                </Link>
              </li>
              <li>
                <Link href="/legislacao" className="text-sm text-brand-200 hover:text-white transition-colors">
                  Legislação
                </Link>
              </li>
              <li>
                <Link href="/glossario" className="text-sm text-brand-200 hover:text-white transition-colors">
                  Glossário
                </Link>
              </li>
              <li>
                <Link href="/contato" className="text-sm text-brand-200 hover:text-white transition-colors">
                  Contato
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Principais Cursos */}
          <div>
            <h4 className="text-white font-cinzel font-semibold mb-4 tracking-wide">
              Principais Cursos
            </h4>
            <ul className="space-y-2 font-poppins">
              <li>
                <Link
                  href="/cursos/planejamento-contratacoes"
                  className="text-sm text-brand-200 hover:text-white transition-colors"
                >
                  Planejamento de Contratações
                </Link>
              </li>
              <li>
                <Link
                  href="/cursos/gestao-fiscalizacao-contratos"
                  className="text-sm text-brand-200 hover:text-white transition-colors"
                >
                  Gestão de Contratos
                </Link>
              </li>
              <li>
                <Link
                  href="/cursos/processo-sancionador"
                  className="text-sm text-brand-200 hover:text-white transition-colors"
                >
                  Processo Sancionador
                </Link>
              </li>
              <li>
                <Link
                  href="/cursos/contratacao-direta"
                  className="text-sm text-brand-200 hover:text-white transition-colors"
                >
                  Contratação Direta
                </Link>
              </li>
              <li>
                <Link
                  href="/cursos/planejamento-contratacoes"
                  className="text-sm text-brand-200 hover:text-white transition-colors"
                >
                  Planejamento das Contratações
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Rodape inferior */}
        <div className="border-t border-brand-600 mt-8 pt-8 text-center">
          <p className="text-sm font-poppins text-brand-200">
            © {new Date().getFullYear()} Prof. Daniel Barral. Todos os direitos reservados.
          </p>
          <p className="text-xs mt-2 text-brand-300 font-poppins">
            Desenvolvido com dedicação para compartilhar conhecimento em Direito Administrativo
          </p>
        </div>
      </div>
    </footer>
  );
});
