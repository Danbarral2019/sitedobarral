/**
 * Script: Exportar Grupos Temáticos da Lei 14.133/2021 para Excel
 *
 * Gera planilha Excel com todos os grupos temáticos, artigos e descrições
 * para facilitar análise e ajustes estruturais.
 */

import * as XLSX from 'xlsx';
import { LEI_14133_GRUPOS } from '../data/lei-14133-grupos';

// Preparar dados para a planilha
const data = LEI_14133_GRUPOS.map((group, index) => ({
  'Nº': index + 1,
  'ID': group.id,
  'Título': group.title,
  'Emoji': group.icon,
  'Cor': group.color,
  'Artigos': group.articles.join(', '),
  'Quantidade': group.articles.length,
  'Primeiro': group.articles[0],
  'Último': group.articles[group.articles.length - 1],
  'Descrição': group.description,
}));

// Adicionar linha de totais
data.push({
  'Nº': '',
  'ID': 'TOTAL',
  'Título': '--- TOTAIS ---',
  'Emoji': '📊',
  'Cor': '',
  'Artigos': '',
  'Quantidade': data.reduce((sum, row) => sum + (row.Quantidade || 0), 0),
  'Primeiro': '',
  'Último': '',
  'Descrição': `${LEI_14133_GRUPOS.length} grupos temáticos totais`,
});

// Criar workbook e worksheet
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(data);

// Definir larguras das colunas
ws['!cols'] = [
  { wch: 4 },   // Nº
  { wch: 25 },  // ID
  { wch: 35 },  // Título
  { wch: 6 },   // Emoji
  { wch: 10 },  // Cor
  { wch: 40 },  // Artigos
  { wch: 10 },  // Quantidade
  { wch: 10 },  // Primeiro
  { wch: 10 },  // Último
  { wch: 80 },  // Descrição
];

// Adicionar worksheet ao workbook
XLSX.utils.book_append_sheet(wb, ws, 'Grupos Temáticos');

// Criar segunda aba com artigos expandidos (um por linha)
const artigosExpandidos: any[] = [];
LEI_14133_GRUPOS.forEach((group) => {
  group.articles.forEach((artigo) => {
    artigosExpandidos.push({
      'Artigo': artigo,
      'Grupo ID': group.id,
      'Grupo': group.title,
      'Emoji': group.icon,
      'Cor': group.color,
      'Descrição Grupo': group.description,
    });
  });
});

const wsArtigos = XLSX.utils.json_to_sheet(artigosExpandidos);
wsArtigos['!cols'] = [
  { wch: 10 },  // Artigo
  { wch: 25 },  // Grupo ID
  { wch: 35 },  // Grupo
  { wch: 6 },   // Emoji
  { wch: 10 },  // Cor
  { wch: 80 },  // Descrição Grupo
];
XLSX.utils.book_append_sheet(wb, wsArtigos, 'Artigos Expandidos');

// Criar terceira aba com estatísticas
const stats = [
  { 'Métrica': 'Total de Grupos Temáticos', 'Valor': LEI_14133_GRUPOS.length },
  { 'Métrica': 'Total de Artigos Classificados', 'Valor': artigosExpandidos.length },
  { 'Métrica': 'Maior Grupo', 'Valor': LEI_14133_GRUPOS.reduce((max, g) => g.articles.length > max.articles.length ? g : max).title },
  { 'Métrica': 'Artigos no Maior Grupo', 'Valor': Math.max(...LEI_14133_GRUPOS.map(g => g.articles.length)) },
  { 'Métrica': 'Menor Grupo', 'Valor': LEI_14133_GRUPOS.reduce((min, g) => g.articles.length < min.articles.length ? g : min).title },
  { 'Métrica': 'Artigos no Menor Grupo', 'Valor': Math.min(...LEI_14133_GRUPOS.map(g => g.articles.length)) },
  { 'Métrica': 'Média de Artigos por Grupo', 'Valor': (artigosExpandidos.length / LEI_14133_GRUPOS.length).toFixed(2) },
];

const wsStats = XLSX.utils.json_to_sheet(stats);
wsStats['!cols'] = [
  { wch: 35 },  // Métrica
  { wch: 50 },  // Valor
];
XLSX.utils.book_append_sheet(wb, wsStats, 'Estatísticas');

// Salvar arquivo
const fileName = 'Lei-14133-Grupos-Tematicos.xlsx';
XLSX.writeFile(wb, fileName);

console.log('✅ Planilha Excel criada com sucesso!');
console.log(`📁 Arquivo: ${fileName}`);
console.log(`📊 Abas criadas:`);
console.log(`   1. Grupos Temáticos (${LEI_14133_GRUPOS.length} grupos)`);
console.log(`   2. Artigos Expandidos (${artigosExpandidos.length} linhas)`);
console.log(`   3. Estatísticas (7 métricas)`);
