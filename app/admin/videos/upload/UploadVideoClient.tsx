'use client';

import { useState } from 'react';

interface Props {
  courses: Array<{ id: string; title: string }>;
}

type Phase = 'idle' | 'signing' | 'uploading' | 'confirming' | 'done' | 'error';

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('PUT ' + xhr.status)));
    xhr.onerror = () => reject(new Error('Falha de rede no upload'));
    xhr.send(file);
  });
}

export function UploadVideoClient({ courses }: Props) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !courseId || !title.trim()) {
      setMessage('Preencha curso, título e selecione um arquivo.');
      setPhase('error');
      return;
    }
    try {
      setPhase('signing');
      setMessage('');
      const signRes = await fetch('/api/admin/videos/presigned-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ courseId, fileName: file.name, fileSize: file.size, fileType: file.type }),
      });
      if (!signRes.ok) {
        const err = await signRes.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao gerar URL de upload');
      }
      const { presignedUrl, r2Key } = await signRes.json();

      setPhase('uploading');
      await putWithProgress(presignedUrl, file, setProgress);

      setPhase('confirming');
      const confirmRes = await fetch('/api/admin/videos/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          courseId,
          title: title.trim(),
          description: description.trim() || undefined,
          r2Key,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao confirmar o vídeo');
      }
      setPhase('done');
      setMessage('Vídeo enviado com sucesso!');
    } catch (err) {
      setPhase('error');
      setMessage(err instanceof Error ? err.message : 'Erro no upload');
    }
  }

  const busy = phase === 'signing' || phase === 'uploading' || phase === 'confirming';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-2xl shadow border">
      <div>
        <label className="block text-sm font-semibold mb-1">Curso</label>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full border rounded-lg px-3 py-2">
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Título</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Descrição (opcional)</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={2} />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Arquivo de vídeo (MP4/WebM/MOV, até 5GB)</label>
        <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      {phase === 'uploading' && (
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <button type="submit" disabled={busy} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">
        {phase === 'signing' && 'Preparando…'}
        {phase === 'uploading' && `Enviando… ${progress}%`}
        {phase === 'confirming' && 'Finalizando…'}
        {(phase === 'idle' || phase === 'done' || phase === 'error') && 'Enviar vídeo'}
      </button>
      {message && (
        <p className={`text-sm ${phase === 'error' ? 'text-red-600' : 'text-green-600'}`}>{message}</p>
      )}
    </form>
  );
}
