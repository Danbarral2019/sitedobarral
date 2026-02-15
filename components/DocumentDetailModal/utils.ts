// Detect if a URL points to AGU's Sapiens (internal system)
export function isSapiensUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('sapiens.agu.gov.br') ||
    lower.includes('supersapiens.agu.gov.br') ||
    (lower.includes('sapiens') && lower.includes('agu'))
  );
}

// Get a user-friendly category label
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'parecer': 'Parecer',
    'parecer-vinculante': 'Parecer Vinculante',
    'decor': 'DECOR/AGU',
    'orientacao-normativa': 'Orientacao Normativa',
    'enunciados': 'Enunciado',
    'acordao': 'Acordao TCU',
    'sumula': 'Sumula',
    'apostila': 'Apostila',
    'conteudo-programatico': 'Conteudo Programatico',
    'material-complementar': 'Material Complementar',
    'bibliografia': 'Bibliografia',
    'manual_tcu': 'Manual do TCU',
    'boa_pratica': 'Boa Pratica',
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
