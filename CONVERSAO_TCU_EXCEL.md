# Conversão de Excel do TCU

Conversor automático da planilha oficial do TCU para o formato de importação do sistema.

## 📋 Visão Geral

O TCU disponibiliza planilhas Excel com acórdãos/teses que contêm colunas específicas. Este script converte automaticamente esses arquivos para o formato aceito pelo sistema de importação (`/admin/importar`).

## 🔄 Fluxo de Trabalho

```mermaid
graph LR
    A[Excel do TCU] --> B[Script Conversor]
    B --> C[Excel Convertido]
    C --> D[Importar via /admin/importar]
    D --> E[Documentos no Sistema]
```

## 📥 Colunas do Excel do TCU

O script espera as seguintes colunas (case-insensitive):

| Coluna | Descrição | Obrigatório |
|--------|-----------|-------------|
| **Enunciado** | Texto da tese/enunciado | ✅ Sim |
| **Área** | Área do direito | ✅ Sim |
| **Tema** | Tema específico | Recomendado |
| **Subtema** | Subtema | Opcional |
| **Data** | Data do acórdão | Recomendado |
| **Acórdão** | Número do acórdão (ex: 1234/2024) | ✅ Sim |
| **Autor da tese** | Ministro relator | Opcional |
| **Legislação** | Leis relacionadas | Recomendado |
| **Outros indexadores** | Indexadores adicionais | Opcional |
| **Tipo do processo** | Tipo | Opcional |

## 📤 Colunas Geradas (Sistema)

| Coluna | Fonte | Exemplo |
|--------|-------|---------|
| **Titulo** | Acórdão | "Acórdão 1234/2024" |
| **Descricao** | Enunciado + Tipo | "É vedada a divisão..." |
| **Categoria** | Fixo | "acordao" |
| **Curso** | Mapeamento inteligente | "nova-lei-licitacoes,planejamento-contratacoes" |
| **Tags** | Todos os metadados | "TCU,Licitações,Pregão,Lei 14.133" |
| **Publico** | Fixo | "SIM" |
| **URL** | Construído automaticamente | `https://pesquisa.apps.tcu.gov.br/...` |
| **Arquivo** | Vazio (links) | "" |

### Colunas de Metadados (Referência)

Colunas iniciadas com `_` são preservadas para referência mas **não** são importadas:
- `_Area`, `_Tema`, `_Subtema`
- `_Data`, `_AutorTese`

## 🎯 Mapeamento Inteligente de Cursos

O script identifica automaticamente os cursos relevantes baseado em palavras-chave:

```javascript
// Exemplos de mapeamento:
"licitação" → nova-lei-licitacoes
"planejamento" → planejamento-contratacoes
"gestão contratual" → gestao-fiscalizacao-contratos
"sanção" → processo-sancionador
"dispensa" → contratacao-direta
// ... e mais
```

**Características:**
- ✅ Identifica **múltiplos cursos** por acórdão
- ✅ Usa Área + Tema + Subtema + Enunciado
- ✅ Remove acentos para matching
- ✅ Fallback para "nova-lei-licitacoes" se nenhum match

## 🏷️ Geração de Tags

Tags são geradas automaticamente de:
1. **Fixas:** TCU, Acórdão
2. **Área, Tema, Subtema**
3. **Autor da tese** (Ministro)
4. **Legislação** (todas as leis mencionadas)
5. **Outros indexadores**

Máximo: 15 tags por acórdão

## 🔗 Construção de URLs

URLs são gerados automaticamente no formato do TCU:

```
Formato: https://pesquisa.apps.tcu.gov.br/#/documento/acordao-completo/...
Baseado no número extraído: 1234/2024 → NUMACORDAO:1234 ANOACORDAO:2024
```

## 🚀 Uso

### Comando Básico

```bash
node scripts/convert-tcu-excel.js TCU_Acordaos.xlsx
```

**Resultado:** `TCU_Acordaos_Convertido_2025-01-26.xlsx`

### Com Arquivo de Saída Customizado

```bash
node scripts/convert-tcu-excel.js TCU_Acordaos.xlsx --output=convertido.xlsx
```

### Via NPM Script

```bash
npm run convert-tcu caminho/para/arquivo.xlsx
```

## 📊 Saída do Script

O Excel convertido contém **3 abas**:

### 1️⃣ Aba "Instruções"
- Guia passo-a-passo
- Explicação das colunas
- Próximos passos

### 2️⃣ Aba "Dados"
- Acórdãos convertidos
- Formato pronto para importar
- Metadados de referência (`_Area`, `_Tema`, etc.)

### 3️⃣ Aba "Estatísticas"
- Total de acórdãos
- Acórdãos com/sem URL
- Distribuição por curso

