@echo off
echo 🚀 Setting up Gemini MCP Server...

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Build
echo 🔨 Building TypeScript...
call npm run build

REM Check if Gemini CLI is installed
where gemini >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Gemini CLI not found!
    echo 📥 Install with: npm install -g @google/generative-ai-cli
    echo 🔑 Then configure with: gemini config set apiKey YOUR_API_KEY
    exit /b 1
)

echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Add to Claude Code with:
echo    claude mcp add gemini --command "node" --args "%CD%\build\index.js"
echo.
echo 2. Restart Claude Code
echo.
echo 3. Available tools:
echo    - gemini_query: General queries
echo    - gemini_code_review: Code review
echo    - gemini_compare_approaches: Compare solutions
echo    - gemini_brainstorm: Creative brainstorming
echo    - gemini_collaborate: General collaboration
