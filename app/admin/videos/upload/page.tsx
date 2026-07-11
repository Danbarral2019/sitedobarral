import { courses } from '@/data/courses';
import { UploadVideoClient } from './UploadVideoClient';

export const metadata = { title: 'Upload de vídeo | Admin' };

export default function UploadVideoPage() {
  const coursesList = courses.map((c) => ({ id: c.id, title: c.title }));
  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Upload de vídeo (R2)</h1>
        <UploadVideoClient courses={coursesList} />
      </div>
    </div>
  );
}
