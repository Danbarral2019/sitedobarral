import { readFileSync } from 'fs';

const content = readFileSync('data/lei-14133-artigos.ts', 'utf-8');

// Extrair todos os artigos
const regex = /"(\d+)":\s*{[^}]*ementa:\s*"([^"]*(?:\\.[^"]*)*)"/gs;
const matches = [...content.matchAll(regex)];
let truncatedCount = 0;
const truncatedArticles = [];

for (const match of matches) {
  const artNum = match[1];
  const ementa = match[2].replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Verificar se termina de forma suspeita (meio de frase)
  const suspicious = /\s(do|da|de|dos|das|no|na|nos|nas|ao|à|aos|às|com|por|para|pelo|pela|que|se|e|ou)\s*$/i.test(ementa);

  if (suspicious || ementa.length < 100) {
    truncatedCount++;
    truncatedArticles.push({
      art: artNum,
      length: ementa.length,
      ending: ementa.slice(-80).trim()
    });
  }
}

console.log(`Total de artigos analisados: ${matches.length}`);
console.log(`Artigos potencialmente truncados: ${truncatedCount}`);
console.log(`Porcentagem: ${Math.round((truncatedCount / matches.length) * 100)}%\n`);
console.log('Primeiros 15 artigos truncados:\n');
truncatedArticles.slice(0, 15).forEach(a => {
  console.log(`  Art. ${a.art} (${a.length} chars)`);
  console.log(`    Termina: "...${a.ending}"`);
  console.log('');
});
