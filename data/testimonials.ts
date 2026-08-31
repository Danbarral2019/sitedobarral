export interface Testimonial {
  id: string;
  name: string;
  role: string;
  text: string;
  rating: number;
  avatar: string; // Iniciais para o avatar
  color: string; // Cor de fundo do avatar
}

export const testimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Maria Silva',
    role: 'Servidora Pública Federal',
    text: 'O professor Daniel tem uma didática excepcional. O material disponibilizado é extremamente rico e atualizado, facilitando muito o estudo e a aplicação prática.',
    rating: 5,
    avatar: 'M',
    color: 'bg-brand-600',
  },
  {
    id: '2',
    name: 'João Santos',
    role: 'Pregoeiro',
    text: 'Os cursos são muito bem estruturados e o acesso ao material via QR Code é super prático. Recomendo para todos que trabalham com licitações.',
    rating: 5,
    avatar: 'J',
    color: 'bg-green-600',
  },
  {
    id: '3',
    name: 'Ana Paula Costa',
    role: 'Advogada Pública',
    text: 'Material de excelente qualidade, sempre atualizado com a jurisprudência mais recente. O Prof. Barral domina o assunto como poucos!',
    rating: 5,
    avatar: 'A',
    color: 'bg-brand-600',
  },
  {
    id: '4',
    name: 'Carlos Eduardo Lima',
    role: 'Gestor de Contratos',
    text: 'A abordagem prática dos cursos fez toda diferença na minha rotina profissional. Consegui aplicar os conhecimentos imediatamente.',
    rating: 5,
    avatar: 'C',
    color: 'bg-amber-accent',
  },
  {
    id: '5',
    name: 'Fernanda Oliveira',
    role: 'Procuradora Municipal',
    text: 'Destaco a organização dos materiais e a profundidade do conteúdo. Referência obrigatória para quem atua com contratações públicas.',
    rating: 5,
    avatar: 'F',
    color: 'bg-brand-600',
  },
];
