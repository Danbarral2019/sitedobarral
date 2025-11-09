# Lei 14.133/2021 - Fluxo de Edição Manual

## ⚠️ IMPORTANTE: Mudança de Fluxo (Novembro/2025)

### Antes (OBSOLETO):
- ❌ Artigos armazenados no arquivo `data/lei-14133-artigos.ts`
- ❌ Edições feitas no arquivo TypeScript
- ❌ Script `migrate-lei-14133-to-db.ts` migrava arquivo → banco

### Agora (ATUAL):
- ✅ Artigos armazenados no **banco de dados PostgreSQL** (tabela `LeiArticle`)
- ✅ Edições feitas via **interface admin web** (`/admin/lei-14133`)
- ✅ Banco de dados é a **única fonte da verdade**

---

## 📝 Como Editar Artigos da Lei 14.133

### Passo a Passo:

1. **Acesse a interface admin:**
   ```
   https://www.profdanielbarral.com/admin/lei-14133
   ```

2. **Localize o artigo:**
   - Use a busca por número
   - Ou navegue pela lista de artigos truncados

3. **Clique em "Editar":**
   - Abre `/admin/lei-14133/[numero]/edit`
   - Editor com textarea para o texto completo

4. **Cole/edite o texto completo:**
   - Inclua parágrafos, incisos, alíneas
   - Mantenha formatação original da lei

5. **Salve:**
   - Clique em "Salvar Alterações"
   - Artigo é salvo diretamente no PostgreSQL

6. **Verifique:**
   - Artigo atualizado aparece imediatamente no site
   - Mudanças persistem entre deploys

---

## 🚫 Scripts Desativados

### ⚠️ `scripts/migrate-lei-14133-to-db.ts.DISABLED`

**STATUS:** DESATIVADO (renomeado com `.DISABLED`)

**MOTIVO:** Este script **sobrescreve** o banco de dados com dados do arquivo TypeScript, **apagando** todas as edições manuais feitas via admin.

**NÃO EXECUTAR:**
```bash
# ❌ NUNCA FAZER ISSO:
npx tsx scripts/migrate-lei-14133-to-db.ts.DISABLED
```

**Consequências de executar:**
- ❌ Todas as correções manuais são perdidas
- ❌ Artigos voltam para versões truncadas/incompletas
- ❌ Horas de trabalho de edição são apagadas

---

## 📦 Fonte da Verdade

### Banco de Dados PostgreSQL

**Tabela:** `LeiArticle`

**Campos:**
- `numero` (string) - Ex: "1", "184-A"
- `ementa` (text) - Texto completo do artigo
- `titulo` (string, opcional) - Ex: "TÍTULO I - DISPOSIÇÕES PRELIMINARES"
- `capituloCompleto` (string, opcional) - Ex: "CAPÍTULO I - DO ÂMBITO DE APLICAÇÃO"
- `capitulo` (string) - Ex: "TÍTULO I - CAPÍTULO I"
- `secao` (string, opcional) - Ex: "Disposições Preliminares"
- `createdAt` (datetime)
- `updatedAt` (datetime)

### Arquivo TypeScript (LEGADO)

**Arquivo:** `data/lei-14133-artigos.ts`

**STATUS:** Mantido para **compatibilidade de imports**, mas **NÃO é mais editado**.

**Uso atual:**
- ✅ Importado por páginas públicas (fallback se banco não disponível)
- ✅ Usado para referência de estrutura
- ❌ **NÃO é editado manualmente**
- ❌ **NÃO é migrado para banco**

---

## 🔄 Backup e Recuperação

### Como fazer backup dos artigos:

```bash
# Exportar todos artigos do banco para JSON
npx prisma studio
# Ou usar script customizado (criar se necessário)
```

### Como recuperar artigos em caso de perda:

1. **Verificar backups automáticos do Neon (PostgreSQL)**
2. **Restaurar do commit Git anterior** (se houver script de export)
3. **Reeditar manualmente via admin** (última opção)

**⚠️ IMPORTANTE:** Não existe sincronização bidirecional entre arquivo e banco.

---

## 📊 Estatísticas

- **Total de artigos:** 194 (incluindo 184-A)
- **Artigos no banco:** Consultar via `/admin/lei-14133`
- **Artigos truncados:** Identificados automaticamente na interface

---

## 🛠️ Ferramentas Auxiliares

### Script de Verificação de Cobertura:

```bash
npx tsx scripts/verificar-cobertura-artigos.ts
```

**Função:** Verifica se todos os 194 artigos estão classificados nos grupos temáticos.

### Script de Exportação para Excel:

```bash
npx tsx scripts/export-grupos-lei14133.ts
```

**Função:** Gera planilha Excel com grupos temáticos para análise.

---

## 📝 Boas Práticas

### ✅ Fazer:
- Editar artigos via `/admin/lei-14133`
- Revisar mudanças antes de salvar
- Manter formatação original da lei
- Incluir todos parágrafos, incisos e alíneas

### ❌ Evitar:
- Executar scripts de migração desativados
- Editar arquivo `data/lei-14133-artigos.ts` manualmente
- Copiar textos truncados/incompletos
- Salvar sem revisar

---

## 🔧 Manutenção Futura

### Se precisar reativar migração arquivo → banco:

1. **Criar novo script** que:
   - Pergunta confirmação antes de sobrescrever
   - Faz backup do banco antes de migrar
   - Mostra diff das mudanças
   - Permite escolher artigos específicos

2. **Atualizar arquivo TypeScript primeiro:**
   - Corrigir todos artigos truncados
   - Verificar texto completo de cada artigo
   - Testar build antes de migrar

3. **Documentar mudanças:**
   - Adicionar entry no CLAUDE.md
   - Atualizar este arquivo
   - Comunicar equipe

---

## 📞 Contato

Em caso de dúvidas sobre edição de artigos da Lei 14.133:
- Consultar `/admin/lei-14133` para interface atual
- Verificar este documento antes de executar scripts
- Em caso de problemas, verificar logs do PostgreSQL

---

**Última atualização:** Novembro/2025
**Status:** Fluxo de edição manual em produção ✅
