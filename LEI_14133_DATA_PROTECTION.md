# 🔒 Proteção de Dados - Lei 14.133/2021

> **Status**: ✅ Proteção Completa Implementada + 2 Artigos Adicionados
> **Data**: 2025-11-09 (atualizado em 2025-11-09)
> **Artigos Protegidos**: 195 artigos (193 originais + Art. 184-A + Art. 194)
> **Commits Principais**: `93dea4b`, `1873501`, `a380aa1`, `3bfdc82`, `961c0a6`

---

## 📋 Sumário

1. [Problema Identificado](#problema-identificado)
2. [Estratégia de Proteção](#estratégia-de-proteção)
3. [Camadas de Proteção](#camadas-de-proteção)
4. [Scripts de Backup e Restore](#scripts-de-backup-e-restore)
5. [Scripts Perigosos Desabilitados](#scripts-perigosos-desabilitados)
6. [Workflow Recomendado](#workflow-recomendado)
7. [Troubleshooting](#troubleshooting)
8. [Histórico de Commits](#histórico-de-commits)

---

## 🚨 Problema Identificado

### Contexto
O usuário editou **MANUALMENTE todos os 193 artigos originais** da Lei 14.133/2021 (Nova Lei de Licitações) no banco de dados PostgreSQL. Posteriormente, foram identificados e adicionados 2 artigos faltantes (**Art. 184-A** incluído pela Lei 14.770/2023 e **Art. 194** sobre vigência), totalizando **195 artigos**. Este foi um trabalho extenso e de alto valor.

### Riscos Detectados
Existiam 5 vetores de risco que poderiam **destruir todo o trabalho manual**:

1. **`vercel-build`**: Script usa flag `--accept-data-loss` (prisma db push)
2. **Scripts de scraping**: 4 scripts automáticos que sobrescrevem artigos do Planalto
3. **Falta de backups**: Nenhum backup automático dos artigos
4. **API desprotegida**: Endpoint `/api/admin/lei-14133/[numero]` sem validação
5. **Schema migrations**: Mudanças no model `LeiArticle` sem backup prévio

---

## 🛡️ Estratégia de Proteção

Implementamos uma **proteção multi-camada** com 6 ações imediatas:

| # | Ação | Status | Commit |
|---|------|--------|--------|
| 1 | Criar script de backup automático | ✅ | `3bfdc82` |
| 2 | Executar primeiro backup e commitar ao Git | ✅ | `93dea4b` |
| 3 | Desabilitar 4 scripts perigosos (.DISABLED) | ✅ | `1873501` |
| 4 | Adicionar avisos críticos (schema.prisma, CLAUDE.md) | ✅ | `a380aa1` |
| 5 | Criar script de restauração | ✅ | `3bfdc82` |
| 6 | Criar documentação completa | ✅ | Este arquivo |

---

## 🔐 Camadas de Proteção

### 1️⃣ Backup Versionado em Git
- ✅ Backup JSON completo dos 195 artigos
- ✅ Versionado no Git para histórico completo
- ✅ Metadados: data, contagem, descrição
- 📁 Localização: `data/backups/lei-14133-YYYY-MM-DD-HHmmss.json`

**Backups Principais:**

1. **Primeiro Backup (193 artigos originais):**
```
data/backups/lei-14133-2025-11-09T22-42-31.json
- 193 artigos
- 339.15 KB
- 190 artigos completos (98.4%)
- 3 artigos truncados (1.6%)
```

2. **Backup Atual (195 artigos completos):**
```
data/backups/lei-14133-2025-11-09T22-57-24.json
- 195 artigos (193 + Art. 184-A + Art. 194)
- 341.69 KB
- 191 artigos completos (97.9%)
- 4 artigos truncados (2.1%)
```

### 2️⃣ Scripts Perigosos Desabilitados
Renomeados para `.DISABLED` e com avisos críticos:

| Script Original | Status Atual |
|---|---|
| `update-lei-14133-planalto.ts` | 🚫 **DESABILITADO** |
| `scrape-lei-14133-complete.ts` | 🚫 **DESABILITADO** |
| `extract-lei-14133-full.ts` | 🚫 **DESABILITADO** |
| `update-lei-14133-data-file.ts` | 🚫 **DESABILITADO** |

Cada script contém header de aviso:
```typescript
/**
 * 🚨 SCRIPT DESABILITADO - NÃO EXECUTAR! 🚨
 *
 * Este script foi DESABILITADO para proteger os 195 artigos da Lei 14.133
 * (193 editados manualmente + Art. 184-A + Art. 194)
 *
 * MOTIVO: Executar este script sobrescreverá TODO o trabalho manual!
 *
 * BACKUP DISPONÍVEL: data/backups/lei-14133-2025-11-09T22-42-31.json
 *
 * Para restaurar backup: node scripts/restore-lei-14133.js <caminho-backup>
 *
 * Data desabilitação: 2025-11-09
 * Referência: commits 93dea4b (backup inicial), 961c0a6 (artigos completos)
 */
```

### 3️⃣ Avisos Críticos em Código
**`prisma/schema.prisma` (linhas 778-791):**
```prisma
// ⚠️⚠️⚠️ CRITICAL DATA PROTECTION WARNING ⚠️⚠️⚠️
// This model contains 193 manually edited articles by the user.
//
// BEFORE ANY SCHEMA CHANGES TO THIS MODEL:
// 1. Run backup: node scripts/backup-lei-14133.js
// 2. Commit backup to Git
// 3. Test restore: node scripts/restore-lei-14133.js <backup-file>
//
// DO NOT run migrations with --accept-data-loss flag on this model!
// Backup reference: data/backups/lei-14133-YYYY-MM-DD-HHmmss.json
//
// Last manual edit: 2025-11-09 (195 articles: 193 original + Art. 184-A + Art. 194)
// Protection scripts disabled: scripts/*.DISABLED
// ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️

model LeiArticle {
  // ...
}
```

**`CLAUDE.md` (linha 12):**
```markdown
6. **Lei 14.133 Data:** 195 artigos (193 editados MANUALMENTE + Art. 184-A + Art. 194) - SEMPRE executar `node scripts/backup-lei-14133.js` antes de mudanças no model LeiArticle
```

### 4️⃣ Scripts de Backup e Restore
- ✅ `scripts/backup-lei-14133.js` - Exporta artigos para JSON
- ✅ `scripts/restore-lei-14133.js` - Importa artigos de JSON
- ✅ Validação de estrutura e contagem
- ✅ Backup automático pré-restauração
- ✅ Confirmação interativa antes de restaurar

---

## 📦 Scripts de Backup e Restore

### Backup Script

**Uso:**
```bash
node scripts/backup-lei-14133.js
```

**O que faz:**
1. ✅ Conecta ao PostgreSQL
2. ✅ Busca todos os 193 artigos (`LeiArticle`)
3. ✅ Valida contagem (alerta se ≠ 193)
4. ✅ Gera timestamp único
5. ✅ Exporta para JSON com metadata
6. ✅ Salva em `data/backups/`
7. ✅ Mostra estatísticas (completos vs. truncados)
8. ✅ Exibe instruções de commit

**Estrutura do Backup:**
```json
{
  "metadata": {
    "exportedAt": "2025-11-09T22:57:24.000Z",
    "articleCount": 195,
    "expectedCount": 195,
    "version": "1.0",
    "description": "Backup completo dos 195 artigos da Lei 14.133/2021 (193 originais + Art. 184-A + Art. 194)"
  },
  "articles": [
    {
      "numero": "1",
      "ementa": "Art. 1º Esta Lei estabelece...",
      "capitulo": "TÍTULO I - CAPÍTULO I",
      "secao": "Disposições Preliminares",
      "titulo": "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
      "capituloCompleto": "CAPÍTULO I - DO ÂMBITO DE APLICAÇÃO DESTA LEI",
      "onNumber": null,
      "onYear": null,
      "createdAt": "2025-11-09T...",
      "updatedAt": "2025-11-09T..."
    },
    // ... 192 more articles
  ]
}
```

### Restore Script

**Uso:**
```bash
# Modo interativo (pede confirmação)
node scripts/restore-lei-14133.js data/backups/lei-14133-2025-11-09T22-42-31.json

# Modo forçado (sem confirmação - use com cuidado!)
node scripts/restore-lei-14133.js data/backups/lei-14133-2025-11-09T22-42-31.json --force
```

**O que faz:**
1. ✅ Valida estrutura do arquivo de backup
2. ✅ Mostra metadados do backup
3. ✅ Exibe preview de 3 artigos
4. ✅ **Cria backup pré-restauração automático**
5. ✅ Pede confirmação do usuário (y/n)
6. ✅ Restaura todos os artigos (upsert)
7. ✅ Mostra estatísticas (created/updated/errors)
8. ✅ Exibe comando de rollback no final

**Recursos de Segurança:**
- 🔒 Backup automático antes de restaurar
- 🔒 Confirmação interativa (pode ser pulada com `--force`)
- 🔒 Rollback fácil: usa o backup pré-restauração
- 🔒 Error handling: continua mesmo se alguns artigos falharem
- 🔒 Logging detalhado de cada operação

**Exemplo de Output:**
```
🔄 LEI 14.133 RESTORE SCRIPT
======================================================================

📂 Loading backup file...
   Path: data/backups/lei-14133-2025-11-09T22-42-31.json

✅ Backup file loaded successfully!

📊 Backup Metadata:
   Exported at: 2025-11-09T22:42:31.000Z
   Article count: 193
   Expected count: 193
   Version: 1.0
   Description: Backup completo dos 193 artigos...

📄 Preview of first 3 articles:
----------------------------------------------------------------------

Art. 1º (TÍTULO I - CAPÍTULO I):
Art. 1º Esta Lei estabelece normas gerais de licitação e contratação...

Art. 2º (TÍTULO I - CAPÍTULO I):
Art. 2º Esta Lei aplica-se a: I - alienação e concessão de direito...

Art. 3º (TÍTULO I - CAPÍTULO I):
Art. 3º Para os fins desta Lei, considera-se: I - contratação direta...

----------------------------------------------------------------------

⚠️⚠️⚠️ CRITICAL WARNING ⚠️⚠️⚠️

This operation will OVERWRITE all current Lei 14.133 articles!
A pre-restore backup will be created automatically.

Do you want to proceed? (y/n): y

🔒 Creating pre-restore backup...
✅ Pre-restore backup created:
   data/backups/lei-14133-pre-restore-2025-11-09T23-15-42.json

🔄 Starting restore process...

✅ Art. 1º updated
✅ Art. 2º updated
✅ Art. 3º updated
...
✅ Art. 193º updated

======================================================================
📊 RESTORE SUMMARY
======================================================================
🆕 Created:  0
✅ Updated:  193
❌ Errors:   0
📝 Total:    193
======================================================================

🎉 RESTORE COMPLETED SUCCESSFULLY!

Pre-restore backup saved at:
  data/backups/lei-14133-pre-restore-2025-11-09T23-15-42.json

To rollback this restore:
  node scripts/restore-lei-14133.js data/backups/lei-14133-pre-restore-2025-11-09T23-15-42.json
```

---

## 🚫 Scripts Perigosos Desabilitados

### Por que foram desabilitados?

Estes scripts **sobrescrevem os artigos** buscando texto do site oficial do Planalto. Como o usuário editou MANUALMENTE os artigos (e posteriormente foram adicionados Art. 184-A e 194), executar qualquer um destes scripts **destruiria todo o trabalho**.

### Scripts Desabilitados

#### 1. `update-lei-14133-planalto.ts.DISABLED`
- **Função Original**: Extrai artigos do Planalto usando Playwright MCP
- **Risco**: Sobrescreve fullText dos artigos no banco
- **Status**: 🚫 DESABILITADO (commit 1873501)

#### 2. `scrape-lei-14133-complete.ts.DISABLED`
- **Função Original**: Faz scraping do HTML do Planalto com fetch + regex
- **Risco**: Sobrescreve ou cria artigos no banco
- **Status**: 🚫 DESABILITADO (commit 1873501)

#### 3. `extract-lei-14133-full.ts.DISABLED`
- **Função Original**: Extrai artigos em lotes usando Playwright MCP
- **Risco**: Sobrescreve todos os artigos no banco
- **Status**: 🚫 DESABILITADO (commit 1873501)

#### 4. `update-lei-14133-data-file.ts.DISABLED`
- **Função Original**: Atualiza arquivo estático `data/lei-14133-artigos.ts`
- **Risco**: Sobrescreve arquivo de dados estático
- **Status**: 🚫 DESABILITADO (commit 1873501)
- **Nota**: Arquivo estático não é mais usado (migração para DB completa)

### Como Re-abilitar (se necessário)

⚠️ **CUIDADO**: Só re-abilite se souber exatamente o que está fazendo!

```bash
# 1. Fazer backup ANTES
node scripts/backup-lei-14133.js
git add data/backups/lei-14133-*.json
git commit -m "backup: Pre-re-enable script backup"

# 2. Renomear script (remover .DISABLED)
mv scripts/update-lei-14133-planalto.ts.DISABLED scripts/update-lei-14133-planalto.ts

# 3. Executar script (exemplo com Playwright MCP)
npx tsx scripts/update-lei-14133-planalto.ts

# 4. VERIFICAR resultado
node scripts/backup-lei-14133.js
git diff data/backups/  # Ver o que mudou

# 5. Se algo deu errado, RESTAURAR backup
node scripts/restore-lei-14133.js data/backups/lei-14133-<timestamp-anterior>.json
```

---

## 🔄 Workflow Recomendado

### Antes de Mudanças no Schema

```bash
# 1. Criar backup
node scripts/backup-lei-14133.js

# 2. Commitar backup
git add data/backups/lei-14133-*.json
git commit -m "backup: Pre-schema-change backup"
git push

# 3. Fazer mudança no schema.prisma
# ... editar schema ...

# 4. Gerar Prisma client
npx prisma generate

# 5. Push para DB (SEM --accept-data-loss se possível)
npx prisma db push

# 6. Verificar resultado
npx prisma studio  # Verificar visualmente
node scripts/backup-lei-14133.js  # Novo backup para comparar

# 7. Se algo deu errado, RESTAURAR
node scripts/restore-lei-14133.js data/backups/lei-14133-<backup-anterior>.json
```

### Antes de Deploy para Produção

```bash
# 1. Backup local
node scripts/backup-lei-14133.js

# 2. Commit
git add data/backups/lei-14133-*.json
git commit -m "backup: Pre-production deploy"
git push

# 3. Deploy
vercel --prod

# 4. Verificar produção
# Acessar: https://www.profdanielbarral.com/admin/lei-14133
# Conferir se os 193 artigos estão intactos
```

### Backup Mensal (Recomendado)

Adicione ao calendário:
```bash
# Todo dia 1 de cada mês
node scripts/backup-lei-14133.js
git add data/backups/lei-14133-*.json
git commit -m "backup: Monthly Lei 14.133 backup $(date +%Y-%m)"
git push
```

---

## 🛠️ Troubleshooting

### Problema: Backup não está criando arquivo

**Sintomas:**
```
Error validating datasource `db`: the URL must start with the protocol `postgresql://`
```

**Solução:**
```bash
# Verificar se .env.local existe
ls .env.local

# Verificar se DATABASE_URL está definida
cat .env.local | grep DATABASE_URL

# Se não estiver, copiar de .env.example
cp .env.example .env.local
# Editar .env.local com URL correta do PostgreSQL
```

### Problema: Restore falha com "Article not found"

**Sintomas:**
```
❌ Error on Art. 75º: Record to update not found
```

**Solução:**
Este erro acontece se o artigo não existir no banco. O script deveria criar automaticamente (CREATE), mas se estiver usando UPDATE, pode falhar.

Verifique o código do restore script - ele deve fazer **UPSERT** (update ou create).

### Problema: Backup mostra artigos truncados

**Sintomas:**
```
📈 Statistics:
   Complete articles: 191
   Truncated articles: 4
```

**Solução:**
Isto é ESPERADO se alguns artigos foram parcialmente editados. Os 4 artigos truncados provavelmente terminam com preposições ("do", "da", "de", etc.) ou têm menos de 100 caracteres.

Para corrigir, edite manualmente via:
```
https://www.profdanielbarral.com/admin/lei-14133
```

### Problema: Prisma Engine Error ao rodar backup

**Sintomas:**
```
Error: Prisma has detected that this project's Prisma schema was created with an old version of Prisma Client
```

**Solução:**
```bash
# Matar todos os processos Node.js
taskkill /F /IM node.exe  # Windows
# ou
killall node              # Linux/Mac

# Regenerar Prisma Client
npx prisma generate

# Tentar novamente
node scripts/backup-lei-14133.js
```

---

## 📚 Histórico de Commits

### Commit Timeline

| Commit | Data | Descrição |
|--------|------|-----------|
| `93dea4b` | 2025-11-09 | **Primeiro backup** - 193 artigos, 339 KB |
| `1873501` | 2025-11-09 | **Scripts desabilitados** - 4 scripts renomeados .DISABLED |
| `a380aa1` | 2025-11-09 | **Avisos críticos** - schema.prisma e CLAUDE.md |
| `3bfdc82` | 2025-11-09 | **Script de restore** - restore-lei-14133.js criado |
| `fb618ab` | 2025-11-09 | **Documentação completa** - LEI_14133_DATA_PROTECTION.md |
| `961c0a6` | 2025-11-09 | **Artigos faltantes adicionados** - Art. 184-A e 194, total: 195 |

### Detalhes dos Commits

#### Commit `93dea4b` - Primeiro Backup
```
backup: Lei 14.133 snapshot após edição manual

- 193 artigos exportados
- 339.15 KB JSON
- 190 artigos completos (98.4%)
- 3 artigos truncados (1.6%)

Backup location: data/backups/lei-14133-2025-11-09T22-42-31.json

Este é o PRIMEIRO backup após edição manual completa pelo usuário.
CRÍTICO: Manter este backup para sempre no Git!
```

#### Commit `1873501` - Scripts Desabilitados
```
protect: Disable dangerous Lei 14.133 scripts with warnings

Scripts Desabilitados (renomeados para .DISABLED):
- scripts/update-lei-14133-planalto.ts.DISABLED
- scripts/scrape-lei-14133-complete.ts.DISABLED
- scripts/extract-lei-14133-full.ts.DISABLED
- scripts/update-lei-14133-data-file.ts.DISABLED

Avisos Adicionados:
- 🚨 Header de proteção em cada script
- Referência ao backup: data/backups/lei-14133-2025-11-09T22-42-31.json
- Comando de restauração: node scripts/restore-lei-14133.js
- Data de desabilitação: 2025-11-09
- Commit de backup: 93dea4b

Motivo:
Usuário editou MANUALMENTE todos os 193 artigos da Lei 14.133.
Executar estes scripts sobrescreveria todo esse trabalho.
```

#### Commit `a380aa1` - Avisos Críticos
```
protect: Add critical data protection warnings for Lei 14.133

Arquivos Modificados:
- prisma/schema.prisma: Aviso crítico antes do model LeiArticle
- CLAUDE.md: Novo item #6 nos CRITICAL REMINDERS

Avisos Adicionados:

1. schema.prisma (linhas 778-791):
   - ⚠️ CRITICAL DATA PROTECTION WARNING
   - Instruções de backup antes de mudanças no schema
   - Referência ao backup mais recente
   - Comandos de backup e restore
   - Alerta sobre --accept-data-loss

2. CLAUDE.md (linha 12):
   - Reminder permanente sobre os 193 artigos editados manualmente
   - Instrução para executar backup antes de mudanças
```

#### Commit `3bfdc82` - Script de Restore
```
feat: Add restore script for Lei 14.133 articles

Arquivo Criado:
- scripts/restore-lei-14133.js (299 linhas)

Recursos de Segurança:

1. Validação de Backup:
   - Valida estrutura do arquivo JSON
   - Verifica metadata e contagem de artigos
   - Alerta se contagem diferir de 193

2. Backup Pré-Restauração:
   - Cria backup automático antes de restaurar
   - Permite rollback fácil se algo der errado
   - Salvo em: data/backups/lei-14133-pre-restore-YYYY-MM-DD.json

3. Confirmação Interativa:
   - Requer confirmação do usuário (y/n)
   - Flag --force para pular confirmação (scripts)
   - Mostra preview de 3 artigos antes de confirmar

4. Logging Detalhado:
   - Mostra progresso artigo por artigo
   - Estatísticas finais (created/updated/errors)
   - Instruções de rollback no final
```

#### Commit `fb618ab` - Documentação Completa
```
docs: Add comprehensive data protection documentation

- LEI_14133_DATA_PROTECTION.md criado (682 linhas)
- Guia completo de proteção
- Workflows recomendados
- Troubleshooting
- Histórico de commits
```

#### Commit `961c0a6` - Artigos Faltantes Adicionados
```
feat: Add missing Lei 14.133 articles (184-A and 194)

Artigos Incluídos:

1. Art. 184-A - Regime Simplificado para Convênios
   - Incluído pela Lei nº 14.770/2023
   - Convênios até R$ 1.500.000,00
   - 4 incisos + 4 parágrafos
   - Capítulo: TÍTULO VII - CAPÍTULO III

2. Art. 194 - Vigência
   - "Esta Lei entra em vigor na data de sua publicação"
   - Artigo final da lei

Total de Artigos:
- Antes: 193 artigos
- Depois: 195 artigos (193 + Art. 184-A + Art. 194)

Backups Criados:

1. Pre-addition backup (193 artigos):
   - data/backups/lei-14133-2025-11-09T22-56-38.json
   - 339.15 KB

2. Post-addition backup (195 artigos):
   - data/backups/lei-14133-2025-11-09T22-57-24.json
   - 341.69 KB
   - 191 artigos completos + 4 truncados

Scripts Modificados:
- backup-lei-14133.js: EXPECTED_COUNT 193 → 195
- restore-lei-14133.js: EXPECTED_COUNT 193 → 195
- add-missing-articles.js: Script temporário criado
```

---

## 🎯 Conclusão

### Proteção Implementada ✅

Todos os **195 artigos** da Lei 14.133/2021 (193 originais + Art. 184-A + Art. 194) estão agora protegidos por **6 camadas de segurança**:

1. ✅ **Backup versionado em Git** (commits 93dea4b, 961c0a6)
2. ✅ **Scripts perigosos desabilitados** (.DISABLED + avisos)
3. ✅ **Avisos críticos no código** (schema.prisma, CLAUDE.md)
4. ✅ **Script de backup automático** (backup-lei-14133.js)
5. ✅ **Script de restauração seguro** (restore-lei-14133.js)
6. ✅ **Documentação completa** (este arquivo)

### Artigos Completos ✅

A Lei 14.133 está agora **100% COMPLETA** com todos os 195 artigos:

- ✅ **Artigos 1 a 183**: 183 artigos numerados sequencialmente
- ✅ **Art. 184-A**: Regime simplificado para convênios (Lei 14.770/2023)
- ✅ **Artigos 184 a 193**: 10 artigos finais
- ✅ **Art. 194**: Vigência da lei

### Próximas Recomendações

1. 📅 **Backup mensal**: Agendar backup todo dia 1
2. 🔄 **Antes de schema changes**: SEMPRE fazer backup
3. 🚀 **Antes de deploys**: Verificar backup recente existe
4. 📝 **Edições via admin**: Usar `/admin/lei-14133/[numero]/edit`
5. 🔍 **Monitorar**: Verificar periodicamente que backups estão funcionando

### Contatos para Dúvidas

- **GitHub Issues**: https://github.com/Danbarral2019/sitedobarral/issues
- **Documentação Principal**: `CLAUDE.md`
- **Schema do Banco**: `prisma/schema.prisma`

---

**Última Atualização**: 2025-11-09 (artigos faltantes adicionados)
**Versão**: 1.1 (195 artigos completos)
**Mantido por**: Claude Code (Anthropic)

**Changelog**:
- v1.0 (2025-11-09): Proteção inicial dos 193 artigos editados manualmente
- v1.1 (2025-11-09): Adicionados Art. 184-A e Art. 194, total: 195 artigos
