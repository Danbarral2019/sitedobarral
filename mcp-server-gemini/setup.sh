#!/bin/bash

echo "🚀 Setting up Gemini MCP Server..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build
echo "🔨 Building TypeScript..."
npm run build

# Check if Gemini CLI is installed
if ! command -v gemini &> /dev/null
then
    echo "⚠️  Gemini CLI not found!"
    echo "📥 Install with: npm install -g @google/generative-ai-cli"
    echo "🔑 Then configure with: gemini config set apiKey YOUR_API_KEY"
    exit 1
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add to Claude Code with:"
echo "   claude mcp add gemini --command \"node\" --args \"$(pwd)/build/index.js\""
echo ""
echo "2. Restart Claude Code"
echo ""
echo "3. Available tools:"
echo "   - gemini_query: General queries"
echo "   - gemini_code_review: Code review"
echo "   - gemini_compare_approaches: Compare solutions"
echo "   - gemini_brainstorm: Creative brainstorming"
echo "   - gemini_collaborate: General collaboration"
