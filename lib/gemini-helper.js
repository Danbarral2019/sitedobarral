/**
 * Gemini Helper - Wrapper para chamadas ao Gemini via API
 *
 * Este helper encapsula chamadas ao Google Gemini para uso em scripts Node.js
 * que não têm acesso direto ao MCP.
 *
 * NOTA: Usa a API REST do Gemini diretamente via GEMINI_API_KEY
 */

/**
 * Chama Gemini API com um prompt
 *
 * @param {string} prompt - Prompt para o Gemini
 * @param {string} model - Modelo Gemini (padrão: gemini-2.0-flash)
 * @returns {Promise<string>} - Resposta do Gemini
 */
async function callGemini(prompt, model = 'gemini-2.0-flash') {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada no ambiente');
  }

  // Mapear nome do modelo para endpoint correto
  const modelMap = {
    'gemini-2.0-flash': 'gemini-2.0-flash',
    'gemini-2.5-flash': 'gemini-2.0-flash', // Fallback
    'gemini-2.5-pro': 'gemini-2.0-flash', // Fallback
  };

  const apiModel = modelMap[model] || 'gemini-2.0-flash';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${GEMINI_API_KEY}`;

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.2, // Baixa temperatura para respostas mais determinísticas
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Extrair texto da resposta
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const text = data.candidates[0].content.parts[0].text;
      return text.trim();
    }

    throw new Error('Resposta inválida do Gemini: ' + JSON.stringify(data));
  } catch (error) {
    console.error('[Gemini Helper] Erro:', error.message);
    throw error;
  }
}

/**
 * Chama Gemini e espera resposta JSON
 *
 * @param {string} prompt - Prompt para o Gemini (deve pedir JSON)
 * @param {string} model - Modelo Gemini
 * @returns {Promise<object>} - Objeto JSON parseado
 */
async function callGeminiJSON(prompt, model = 'gemini-2.0-flash') {
  const response = await callGemini(prompt, model);

  try {
    // Tentar extrair JSON da resposta (pode vir com markdown)
    let jsonText = response;

    // Remover markdown code blocks se presentes
    if (jsonText.includes('```json')) {
      jsonText = jsonText.split('```json')[1].split('```')[0].trim();
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.split('```')[1].split('```')[0].trim();
    }

    return JSON.parse(jsonText);
  } catch (error) {
    console.error('[Gemini Helper] Erro ao parsear JSON:', error.message);
    console.error('[Gemini Helper] Resposta original:', response);
    throw new Error('Resposta do Gemini não é JSON válido');
  }
}

/**
 * Testa conectividade com Gemini
 *
 * @returns {Promise<boolean>} - true se conectado
 */
async function testConnection() {
  try {
    const response = await callGemini('Responda apenas com: OK');
    return response.toUpperCase().includes('OK');
  } catch (error) {
    console.error('[Gemini Helper] Teste de conexão falhou:', error.message);
    return false;
  }
}

module.exports = {
  callGemini,
  callGeminiJSON,
  testConnection,
};
