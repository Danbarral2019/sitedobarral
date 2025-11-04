# MCP Server - Gemini Integration

MCP (Model Context Protocol) server que integra Gemini CLI com Claude Code para criar um ambiente de trabalho colaborativo entre IAs.

## 🎯 Objetivo

Permitir que Claude Code invoque o Gemini para:
- Obter segundas opiniões sobre soluções
- Revisão de código colaborativa
- Comparação de diferentes abordagens
- Brainstorming criativo
- Validação técnica

## 📋 Pré-requisitos

### 1. Instalar Gemini CLI

```bash
npm install -g @google/generative-ai-cli
```

### 2. Configurar API Key do Gemini

```bash
# Obter API key em: https://makersuite.google.com/app/apikey
gemini config set apiKey YOUR_GEMINI_API_KEY
```

### 3. Testar Gemini

```bash
gemini "Hello, test message"
```

## 🚀 Instalação

### Windows

```bash
cd mcp-server-gemini
.\setup.bat
```

### Linux/Mac

```bash
cd mcp-server-gemini
chmod +x setup.sh
./setup.sh
```

### Manual

```bash
cd mcp-server-gemini
npm install
npm run build

# Adicionar ao Claude Code
claude mcp add gemini --command "node" --args "C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral\mcp-server-gemini\build\index.js"
```

## 🛠️ Tools Disponíveis

### 1. `gemini_query`
Enviar prompts gerais ao Gemini.

**Parâmetros:**
- `prompt` (required): Texto do prompt
- `model` (optional): Modelo Gemini (gemini-pro, gemini-1.5-pro, gemini-1.5-flash)
- `temperature` (optional): Criatividade 0.0-1.0 (default: 0.7)

**Exemplo de uso (Claude invoca automaticamente):**
```
User: "Can you ask Gemini for alternative approaches to handle authentication?"
Claude: [Invokes gemini_query tool internally]
```

### 2. `gemini_code_review`
Revisão de código focada.

**Parâmetros:**
- `code` (required): Código para revisar
- `language` (optional): Linguagem de programação
- `focus` (optional): Foco (security, performance, best-practices, all)

### 3. `gemini_compare_approaches`
Comparar diferentes implementações.

**Parâmetros:**
- `task` (required): Descrição da tarefa
- `approaches` (required): Array de abordagens
- `criteria` (optional): Critério de comparação

### 4. `gemini_brainstorm`
Brainstorming criativo.

**Parâmetros:**
- `problem` (required): Problema a resolver
- `constraints` (optional): Restrições
- `num_ideas` (optional): Número de ideias (1-10, default: 5)

### 5. `gemini_collaborate`
Colaboração geral - Claude compartilha contexto e pergunta.

**Parâmetros:**
- `context` (required): Contexto do que Claude está fazendo
- `question` (required): Pergunta específica

## 💡 Casos de Uso

### Exemplo 1: Segunda Opinião
```
User: "Implement user authentication"
Claude: "I'm implementing JWT-based auth. Let me check with Gemini..."
Claude: [Invokes gemini_collaborate with context and question]
Gemini: "JWT is good, but consider refresh token rotation..."
Claude: "Based on Gemini's input, I'll also add refresh tokens..."
```

### Exemplo 2: Code Review
```
User: "Review this function"
Claude: [Invokes gemini_code_review]
Gemini: "Security issue: SQL injection risk..."
Claude: "Gemini found a security issue. Let me fix it..."
```

### Exemplo 3: Comparar Abordagens
```
User: "What's the best way to cache data?"
Claude: "Let me compare approaches with Gemini..."
Claude: [Invokes gemini_compare_approaches with Redis, In-memory, CDN]
Gemini: "For your use case (high read, low write), Redis is best..."
```

## 🔧 Configuração no Claude Code

O MCP é adicionado ao arquivo de configuração do Claude Code:

**Windows:** `%USERPROFILE%\.claude\mcp.json`
**Mac/Linux:** `~/.claude/mcp.json`

```json
{
  "mcpServers": {
    "gemini": {
      "command": "node",
      "args": [
        "C:\\Projeto de site do Barral\\projeto do site no claude\\site-prof-barral\\mcp-server-gemini\\build\\index.js"
      ]
    }
  }
}
```

## 🧪 Teste Manual

```bash
# Testar se está funcionando
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node build/index.js
```

## 🐛 Troubleshooting

### Gemini CLI não encontrado
```bash
npm install -g @google/generative-ai-cli
gemini config set apiKey YOUR_API_KEY
```

### MCP não aparece no Claude Code
```bash
# Verificar MCPs instalados
claude mcp list

# Remover e reinstalar
claude mcp remove gemini
claude mcp add gemini --command "node" --args "C:\...\build\index.js"
```

### Erro de buffer
Se receber erro de buffer excedido, o server usa `maxBuffer: 10MB`. Para respostas maiores, edite `src/index.ts`.

## 📊 Logs

Logs são enviados para stderr:
```bash
# Ver logs
node build/index.js 2> logs.txt
```

## 🔄 Atualizar

```bash
cd mcp-server-gemini
git pull
npm install
npm run build
```

## 📚 Referências

- [MCP Specification](https://modelcontextprotocol.io)
- [Gemini API Docs](https://ai.google.dev/docs)
- [Claude Code Docs](https://docs.claude.com/claude-code)

## 🤝 Workflow Colaborativo

```
┌─────────┐         ┌─────────┐         ┌─────────┐
│  User   │────────▶│ Claude  │◀───────▶│ Gemini  │
└─────────┘         └─────────┘         └─────────┘
                         │
                         │ Invoca MCP Tools
                         ▼
                    ┌─────────┐
                    │   MCP   │
                    │ Server  │
                    └─────────┘
                         │
                         │ Executa Gemini CLI
                         ▼
                    ┌─────────┐
                    │ Gemini  │
                    │   API   │
                    └─────────┘
```

## 📝 License

MIT
