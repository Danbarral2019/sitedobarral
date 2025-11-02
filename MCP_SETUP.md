# MCP Setup - Model Context Protocol Servers

**Data de configuração:** 2025-11-02
**Status:** ✅ 3 MCPs ativos e funcionais

Este documento registra a configuração completa dos MCP (Model Context Protocol) servers instalados no projeto, suas capacidades e exemplos de uso.

---

## 📋 O que é MCP?

MCP (Model Context Protocol) é um padrão open-source que permite ao Claude Code integrar-se com ferramentas e fontes de dados externas. Através de servidores MCP, o Claude ganha acesso a:

- 🗄️ Bancos de dados
- 🌐 APIs externas
- 🤖 Sistemas de automação
- 📊 Serviços de monitoramento
- 🔧 Ferramentas de desenvolvimento

---

## 🚀 Status Atual - MCPs Instalados

✅ **Playwright MCP** - Browser automation (scope: user)
✅ **PostgreSQL MCP** - Database queries (scope: local)
✅ **GitHub MCP** - Repository management (scope: user)

---

## 🎭 1. Playwright MCP Server

**Status:** ✅ Conectado
**Escopo:** User (disponível em todos os projetos)
**Comando:** `npx -y @playwright/mcp@latest --headless`
**Pacote:** `@playwright/mcp` (oficial Microsoft)

### Capacidades:
- ✅ Automação de navegador (Chrome, Firefox, Safari)
- ✅ Testes end-to-end (E2E)
- ✅ Web scraping estruturado
- ✅ Capturas de tela e gravação de vídeo
- ✅ Interação com elementos da página
- ✅ Verificação de acessibilidade
- ✅ Testes de responsividade

### Exemplos de Uso:
```bash
# Via Claude Code, você pode pedir:
"Teste o fluxo de login do aluno no site"
"Acesse o site do TCU e extraia os últimos acórdãos"
"Capture screenshot da página inicial em mobile e desktop"
"Verifique se há links quebrados no site"
"Teste o fluxo completo: login → área restrita → download de documento"
```

### Instalação:
```bash
claude mcp add -s user playwright -- npx -y @playwright/mcp@latest --headless
```

---

## 🐘 2. PostgreSQL MCP Server

**Status:** ✅ Conectado
**Escopo:** Local (específico deste projeto, com credenciais protegidas)
**Comando:** `npx -y @henkey/postgres-mcp-server --connection-string postgresql://[...]`
**Pacote:** `@henkey/postgres-mcp-server`
**Banco:** Neon PostgreSQL (produção)

### Capacidades:
- ✅ Executar queries SQL diretamente
- ✅ Inspecionar schema do banco
- ✅ Analisar dados e gerar relatórios
- ✅ Otimizar queries e índices
- ✅ Gerenciar tabelas e relacionamentos
- ✅ Backup e restauração de dados
- ✅ Debugging de problemas no banco

### Exemplos de Uso:
```bash
# Via Claude Code, você pode pedir:
"Mostre os 10 documentos mais acessados do último mês"
"Quantos usuários temos com enrollments expirando nos próximos 30 dias?"
"Analise a distribuição de documentos TCU por área"
"Quais cursos têm mais documentos cadastrados?"
"Me mostre todos os QR codes válidos e seus status de uso"
"Crie um relatório de acessos à área restrita por curso"
```

### Instalação:
```bash
claude mcp add -s local postgresql -- npx -y @henkey/postgres-mcp-server --connection-string "postgresql://user:pass@host/database?sslmode=require"
```

**⚠️ Importante:** Use scope `local` para proteger credenciais do banco.

---

## 🐙 3. GitHub MCP Server

**Status:** ✅ Conectado
**Escopo:** User (disponível em todos os projetos)
**Comando:** `npx -y @modelcontextprotocol/server-github`
**Pacote:** `@modelcontextprotocol/server-github`
**Autenticação:** Personal Access Token (PAT)

### Capacidades:
- ✅ Criar e gerenciar issues
- ✅ Criar e gerenciar Pull Requests
- ✅ Fazer commits e pushes
- ✅ Ler e comentar em issues/PRs
- ✅ Buscar código no repositório
- ✅ Analisar histórico de commits
- ✅ Gerenciar branches
- ✅ Code review automatizado

### Exemplos de Uso:
```bash
# Via Claude Code, você pode pedir:
"Crie uma issue para implementar exportação em Excel dos documentos TCU"
"Analise os últimos 10 commits e me dê um resumo das mudanças"
"Crie um PR com as alterações atuais"
"Mostre todas as issues abertas relacionadas a 'documentos'"
"Adicione um comentário na issue #123 com o status atual"
```

### Instalação:

**Passo 1:** Criar Personal Access Token
1. Acesse: https://github.com/settings/tokens
2. Clique em "Generate new token (classic)"
3. Selecione os escopos: `repo`, `workflow`, `read:org`
4. Copie o token

**Passo 2:** Instalar MCP
```bash
claude mcp add -s user github -e GITHUB_PERSONAL_ACCESS_TOKEN=seu_token_aqui -- npx -y @modelcontextprotocol/server-github
```

---

## 🔧 Gerenciamento de MCPs

### Listar MCPs instalados
```bash
claude mcp list
```

Saída esperada:
```
✅ playwright    - Connected
✅ github        - Connected
✅ postgresql    - Connected
```

### Ver detalhes de um MCP
```bash
claude mcp get postgresql
```

### Remover um MCP
```bash
claude mcp remove playwright
```

### Reconfigurar um MCP
```bash
# Remover o antigo
claude mcp remove github

# Adicionar novamente com novas configurações
claude mcp add -s user github -e GITHUB_PERSONAL_ACCESS_TOKEN=novo_token -- npx -y @modelcontextprotocol/server-github
```

