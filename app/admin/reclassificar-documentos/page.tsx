import { Metadata } from 'next';
import ReclassifyDocumentsClient from './ReclassifyDocumentsClient';

export const metadata: Metadata = {
  title: 'Reclassificar Documentos | Admin',
  description: 'Reclassifique documentos para diferentes cursos'
};

export default function ReclassifyDocumentsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Reclassificar Documentos</h1>
          <p className="mt-2 text-gray-600">
            Gerencie a classificação de documentos por curso. Marque documentos como comuns (disponíveis para todos os cursos) ou atribua a cursos específicos.
          </p>
        </div>

        <ReclassifyDocumentsClient />
      </div>
    </div>
  );
}
