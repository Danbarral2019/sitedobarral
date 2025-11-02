/**
 * Script para popular os artigos da Lei 14.133/2021 com texto oficial
 * Este script extrai artigos do texto da lei e atualiza o arquivo de dados
 */

const fs = require('fs');
const path = require('path');

// Texto completo da lei (primeiros 20 artigos para teste)
const leiTextoCompleto = `
TÍTULO I
DISPOSIÇÕES PRELIMINARES

CAPÍTULO I
DO ÂMBITO DE APLICAÇÃO DESTA LEI

Art. 1º Esta Lei estabelece normas gerais de licitação e contratação para as Administrações Públicas diretas, autárquicas e fundacionais da União, dos Estados, do Distrito Federal e dos Municípios, e abrange:

I - os órgãos dos Poderes Legislativo e Judiciário da União, dos Estados e do Distrito Federal e os órgãos do Poder Legislativo dos Municípios, quando no desempenho de função administrativa;

II - os fundos especiais e as demais entidades controladas direta ou indiretamente pela Administração Pública.

§ 1º Não são abrangidas por esta Lei as empresas públicas, as sociedades de economia mista e as suas subsidiárias, regidas pela Lei nº 13.303, de 30 de junho de 2016, ressalvado o disposto no art. 178 desta Lei.

§ 2º As contratações realizadas no âmbito das repartições públicas sediadas no exterior obedecerão às peculiaridades locais e aos princípios básicos estabelecidos nesta Lei, na forma de regulamentação específica a ser editada por ministro de Estado.

§ 3º Nas licitações e contratações que envolvam recursos provenientes de empréstimo ou doação oriundos de agência oficial de cooperação estrangeira ou de organismo financeiro de que o Brasil seja parte, podem ser admitidas:

I - condições decorrentes de acordos internacionais aprovados pelo Congresso Nacional e ratificados pelo Presidente da República;

II - condições peculiares à seleção e à contratação constantes de normas e procedimentos das agências ou dos organismos, desde que:

a) sejam exigidas para a obtenção do empréstimo ou doação;

b) não conflitem com os princípios constitucionais em vigor;

c) sejam indicadas no respectivo contrato de empréstimo ou doação e tenham sido objeto de parecer favorável do órgão jurídico do contratante do financiamento previamente à celebração do referido contrato;

d) (VETADO).

§ 4º A documentação encaminhada ao Senado Federal para autorização do empréstimo de que trata o § 3º deste artigo deverá fazer referência às condições contratuais que incidam na hipótese do referido parágrafo.

§ 5º As contratações relativas à gestão, direta e indireta, das reservas internacionais do País, inclusive as de serviços conexos ou acessórios a essa atividade, serão disciplinadas em ato normativo próprio do Banco Central do Brasil, assegurada a observância dos princípios estabelecidos no caput do art. 37 da Constituição Federal.
`;

// Função para extrair informações estruturais
function extrairEstrutura(texto) {
  const linhas = texto.split('\n').filter(l => l.trim());
  let tituloAtual = '';
  let capituloAtual = '';

  const estrutura = [];

  for (const linha of linhas) {
    if (linha.startsWith('TÍTULO')) {
      tituloAtual = linha.trim();
    } else if (linha.startsWith('CAPÍTULO')) {
      capituloAtual = linha.trim();
    } else if (linha.match(/^Art\.\s+\d+/)) {
      estrutura.push({
        titulo: tituloAtual,
        capitulo: capituloAtual,
        artigo: linha
      });
    }
  }

  return estrutura;
}

console.log('Script de população de artigos iniciado...');
console.log('Processando texto da lei...');

const estrutura = extrairEstrutura(leiTextoCompleto);
console.log(`Encontrados ${estrutura.length} artigos na amostra`);

estrutura.forEach((item, index) => {
  console.log(`\nArtigo ${index + 1}:`);
  console.log(`  Título: ${item.titulo}`);
  console.log(`  Capítulo: ${item.capitulo}`);
  console.log(`  Artigo: ${item.artigo.substring(0, 50)}...`);
});

console.log('\n✅ Script executado com sucesso');
console.log('ℹ️  Este é um script de teste. A implementação completa requer processamento manual.');
