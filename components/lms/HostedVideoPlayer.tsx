'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface Props {
 videoId: string; // id do CourseVideo (asset mestre R2)
 title: string;
}

export default function HostedVideoPlayer({ videoId, title }: Props) {
 const [url, setUrl] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const retriedRef = useRef(false);

 const fetchUrl = useCallback(async () => {
 setError(null);
 try {
 const res = await fetch(`/api/area-restrita/videos/${videoId}/url`);
 if (res.status === 403) {
 setError('Você não tem acesso a este vídeo.');
 return;
 }
 if (!res.ok) {
 setError('Não foi possível carregar o vídeo.');
 return;
 }
 const data = (await res.json()) as { url: string };
 setUrl(data.url);
 } catch {
 setError('Não foi possível carregar o vídeo.');
 }
 }, [videoId]);

 useEffect(() => {
 fetchUrl();
 }, [fetchUrl]);

 // URL assinada pode expirar após pausa longa → re-buscar uma vez no erro do <video>
 const handleVideoError = useCallback(() => {
 if (retriedRef.current) {
 setError('O vídeo expirou. Recarregue a página.');
 return;
 }
 retriedRef.current = true;
 setUrl(null);
 fetchUrl();
 }, [fetchUrl]);

 if (error) {
 return (
 <div className="aspect-video bg-brand-900 rounded-md flex flex-col items-center justify-center text-surface-page gap-2">
 <AlertCircle className="w-8 h-8 text-semantic-error" />
 <p className="text-sm">{error}</p>
 </div>
 );
 }

 if (!url) {
 return (
 <div className="aspect-video bg-brand-900 rounded-md flex items-center justify-center">
 <Loader2 className="w-8 h-8 text-surface-page animate-spin" />
 </div>
 );
 }

 return (
 <video
 key={url}
 controls
 preload="metadata"
 controlsList="nodownload"
 onContextMenu={(e) => e.preventDefault()}
 onError={handleVideoError}
 className="w-full aspect-video bg-black rounded-md"
 title={title}
 >
 <source src={url} />
 Seu navegador não suporta a reprodução de vídeo.
 </video>
 );
}
