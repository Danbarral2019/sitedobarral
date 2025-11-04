#!/usr/bin/env node

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not set');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const modelsToTest = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash'
];

async function testModel(modelName) {
  try {
    console.log(`\n🧪 Testing ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Say "Hello" in one word' }] }],
    });
    const response = await result.response;
    console.log(`✅ ${modelName}: ${response.text()}`);
    return true;
  } catch (error) {
    console.error(`❌ ${modelName}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing Gemini models...\n');
  const results = await Promise.all(modelsToTest.map(testModel));
  const successful = results.filter(r => r).length;
  console.log(`\n📊 Results: ${successful}/${modelsToTest.length} models working`);
}

main();
