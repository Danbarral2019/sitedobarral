'use client';

import { Clock, FileText, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { courses } from '@/data/courses';

export interface RecentUpload {
  id: string;
  title: string;
  category: string;
  type: string;
  courseId: string | null;
  isPublic: boolean;
  uploadedAt: string;
  isCommon: boolean;
}

interface RecentUploadsListProps {
  docs: RecentUpload[];
  collapsed: boolean;
  onToggle: () => void;
}

function getCourseTitle(courseId: string): string {
  if (!courseId) return 'Comum';
  const course = courses.find((c) => c.id === courseId);
  return course?.title || courseId;
}

export function RecentUploadsList({ docs, collapsed, onToggle }: RecentUploadsListProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-green-500 to-teal-500 text-white"
      >
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6" />
          <span className="text-lg font-bold">Uploads Recentes (24h)</span>
          <span className="px-2 py-1 bg-white/20 rounded-full text-sm">{docs.length}</span>
        </div>
        {collapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
      </button>

      {!collapsed && (
        <div className="p-6">
          {docs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Nenhum upload nas ultimas 24 horas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{doc.title}</p>
                      <p className="text-xs text-gray-500">
                        {doc.category} | {doc.isCommon ? 'Comum' : getCourseTitle(doc.courseId || '')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.isPublic ? (
                      <Eye className="w-4 h-4 text-green-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-orange-500" />
                    )}
                    <span className="text-xs text-gray-500">
                      {new Date(doc.uploadedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
