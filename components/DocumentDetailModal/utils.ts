// Get a user-friendly category label
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'parecer': 'Parecer',
    'parecer-vinculante': 'Parecer Vinculante',
    'decor': 'DECOR/AGU',
    'orientacao-normativa': 'Orientacao Normativa',
    'enunciados': 'Enunciado',
    'acordao': 'Acordao TCU',
    'sumula': 'Súmulas TCU',
    'consulta_tcu': 'Respostas a Consultas TCU',
    'informativo': 'Informativos de Licitação TCU',
    'apostila': 'Apostila',
    'conteudo-programatico': 'Conteudo Programatico',
    'material-complementar': 'Material Complementar',
    'bibliografia': 'Bibliografia',
    'manual-tcu': 'Manual do TCU',
    'boa_pratica': 'Boa Prática',
    'outro': 'Outro',
  };
  return labels[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

// Get importance badge color
export function getImportanceBadge(importance: string | null) {
  if (!importance) return null;
  const config: Record<string, { bg: string; text: string; label: string }> = {
    critica: { bg: 'bg-red-100', text: 'text-red-700', label: 'Importancia Critica' },
    alta: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Alta Importancia' },
    media: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Media Importancia' },
    baixa: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Referencia' },
  };
  return config[importance] || null;
}
