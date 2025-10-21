import Image from 'next/image';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  fill?: boolean;
  sizes?: string;
}

/**
 * Componente otimizado para imagens usando Next/Image
 *
 * Benefícios:
 * - Lazy loading automático
 * - Otimização automática de tamanho
 * - WebP quando suportado pelo navegador
 * - Prevenção de layout shift
 * - Responsive images
 *
 * Uso:
 *
 * // Imagem com dimensões fixas
 * <OptimizedImage
 *   src="/images/foto.jpg"
 *   alt="Descrição da imagem"
 *   width={800}
 *   height={600}
 * />
 *
 * // Imagem que preenche o container pai
 * <div className="relative w-full h-64">
 *   <OptimizedImage
 *     src="/images/banner.jpg"
 *     alt="Banner"
 *     fill
 *     sizes="(max-width: 768px) 100vw, 50vw"
 *   />
 * </div>
 *
 * // Imagem prioritária (above the fold)
 * <OptimizedImage
 *   src="/images/hero.jpg"
 *   alt="Hero"
 *   width={1920}
 *   height={1080}
 *   priority
 * />
 */
export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  fill = false,
  sizes,
}: OptimizedImageProps) {
  // Para imagens que preenchem o container
  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-cover ${className}`}
        sizes={sizes || '100vw'}
        priority={priority}
      />
    );
  }

  // Para imagens com dimensões específicas
  return (
    <Image
      src={src}
      alt={alt}
      width={width || 800}
      height={height || 600}
      className={className}
      priority={priority}
      sizes={sizes}
    />
  );
}
