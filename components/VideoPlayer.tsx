'use client';

import { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import Player from 'video.js/dist/types/player';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  autoplay?: boolean;
  controls?: boolean;
  responsive?: boolean;
  fluid?: boolean;
  className?: string;
  onReady?: (player: Player) => void;
  onEnded?: () => void;
}

/**
 * Player de vídeo profissional usando Video.js
 *
 * Recursos:
 * - Controles completos (play, pause, volume, fullscreen)
 * - Responsivo
 * - Suporte a múltiplos formatos
 * - Compatível com todos os navegadores
 * - Teclas de atalho
 * - Picture-in-picture
 *
 * Uso:
 *
 * <VideoPlayer
 *   src="/videos/aula.mp4"
 *   poster="/images/thumbnail.jpg"
 *   title="Aula sobre Licitações"
 * />
 */
export default function VideoPlayer({
  src,
  poster,
  title,
  autoplay = false,
  controls = true,
  responsive = true,
  fluid = true,
  className = '',
  onReady,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    // Garantir que o código só rode no cliente
    if (!playerRef.current && videoRef.current) {
      const videoElement = document.createElement('video-js');
      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current.appendChild(videoElement);

      const player = (playerRef.current = videojs(videoElement, {
        autoplay,
        controls,
        responsive,
        fluid,
        poster,
        playbackRates: [0.5, 1, 1.25, 1.5, 2], // Velocidades de reprodução
        controlBar: {
          volumePanel: {
            inline: false, // Volume vertical
          },
        },
        sources: [
          {
            src,
            type: getVideoType(src),
          },
        ],
      }));

      // Event listeners
      player.ready(() => {
        console.log('Player is ready');
        if (onReady) {
          onReady(player);
        }
      });

      if (onEnded) {
        player.on('ended', onEnded);
      }
    }

    // Cleanup
    return () => {
      const player = playerRef.current;
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [src, poster, autoplay, controls, responsive, fluid, onReady, onEnded]);

  // Determinar o tipo MIME do vídeo
  const getVideoType = (src: string): string => {
    const extension = src.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      ogg: 'video/ogg',
      mov: 'video/quicktime',
    };
    return mimeTypes[extension || 'mp4'] || 'video/mp4';
  };

  return (
    <div className={`video-player-wrapper ${className}`}>
      {title && (
        <div className="mb-2">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
      )}
      <div data-vjs-player>
        <div ref={videoRef} />
      </div>
      <style jsx global>{`
        .video-js {
          font-family: inherit;
        }

        .video-js .vjs-big-play-button {
          border-radius: 50%;
          width: 2em;
          height: 2em;
          line-height: 2em;
          border: 0.06666em solid #fff;
          background-color: rgba(43, 51, 63, 0.7);
          font-size: 3em;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
        }

        .video-js .vjs-big-play-button:hover {
          background-color: rgba(43, 51, 63, 0.9);
        }

        .video-js .vjs-control-bar {
          background-color: rgba(43, 51, 63, 0.9);
        }

        .video-js .vjs-play-progress {
          background-color: #2563eb;
        }

        .video-js .vjs-volume-level {
          background-color: #2563eb;
        }
      `}</style>
    </div>
  );
}
