#!/usr/bin/env node

import { GoogleGenerativeAI } from '@google/generative-ai';

// ⚠️ SECURITY WARNING: NEVER COMMIT YOUR API KEY!
// ===============================================
// This is an EXAMPLE file. To use it:
// 1. Copy this file to: test-gemini-api.mjs
// 2. Configure your API key as an environment variable
//
// Windows (PowerShell):
//   setx GEMINI_API_KEY "your-api-key-here"
//   # Then restart your terminal
//
// Linux/Mac (Bash):
//   export GEMINI_API_KEY="your-api-key-here"
//   # Or add to ~/.bashrc or ~/.zshrc for persistence
//
// Get your API key at: https://aistudio.google.com/app/apikey

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY environment variable not set!\n');
  console.error('Configure it with:');
  console.error('  Windows: setx GEMINI_API_KEY "your-api-key"');
  console.error('  Linux/Mac: export GEMINI_API_KEY="your-api-key"\n');
  console.error('Get API key at: https://aistudio.google.com/app/apikey\n');
  process.exit(1);
}

console.log('Testing Gemini API...');
console.log('API Key:', apiKey.substring(0, 10) + '...' + ' (length: ' + apiKey.length + ')');

const genAI = new GoogleGenerativeAI(apiKey);

// Test different models
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
