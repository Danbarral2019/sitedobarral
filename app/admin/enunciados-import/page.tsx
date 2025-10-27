'use client';

import AdminLayout from '@/components/AdminLayout';
import {
  FileText, AlertCircle
} from 'lucide-react';

export default function EnunciadosImportPage() {
  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Importar Enunciados
          </h1>
          <p className="text-gray-600 mt-2">
            Funcionalidade em desenvolvimento
          </p>
        </div>

        {/* Under Construction Notice */}
        <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg p-6">
          <div className="flex gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-yellow-900 text-lg mb-2">
                Funcionalidade em Desenvolvimento
              </h3>
              <p className="text-yellow-800 mb-4">
                O sistema de importação de enunciados (IBDA, INCP, CJF) está sendo desenvolvido e estará disponível em breve.
              </p>
              <div className="bg-white rounded-lg p-4 mt-4">
                <h4 className="font-semibold text-gray-900 mb-2">Recursos Planejados:</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <span className="text-blue-600">•</span>
                    <span>Upload de PDFs com múltiplos enunciados</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">•</span>
                    <span>Extração automática de enunciados individuais</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">•</span>
                    <span>Classificação inteligente por IA</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">•</span>
                    <span>Revisão antes da importação</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">•</span>
                    <span>Importação em lote para o banco de dados</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Documentation Reference */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">📚 Documentação</h3>
          <p className="text-sm text-gray-700 mb-3">
            Para mais informações sobre o sistema de importação de enunciados, consulte:
          </p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span><code className="bg-gray-200 px-2 py-1 rounded">ENUNCIADOS_PARSER_STATUS.md</code> - Status da implementação</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span><code className="bg-gray-200 px-2 py-1 rounded">lib/enunciados-parser.ts</code> - Parser de PDFs</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span><code className="bg-gray-200 px-2 py-1 rounded">app/api/admin/enunciados-import/parse/route.ts</code> - API de processamento</span>
            </li>
          </ul>
        </div>

        {/* Temporary Alternative */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3">💡 Alternativa Temporária</h3>
          <p className="text-sm text-blue-800 mb-3">
            Enquanto esta funcionalidade não está disponível, você pode importar enunciados individualmente através de:
          </p>
          <a
            href="/admin/documentos"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Gerenciar Documentos →
          </a>
        </div>
      </div>
    </AdminLayout>
  );
}
