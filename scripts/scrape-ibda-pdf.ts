/**
 * scrape-ibda-pdf.ts
 *
 * Baixa o PDF oficial do IBDA com os 61 enunciados da III Jornada de
 * Direito Administrativo (Lei 14.133/2021), parseia o texto e extrai
 * cada enunciado individualmente.
 *
 * Output: docs/audits/2026-04-30-ibda-enunciados-scraped.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const PDF_URL =
  'https://ibda.com.br/wp-content/uploads/2025/03/ENUNCIADOS-_-DIGITAL.pdf';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

interface IbdaEnunciado {
  numero: number;
  texto: string;
  fonte: string;
}

async function main() {
  console.log(`Fetch ${PDF_URL}...`);
  const r = await fetch(PDF_URL, { headers: { 'User-Agent': UA } });
  if (!r.ok) {
    console.error(`HTTP ${r.status}`);
    process.exit(1);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  console.log(`PDF baixado: ${(buf.length / 1024).toFixed(0)} KB`);

  const tmpPdf = path.join(process.cwd(), 'docs', 'audits', 'tmp-ibda.pdf');
  fs.writeFileSync(tmpPdf, buf);

  const fullText = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', tmpPdf, '-'], {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  fs.unlinkSync(tmpPdf);

  // O PDF compila I, II e III Jornadas. A III Jornada (Lei 14.133/2021) é
  // a única relevante pra base atual. Recorta apenas essa seção.
  // Acha a SEGUNDA ocorrência de "III JORNADA DE DIREITO ADMINISTRATIVO"
  // (a primeira é no índice; a segunda inicia o conteúdo).
  const headerPattern = /III JORNADA DE DIREITO ADMINISTRATIVO/g;
  const matches = Array.from(fullText.matchAll(headerPattern));
  if (matches.length < 2) {
    console.error('Não achou seção da III Jornada no PDF');
    process.exit(1);
  }
  const startIdx = matches[1].index!;
  const text = fullText.slice(startIdx);
  console.log(`PDF text (III Jornada apenas): ${(text.length / 1024).toFixed(0)} KB`);

  // Save raw text for debug
  const today = new Date().toISOString().slice(0, 10);
  const debugPath = path.join(
    process.cwd(),
    'docs',
    'audits',
    `${today}-ibda-pdf-raw.txt`
  );
  fs.writeFileSync(debugPath, text, 'utf-8');
  console.log(`Texto cru salvo em: ${debugPath}`);

  // Padrão IBDA: "Enunciado N" seguido de texto.
  // Tentar várias variações:
  // - "Enunciado 1\n<texto>\nEnunciado 2"
  // - "Enunciado nº 1: <texto>"
  // - "1. <texto>" (depois de header de jornada)

  const enunciados: IbdaEnunciado[] = [];

  // Padrão A: "Enunciado N" como header de bloco
  const patternA =
    /Enunciado\s+(?:n[º°]?\s*)?(\d{1,3})[.\s\-:]*\s*([\s\S]+?)(?=Enunciado\s+(?:n[º°]?\s*)?\d{1,3}[.\s\-:]|$)/gi;

  let m: RegExpExecArray | null;
  patternA.lastIndex = 0;
  while ((m = patternA.exec(text)) !== null) {
    const numero = parseInt(m[1], 10);
    if (numero < 1 || numero > 200) continue;
    let txt = m[2];
    // 1. Remove hifenação no fim de linha (palavra- \n palavra → palavra)
    //    pdftotext -layout deixa "subme-\nte" como "subme- te" depois do replace de \s+
    //    melhor primeiro: "palavra-\npalavra" sem espaço, depois normalizar
    txt = txt.replace(/(\w)-\s*\n\s*(\w)/g, '$1$2'); // re-une hifenação quebrada
    txt = txt.replace(/(\w)-\s+(\w)/g, '$1$2'); // re-une "palavra- texto" também
    // 2. Normaliza espaços e quebras
    txt = txt.replace(/\s+/g, ' ').trim();
    // 3. Remove números de página soltos no fim (ex.: "...revogação. 25 26")
    txt = txt.replace(/\s+\d{1,3}(\s+\d{1,3}){0,3}\s*\.\.\.?\s*$/g, '');
    txt = txt.replace(/\s+\d{1,3}(\s+\d{1,3}){0,3}\s*$/g, '');
    // 4. Remove rodapés/cabeçalhos comuns
    txt = txt
      .replace(/\d+\s+\|\s+IBDA[\s\S]*?III Jornada de Direito Administrativo/gi, ' ')
      .replace(/IBDA\s*Jornadas de Direito/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (txt.length < 30 || txt.length > 5000) continue;
    if (enunciados.some((e) => e.numero === numero)) continue;

    enunciados.push({ numero, texto: txt, fonte: PDF_URL });
  }

  console.log(`\nEnunciados extraídos: ${enunciados.length}`);
  console.log('\nPrimeiros 3:');
  for (const e of enunciados.slice(0, 3)) {
    console.log(`  Enunciado ${e.numero}: ${e.texto.slice(0, 150)}...`);
  }
  console.log('\nÚltimos 3:');
  for (const e of enunciados.slice(-3)) {
    console.log(`  Enunciado ${e.numero}: ${e.texto.slice(0, 150)}...`);
  }

  enunciados.sort((a, b) => a.numero - b.numero);

  const outPath = path.join(
    process.cwd(),
    'docs',
    'audits',
    `${today}-ibda-enunciados-scraped.json`
  );
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { scrapedAt: new Date().toISOString(), source: PDF_URL, total: enunciados.length, enunciados },
      null,
      2
    )
  );
  console.log(`\n✅ JSON salvo: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
