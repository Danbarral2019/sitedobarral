#!/usr/bin/env node

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyDPoKoJPl_LhKZpLLkHSdw3QvgwQGQT3jc';

console.log('Testing Gemini API...');
console.log('API Key:', apiKey.substring(0, 10) + '...');

const genAI = new GoogleGenerativeAI(apiKey);

// Testar diferentes modelos
const models = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro'
];

for (const modelName of models) {
  try {
    console.log(`\n--- Testing ${modelName} ---`);
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Say hello in one word' }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 100,
      },
    });

    const response = await result.response;
    const text = response.text();
    console.log(`✅ ${modelName}: ${text}`);
  } catch (error) {
    console.log(`❌ ${modelName}: ${error.message}`);
  }
}

console.log('\nDone!');