---

## 🎯 Casos de Uso no Projeto

### Com Playwright MCP:
1. **Testes Automatizados:** Validar fluxos críticos (login, QR code, downloads)
2. **Web Scraping:** Coletar dados do TCU, AGU, DOU automaticamente
3. **Validação Visual:** Garantir que o site está renderizando corretamente
4. **Testes de Integração:** Verificar fluxos completos de usuário
5. **Verificação de Links:** Detectar links quebrados automaticamente

### Com PostgreSQL MCP:
1. **Analytics:** Gerar relatórios de uso e estatísticas
2. **Debugging:** Investigar problemas de dados
3. **Manutenção:** Limpeza de dados duplicados, migração
4. **Otimização:** Identificar queries lentas e melhorar performance
5. **Auditoria:** Analisar logs de acesso e uso do sistema

### Com GitHub MCP:
1. **Gestão de Tarefas:** Criar e organizar issues automaticamente
2. **Documentação:** Gerar documentação de código e features
3. **Code Review:** Análise automatizada de PRs
4. **Release Management:** Automatizar processo de releases
5. **Colaboração:** Facilitar comunicação via issues/PRs

---

## 🐛 Troubleshooting

### MCP não conecta

**Problema:** `✗ Failed to connect`

**Soluções:**
1. Verifique se o comando está correto: `claude mcp get <nome>`
2. Para HTTP MCPs: verifique URL e autenticação
3. Para stdio MCPs: verifique se o pacote npm está disponível
4. Tente remover e reinstalar: `claude mcp remove <nome>` → `claude mcp add ...`

### GitHub MCP falha autenticação

**Problema:** GitHub MCP não conecta

**Soluções:**
1. Verifique se o PAT está válido e não expirado
2. Confirme que o token tem os escopos necessários (`repo`, `workflow`)
3. Remova e reconfigure com novo token
4. Verifique se não há caracteres especiais mal formatados no token

### PostgreSQL MCP timeout

**Problema:** Queries demoram muito ou timeout

**Soluções:**
1. Verifique conexão com o banco: `psql` ou `npx prisma studio`
2. Confirme se o Neon database está ativo
3. Verifique firewall/whitelist de IPs
4. Use queries mais específicas (LIMIT, WHERE)

### Erro ao executar npx

**Soluções:**
1. Certifique-se de que Node.js está instalado: `node --version`
2. Certifique-se de que npm está instalado: `npm --version`
3. Limpe o cache do npx: `npx clear-npx-cache`

---

## 🎯 Boas Práticas

### Scopes (Escopos)

- **`--scope local` (ou `-s local`):** Para MCPs com credenciais sensíveis (ex: PostgreSQL)
  - Armazenado apenas neste projeto
  - Não compartilhado via Git
  - Ideal para: bancos de dados, APIs com tokens privados

- **`--scope user` (ou `-s user`):** Para MCPs de uso geral
  - Disponível em todos os seus projetos
  - Ideal para: GitHub, Playwright, ferramentas de desenvolvimento

- **`--scope project`:** Para MCPs compartilhados com a equipe
  - Armazenado em `.mcp.json` no projeto
  - Commitado no Git
  - Requer aprovação antes de uso

### Segurança

1. **Nunca commite tokens/credenciais no Git**
2. Use scope `local` para MCPs com credenciais sensíveis
3. Revogue tokens quando não estiverem mais em uso
4. Use GitHub PATs com escopos mínimos necessários
5. Rotacione credenciais periodicamente

---

## 📚 Recursos e Documentação

### Documentação Oficial
- **Claude Code MCP Docs:** https://docs.claude.com/en/docs/claude-code/mcp
- **GitHub MCP Server:** https://github.com/github/github-mcp-server
- **Playwright MCP:** https://github.com/microsoft/playwright-mcp
- **PostgreSQL MCP:** https://github.com/HenkDz/postgresql-mcp-server
- **MCP Specification:** https://modelcontextprotocol.io/

### Comandos Úteis
```bash
# Ver todos os comandos MCP
claude mcp --help

# Ver ajuda de um comando específico
claude mcp add --help

# Verificar versão do Claude Code
claude --version
```

---

## 🔄 MCPs Futuros (Potenciais)

### 1. **Resend MCP** (quando estável)
- Gestão avançada de emails
- Análise de taxa de abertura
- Template management

### 2. **MailChimp MCP** (quando disponível)
- Automação de campanhas
- Segmentação avançada
- Analytics de newsletter

### 3. **Sentry MCP**
- Monitoramento de erros
- Performance tracking
- Alertas automáticos

### 4. **Figma MCP**
- Importação de designs
- Exportação de assets
- Sincronização design-código

---

## ✅ Checklist de Configuração

- [x] Playwright MCP instalado e testado
- [x] PostgreSQL MCP instalado e conectado ao Neon
- [x] GitHub MCP instalado e autenticado com PAT
- [x] Documentação criada (este arquivo)
- [x] CLAUDE.md atualizado com referências aos MCPs
- [ ] Criar exemplos práticos de uso para a equipe
- [ ] Configurar MCPs adicionais conforme necessidade

---

## 📝 Histórico de Mudanças

- **2025-11-02:** Documentação completa criada
- **2025-11-02:** GitHub MCP instalado e autenticado
- **2025-11-02:** PostgreSQL MCP conectado ao Neon
- **2025-11-02:** Playwright MCP instalado (oficial Microsoft)
- **2025-11-02:** Todos os 3 MCPs verificados e funcionais

---

**Última atualização:** 2025-11-02
**Configurado por:** Claude Code
**Status:** ✅ Todos os MCPs operacionais
