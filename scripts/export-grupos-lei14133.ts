/**
 * Script: Exportar Grupos Temáticos da Lei 14.133/2021 para Excel
 *
 * Gera planilha Excel com todos os grupos temáticos, artigos e descrições
 * para facilitar análise e ajustes estruturais.
 */

import { writeFileSync } from 'fs';
import { jsonToAoa, writeWorkbook } from '../lib/excel/workbook';
import { LEI_14133_GRUPOS } from '../data/lei-14133-grupos';

// Preparar dados para a planilha
const data: Record<string, string | number>[] = LEI_14133_GRUPOS.map((group, index) => ({
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
  'Quantidade': data.reduce((sum: number, row) => sum + (Number(row.Quantidade) || 0), 0),
  'Primeiro': '',
  'Último': '',
  'Descrição': `${LEI_14133_GRUPOS.length} grupos temáticos totais`,
});

// Larguras das colunas da primeira aba
const gruposColumnWidths = [
  4,   // Nº
  25,  // ID
  35,  // Título
  6,   // Emoji
  10,  // Cor
  40,  // Artigos
  10,  // Quantidade
  10,  // Primeiro
  10,  // Último
  80,  // Descrição
];

// Criar segunda aba com artigos expandidos (um por linha)
const artigosExpandidos: Record<string, string | number>[] = [];
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

const artigosColumnWidths = [
  10,  // Artigo
  25,  // Grupo ID
  35,  // Grupo
  6,   // Emoji
  10,  // Cor
  80,  // Descrição Grupo
];

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

const statsColumnWidths = [
  35,  // Métrica
  50,  // Valor
];

async function main() {
  // Salvar arquivo
  const fileName = 'Lei-14133-Grupos-Tematicos.xlsx';
  const bytes = await writeWorkbook([
    { name: 'Grupos Temáticos', rows: jsonToAoa(data), columnWidths: gruposColumnWidths },
    { name: 'Artigos Expandidos', rows: jsonToAoa(artigosExpandidos), columnWidths: artigosColumnWidths },
    { name: 'Estatísticas', rows: jsonToAoa(stats), columnWidths: statsColumnWidths },
  ]);
  writeFileSync(fileName, bytes);

  console.log('✅ Planilha Excel criada com sucesso!');
  console.log(`📁 Arquivo: ${fileName}`);
  console.log(`📊 Abas criadas:`);
  console.log(`   1. Grupos Temáticos (${LEI_14133_GRUPOS.length} grupos)`);
  console.log(`   2. Artigos Expandidos (${artigosExpandidos.length} linhas)`);
  console.log(`   3. Estatísticas (7 métricas)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