## 📝 Exemplo de Conversão

### Entrada (Excel do TCU):

| Enunciado | Área | Tema | Acórdão | Legislação |
|-----------|------|------|---------|------------|
| É vedada a divisão de objeto com intuito de... | Licitações | Pregão | 1234/2024 | Lei 14.133 art. 28 |

### Saída (Excel Convertido):

| Titulo | Descricao | Categoria | Curso | Tags | Publico | URL |
|--------|-----------|-----------|-------|------|---------|-----|
| Acórdão 1234/2024 | É vedada a divisão... | acordao | nova-lei-licitacoes | TCU,Acórdão,Licitações,Pregão,Lei 14.133 art. 28 | SIM | [link] |

## ✅ Validações

O script automaticamente:
- ✅ Detecta colunas do TCU (case-insensitive)
- ✅ Avisa se colunas esperadas estão faltando
- ✅ Continua mesmo com colunas faltando
- ✅ Gera estatísticas de conversão
- ✅ Limita tags a 15 por acórdão

## 🔧 Personalização

### Adicionar Novo Curso ao Mapeamento

Edite `scripts/convert-tcu-excel.js`:

```javascript
const CURSO_MAPPING = {
  // ... existentes
  'nova palavra-chave|sinonimo': 'slug-do-curso',
};
```

### Ajustar Geração de Tags

Edite a função `gerarTags()`:

```javascript
function gerarTags(...) {
  // Customize a lógica de tags aqui
}
```

### Alterar Formato de URL

Edite a função `construirUrlTCU()`:

```javascript
function construirUrlTCU(acordao) {
  // Customize o formato da URL
}
```

## 🎬 Pós-Conversão

Após converter:

1. **Abra o Excel convertido**
2. **Revise a aba "Dados"**:
   - Verifique se cursos estão corretos
   - Ajuste tags se necessário
   - Corrija URLs se houver problemas
3. **Vá para `/admin/importar`**
4. **Faça upload do Excel convertido**
5. **Siga o fluxo normal de importação**:
   - Validação automática
   - Preview dos dados
   - Confirmação
   - Importação

## ⚠️ Troubleshooting

### "Nenhum dado encontrado na planilha"
- Verifique se o arquivo tem dados
- Certifique-se de que a primeira aba contém os dados

### "Colunas esperadas não encontradas"
- **Não é erro fatal** - o script continua
- Verifique se os nomes das colunas estão corretos
- O script aceita variações (com/sem acento, maiúsculas/minúsculas)

### "Erro ao ler arquivo"
- Certifique-se de que é um arquivo Excel válido (.xlsx)
- Feche o arquivo se estiver aberto no Excel
- Verifique permissões de leitura

### Acordãos sem URL
- Normal se o número do acórdão estiver em formato não padrão
- Adicione URLs manualmente na aba "Dados"
- Ou deixe vazio - sistema aceita documentos sem URL

## 📚 Recursos Relacionados

- **Importação Excel:** `IMPORTACAO_EXCEL.md`
- **Template de Importação:** Baixar em `/admin/importar`
- **Painel Admin:** `/admin/importar`

## 🔄 Workflow Completo

```bash
# 1. Baixar Excel do TCU
# (Fazer manualmente no site do TCU)

# 2. Converter
node scripts/convert-tcu-excel.js TCU_Acordaos_2024.xlsx

# 3. Revisar
# Abrir TCU_Acordaos_2024_Convertido_2025-01-26.xlsx
# Revisar aba "Dados"

# 4. Importar
# Acessar /admin/importar
# Upload do arquivo convertido

# 5. Confirmar
# Preview → Confirmar → Importado!
```

## 💡 Dicas

1. **Mantenha o original:** O script não modifica o arquivo original
2. **Revise antes de importar:** Sempre revise os dados convertidos
3. **Use metadados:** Colunas `_Area`, `_Tema` ajudam na revisão
4. **Estatísticas:** Aba "Estatísticas" mostra distribuição
5. **Múltiplos arquivos:** Rode o script para cada arquivo do TCU

## 📈 Benefícios

- ✅ **Automático:** Converte centenas de acórdãos em segundos
- ✅ **Inteligente:** Identifica cursos automaticamente
- ✅ **Completo:** Preserva todos os metadados
- ✅ **Rastreável:** URLs automáticas para fonte original
- ✅ **Flexível:** Aceita variações nas colunas do TCU
- ✅ **Seguro:** Não modifica arquivo original

## 🆘 Suporte

Em caso de dúvidas:
1. Verifique esta documentação
2. Consulte `IMPORTACAO_EXCEL.md`
3. Execute com `--help` para ajuda rápida
4. Verifique logs de erro detalhados
