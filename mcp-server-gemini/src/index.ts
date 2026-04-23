#!/usr/bin/env node
// @ts-nocheck — MCP SDK not installed locally; this module runs from its own node_modules

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Inicializar Gemini com API key do ambiente
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set');
  }
  return new GoogleGenerativeAI(apiKey);
};

// Mapeamento de nomes de modelo para nomes reais da API
// A API do Gemini agora usa modelos 2.5 e 2.0
const MODEL_MAPPING: Record<string, string> = {
  'gemini-pro': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-pro',
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
  // Cliente que ainda peça 2.0-flash é encaminhado para 2.5-flash.
  // 2.0-flash tem shutdown marcado pela Google em 2026-06-01.
  'gemini-2.0-flash': 'gemini-2.5-flash',
};

// Tools disponíveis
const TOOLS: Tool[] = [
  {
    name: 'gemini_query',
    description: 'Send a prompt to Gemini and get a response. Use for: alternative solutions, code review, documentation, brainstorming.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to send to Gemini',
        },
        model: {
          type: 'string',
          description: 'Gemini model to use (default: gemini-2.5-flash)',
          enum: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
          default: 'gemini-2.5-flash',
        },
        temperature: {
          type: 'number',
          description: 'Creativity level (0.0-2.0, default: 0.7)',
          minimum: 0,
          maximum: 2,
          default: 0.7,
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'gemini_code_review',
    description: 'Ask Gemini to review code and provide suggestions. Optimized for code quality analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The code to review',
        },
        language: {
          type: 'string',
          description: 'Programming language',
        },
        focus: {
          type: 'string',
          description: 'What to focus on (security, performance, best-practices, all)',
          enum: ['security', 'performance', 'best-practices', 'all'],
          default: 'all',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'gemini_compare_approaches',
    description: 'Ask Gemini to compare different implementation approaches and suggest the best one.',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Description of the task',
        },
        approaches: {
          type: 'array',
          description: 'Array of different approaches to compare',
          items: {
            type: 'string',
          },
        },
        criteria: {
          type: 'string',
          description: 'Criteria for comparison (performance, maintainability, scalability, etc.)',
          default: 'overall quality',
        },
      },
      required: ['task', 'approaches'],
    },
  },
  {
    name: 'gemini_brainstorm',
    description: 'Collaborative brainstorming session with Gemini for creative solutions.',
    inputSchema: {
      type: 'object',
      properties: {
        problem: {
          type: 'string',
          description: 'The problem to brainstorm about',
        },
        constraints: {
          type: 'string',
          description: 'Any constraints or requirements',
        },
        num_ideas: {
          type: 'number',
          description: 'Number of ideas to generate (default: 5)',
          default: 5,
          minimum: 1,
          maximum: 10,
        },
      },
      required: ['problem'],
    },
  },
  {
    name: 'gemini_collaborate',
    description: 'General collaboration tool. Claude can share context and ask Gemini for a second opinion.',
    inputSchema: {
      type: 'object',
      properties: {
        context: {
          type: 'string',
          description: 'Context about what Claude is working on',
        },
        question: {
          type: 'string',
          description: 'Specific question for Gemini',
        },
      },
      required: ['context', 'question'],
    },
  },
];

// Criar server
const server = new Server(
  {
    name: 'mcp-server-gemini',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handler para listar tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Função auxiliar para chamar Gemini
async function callGemini(
  prompt: string,
  modelName: string = 'gemini-2.5-flash',
  temperature: number = 0.7
): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: MODEL_MAPPING[modelName] || modelName,
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 8192,
    },
  });

  const response = await result.response;
  return response.text();
}

// Handler para executar tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Verificar se API key está configurada
    if (!process.env.GEMINI_API_KEY) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ GEMINI_API_KEY not set. Configure with:\nWindows: setx GEMINI_API_KEY "your-api-key"\nLinux/Mac: export GEMINI_API_KEY="your-api-key"\n\nGet API key at: https://makersuite.google.com/app/apikey',
          },
        ],
        isError: true,
      };
    }

    switch (name) {
      case 'gemini_query': {
        const { prompt, model = 'gemini-pro', temperature = 0.7 } = args as {
          prompt: string;
          model?: string;
          temperature?: number;
        };

        const response = await callGemini(prompt, model, temperature);

        return {
          content: [
            {
              type: 'text',
              text: `🤖 **Gemini Response (${model}):**\n\n${response}`,
            },
          ],
        };
      }

      case 'gemini_code_review': {
        const { code, language = 'unknown', focus = 'all' } = args as {
          code: string;
          language?: string;
          focus?: string;
        };

        const prompt = `You are a senior code reviewer. Review the following ${language} code focusing on ${focus}.

Provide:
1. Overall assessment
2. Specific issues found
3. Suggestions for improvement
4. Security concerns (if any)

Code to review:
\`\`\`${language}
${code}
\`\`\`

Be concise but thorough.`;

        const response = await callGemini(prompt, 'gemini-2.5-pro', 0.3);

        return {
          content: [
            {
              type: 'text',
              text: `🔍 **Gemini Code Review:**\n\n${response}`,
            },
          ],
        };
      }

      case 'gemini_compare_approaches': {
        const { task, approaches, criteria = 'overall quality' } = args as {
          task: string;
          approaches: string[];
          criteria?: string;
        };

        const approachesText = approaches
          .map((a, i) => `**Approach ${i + 1}:**\n${a}`)
          .join('\n\n');

        const prompt = `Compare these different approaches for: ${task}

${approachesText}

Criteria: ${criteria}

Provide:
1. Pros and cons of each approach
2. Recommendation with reasoning
3. Potential trade-offs

Be objective and technical.`;

        const response = await callGemini(prompt, 'gemini-2.5-pro', 0.5);

        return {
          content: [
            {
              type: 'text',
              text: `⚖️ **Gemini Comparison:**\n\n${response}`,
            },
          ],
        };
      }

      case 'gemini_brainstorm': {
        const { problem, constraints = 'none', num_ideas = 5 } = args as {
          problem: string;
          constraints?: string;
          num_ideas?: number;
        };

        const prompt = `Brainstorm ${num_ideas} creative solutions for this problem:

**Problem:** ${problem}

**Constraints:** ${constraints}

For each solution, provide:
1. Brief description
2. Key advantages
3. Implementation complexity (Low/Medium/High)

Be creative but practical.`;

        const response = await callGemini(prompt, 'gemini-2.5-pro', 0.9);

        return {
          content: [
            {
              type: 'text',
              text: `💡 **Gemini Brainstorm:**\n\n${response}`,
            },
          ],
        };
      }

      case 'gemini_collaborate': {
        const { context, question } = args as {
          context: string;
          question: string;
        };

        const prompt = `Claude (AI assistant) is working on something and needs a second opinion.

**Context:**
${context}

**Question:**
${question}

Provide a thoughtful, technical response. If you disagree with the approach, explain why and suggest alternatives.`;

        const response = await callGemini(prompt, 'gemini-2.5-pro', 0.7);

        return {
          content: [
            {
              type: 'text',
              text: `🤝 **Gemini's Input:**\n\n${response}`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `❌ Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error executing Gemini: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Iniciar server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Gemini MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
