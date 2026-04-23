import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function test(body: Record<string, unknown>, label: string) {
  const k = process.env.GEMINI_API_KEY!;
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${k}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const data = await r.json();
  console.log(`=== ${label} ===`);
  console.log('finishReason:', data.candidates?.[0]?.finishReason);
  console.log('usageMetadata:', JSON.stringify(data.usageMetadata));
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(sem texto)';
  console.log('text length:', text.length);
  console.log('text:', text.slice(0, 500));
  console.log('');
}

(async () => {
  const prompt = 'Explique em 3 a 5 frases o que é uma dispensa indevida de licitação no contexto da Lei 14.133/2021.';

  await test({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
  }, 'padrão (com thinking default)');

  await test({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  }, 'com thinkingBudget=0');
})();
