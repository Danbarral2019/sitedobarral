'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Copy, Check, Download, ArrowLeft, Instagram, Linkedin, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  isPublished: boolean;
}

export default function AssistenteSocialPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = searchParams.get('postId');
  const { success, error: errorToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [instagramText, setInstagramText] = useState('');
  const [linkedinText, setLinkedinText] = useState('');
  const [copiedInstagram, setCopiedInstagram] = useState(false);
  const [copiedLinkedin, setCopiedLinkedin] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const instagramTextRef = useRef<HTMLTextAreaElement>(null);
  const linkedinTextRef = useRef<HTMLTextAreaElement>(null);

  const verifyAdmin = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify');

      if (!response.ok) {
        router.push('/validar-acesso');
        return;
      }

      const data = await response.json();

      if (data.user.role !== 'admin') {
        router.push('/area-restrita');
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar admin:', error);
      router.push('/validar-acesso');
    }
  }, [router]);

  const loadPost = useCallback(async () => {
    if (!postId) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/admin/blog-posts/${postId}`);

      if (!response.ok) {
        throw new Error('Erro ao carregar post');
      }

      const data = await response.json();
      const blogPost = data.post;
      setPost(blogPost);

      // Gerar textos otimizados
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      const postUrl = `${baseUrl}/blog/${blogPost.slug}`;

      // Gerar URL da imagem OG
      const ogImageUrl = `${baseUrl}/api/og/${blogPost.slug}`;
      setImageUrl(ogImageUrl);

      // Texto Instagram (mais casual, com emojis e hashtags)
      const instaText = `${blogPost.title}

${blogPost.excerpt}

📖 Leia o artigo completo em:
${postUrl}

#DireitoAdministrativo #Licitacoes #ContratosPublicos #DireitoPublico #Concursos #Lei14133 #NovaLeiDeLicitacoes #DireitoParaConcursos`;

      setInstagramText(instaText);

      // Texto LinkedIn (mais profissional)
      const linkedText = `${blogPost.title}

${blogPost.excerpt}

🔗 Leia o artigo completo: ${postUrl}

#DireitoAdministrativo #Licitações #DireitoPublico`;

      setLinkedinText(linkedText);

    } catch (error) {
      console.error('Erro ao carregar post:', error);
      errorToast('Erro ao carregar', 'Não foi possível carregar o post do blog');
    } finally {
      setIsLoading(false);
    }
    // errorToast vem do useToast() — nova ref a cada render. Não pode entrar nas
    // deps senão o useEffect que depende deste callback dispara em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  useEffect(() => {
    verifyAdmin();
  }, [verifyAdmin]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const copyToClipboard = async (text: string, platform: 'instagram' | 'linkedin') => {
    try {
      await navigator.clipboard.writeText(text);

      if (platform === 'instagram') {
        setCopiedInstagram(true);
        setTimeout(() => setCopiedInstagram(false), 2000);
      } else {
        setCopiedLinkedin(true);
        setTimeout(() => setCopiedLinkedin(false), 2000);
      }

      success('Copiado!', `Texto para ${platform === 'instagram' ? 'Instagram' : 'LinkedIn'} copiado para a área de transferência`);
    } catch (error) {
      console.error('Erro ao copiar:', error);
      errorToast('Erro ao copiar', 'Não foi possível copiar o texto');
    }
  };

  const downloadImage = () => {
    // Abrir imagem em nova aba para download
    window.open(imageUrl, '_blank');
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  if (!postId || !post) {
    return (
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-yellow-900 mb-2">Nenhum post selecionado</h2>
              <p className="text-yellow-800 mb-4">
                Selecione um post do blog para preparar as publicações nas redes sociais.
              </p>
              <Link
                href="/admin/blog"
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg font-bold hover:bg-yellow-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Ir para Posts do Blog
              </Link>
            </div>
          </div>
        </div>
    );
  }

  return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/admin/blog"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para Posts
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">📱 Assistente de Publicação</h1>
            <p className="text-gray-600">
              Copie os textos otimizados e cole diretamente nas redes sociais
            </p>
          </div>

          {/* Post Info */}
          <div className="bg-white p-6 rounded-xl border-2 border-gray-200 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{post.title}</h2>
            <p className="text-gray-600 mb-4">{post.excerpt}</p>
            <div className="flex items-center gap-4 text-sm">
              <span className={`px-3 py-1 rounded-full font-medium ${
                post.isPublished
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {post.isPublished ? 'Publicado' : 'Rascunho'}
              </span>
              <Link
                href={`/blog/${post.slug}`}
                target="_blank"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Ver no site →
              </Link>
            </div>
          </div>

          {/* Imagem Open Graph */}
          <div className="bg-white p-6 rounded-xl border-2 border-gray-200 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Imagem para Redes Sociais
              </h3>
              <button
                onClick={downloadImage}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Abrir Imagem
              </button>
            </div>
            <div className="bg-gray-100 rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={post.title}
                className="w-full h-auto"
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              💡 <strong>Dica:</strong> Clique em &quot;Abrir Imagem&quot; para baixar e usar nas suas publicações
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Instagram */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border-2 border-purple-200">
              <div className="flex items-center gap-2 mb-4">
                <Instagram className="w-6 h-6 text-purple-600" />
                <h3 className="text-xl font-bold text-gray-900">Instagram</h3>
              </div>

              <textarea
                ref={instagramTextRef}
                value={instagramText}
                onChange={(e) => setInstagramText(e.target.value)}
                className="w-full h-64 p-4 border-2 border-purple-300 rounded-lg font-mono text-sm mb-4 focus:ring-2 focus:ring-purple-500 focus:border-purple-600"
                placeholder="Texto para Instagram..."
              />

              <button
                onClick={() => copyToClipboard(instagramText, 'instagram')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors"
              >
                {copiedInstagram ? (
                  <>
                    <Check className="w-5 h-5" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copiar Texto
                  </>
                )}
              </button>

              <div className="mt-4 p-4 bg-white/50 rounded-lg">
                <p className="text-sm text-gray-700 font-medium mb-2">📋 Passo a passo:</p>
                <ol className="text-sm text-gray-600 space-y-1">
                  <li>1. Clique em &quot;Copiar Texto&quot;</li>
                  <li>2. Abra o Instagram no celular</li>
                  <li>3. Crie novo post e cole o texto</li>
                  <li>4. Adicione a imagem acima</li>
                  <li>5. Publique!</li>
                </ol>
              </div>
            </div>

            {/* LinkedIn */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <Linkedin className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-900">LinkedIn</h3>
              </div>

              <textarea
                ref={linkedinTextRef}
                value={linkedinText}
                onChange={(e) => setLinkedinText(e.target.value)}
                className="w-full h-64 p-4 border-2 border-blue-300 rounded-lg font-mono text-sm mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                placeholder="Texto para LinkedIn..."
              />

              <button
                onClick={() => copyToClipboard(linkedinText, 'linkedin')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
              >
                {copiedLinkedin ? (
                  <>
                    <Check className="w-5 h-5" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copiar Texto
                  </>
                )}
              </button>

              <div className="mt-4 p-4 bg-white/50 rounded-lg">
                <p className="text-sm text-gray-700 font-medium mb-2">📋 Passo a passo:</p>
                <ol className="text-sm text-gray-600 space-y-1">
                  <li>1. Clique em &quot;Copiar Texto&quot;</li>
                  <li>2. Abra o LinkedIn</li>
                  <li>3. Crie nova publicação</li>
                  <li>4. Cole o texto e adicione a imagem</li>
                  <li>5. Publique!</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Dicas Gerais */}
          <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
            <h4 className="font-bold text-blue-900 mb-2">💡 Dicas para melhores resultados:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Você pode editar os textos acima antes de copiar</li>
              <li>• Instagram: funciona melhor com imagens quadradas ou verticais</li>
              <li>• LinkedIn: funciona bem com imagens horizontais</li>
              <li>• Adicione mais hashtags relevantes se desejar</li>
              <li>• Publique nos melhores horários: terça a quinta, 9h-11h ou 17h-19h</li>
            </ul>
          </div>
        </div>
      </div>
  );
}
