# 📊 Guia Completo: Importação de Excel do TCU

## 🎯 Objetivo

Converter a planilha oficial do TCU (com colunas específicas do tribunal) para o formato do sistema, pronto para importar em `/admin/importar`.

---

## 📋 Passo a Passo

### **Passo 1: Obter a Planilha do TCU**

1. **Baixe a planilha** oficial do TCU
   - Geralmente vem com nome tipo: `TCU_Acordaos.xlsx`, `Jurisprudencia_TCU.xlsx`, etc.

2. **Verifique as colunas** esperadas:
   - ✅ `Enunciado` - Texto da tese/decisão
   - ✅ `Area` - Área de atuação (ex: Licitações, Contratos)
   - ✅ `Tema` - Tema específico
   - ✅ `Subtema` - Subtema (opcional)
   - ✅ `Data` - Data do acórdão (DD/MM/YYYY)
   - ✅ `Acordao` ou `Acórdão` - Número do acórdão (ex: "1234/2024")
   - ✅ `Autor da tese` - Ministro relator
   - ✅ `Legislacao` ou `Legislação` - Leis citadas
   - ✅ `Outros indexadores` - Tags adicionais
   - ✅ `Tipo do processo` - Tipo processual

**Importante:** O script aceita variações nos nomes das colunas (com/sem acento, maiúscula/minúscula).

---

### **Passo 2: Converter a Planilha**

#### Via NPM Script (Recomendado)
```bash
npm run convert-tcu caminho/para/TCU_Acordaos.xlsx
```

#### Via Node Diretamente
```bash
node scripts/convert-tcu-excel.js caminho/para/TCU_Acordaos.xlsx
```

#### Com Nome de Saída Personalizado
```bash
npm run convert-tcu caminho/para/TCU_Acordaos.xlsx --output=minhas_conversoes.xlsx
```

---

### **Passo 3: Entender o Arquivo de Saída**

O script gera um **novo arquivo Excel** com **3 abas**:

#### **Aba 1: "Instruções"**
- Contém orientações sobre como usar o arquivo
- Explica cada coluna
- Lista os próximos passos

#### **Aba 2: "Dados"** ⭐ (PRINCIPAL)
Colunas geradas automaticamente:

| Coluna | Descrição | Exemplo |
|--------|-----------|---------|
| `Titulo` | Número do acórdão | "Acórdão 1234/2024" |
| `Descricao` | Enunciado da tese + tipo do processo | "TOMADA DE CONTAS ESPECIAL..." |
| `Categoria` | Sempre "acordao" | "acordao" |
| `Curso` | Cursos identificados (separados por vírgula) | "nova-lei-licitacoes,processo-sancionador" |
| `Tags` | Tags geradas dos metadados | "TCU, Acórdão, Licitações, Lei 14.133/2021" |
| `Publico` | Sempre "SIM" (acórdãos são públicos) | "SIM" |
| `URL` | Link para o acórdão no site do TCU | "https://pesquisa.apps.tcu.gov.br/..." |
| `Arquivo` | Vazio (acórdãos são links, não PDFs) | "" |

**Metadados adicionais** (colunas com prefixo `_`):
- `_Area`, `_Tema`, `_Subtema`, `_Data`, `_AutorTese`
- Servem apenas para **referência**, **não são importados**

#### **Aba 3: "Estatísticas"**
- Total de acórdãos convertidos
- Quantos têm URL gerada
- Distribuição por curso (quantos acórdãos para cada curso)

---

### **Passo 4: Revisar e Ajustar (Opcional)**

Antes de importar, você pode:

1. **Abrir a aba "Dados"** no Excel/LibreOffice
2. **Revisar os cursos sugeridos:**
   - Se um acórdão foi associado ao curso errado, edite a coluna `Curso`
   - Pode adicionar mais cursos (separados por vírgula)
3. **Ajustar tags:**
   - Adicionar ou remover tags conforme necessário
4. **Verificar URLs:**
   - Se um acórdão ficou sem URL, você pode adicionar manualmente

---

### **Passo 5: Importar no Sistema**

1. **Acesse o painel admin:**
   ```
   http://localhost:3000/admin/importar
   ```

2. **Faça upload do arquivo convertido:**
   - Clique em "Escolher Arquivo"
   - Selecione o arquivo `*_Convertido_*.xlsx`
   - Clique em "Validar Excel"

3. **Revise a validação:**
   - Sistema mostra quantos documentos serão importados
   - Mostra erros (se houver)

4. **Confirme a importação:**
   - Clique em "Importar Documentos"
   - Aguarde conclusão (pode demorar alguns segundos)

5. **Verifique os documentos:**
   - Vá em `/admin/documentos`
   - Filtre por categoria "Acórdão"
   - Confira se todos foram importados

---

## 🤖 Como Funciona o Mapeamento Inteligente

### Identificação Automática de Cursos

O script usa **palavras-chave** para identificar quais cursos são relevantes para cada acórdão:

```javascript
// Exemplo de mapeamento
'licitacao|licitacoes|pregao|edital' → nova-lei-licitacoes
'planejamento|etp|termo de referencia' → planejamento-contratacoes
'sancao|penalidade|multa' → processo-sancionador
```

**Como funciona:**
1. Script pega: `Enunciado` + `Area` + `Tema` + `Subtema`
2. Remove acentos e converte para minúsculas
3. Procura por palavras-chave
4. Associa aos cursos correspondentes
5. Se não encontrar nenhum, usa `nova-lei-licitacoes` como padrão

**Resultado:** Um acórdão pode ser associado a **múltiplos cursos** automaticamente!

---

### Geração Automática de Tags

Tags são geradas a partir de:
- ✅ "TCU" e "Acordão" (sempre)
- ✅ Área, Tema, Subtema
- ✅ Autor da tese (ministro relator)
- ✅ Legislação citada (ex: "Lei 14.133/2021")
- ✅ Outros indexadores do TCU

**Máximo:** 15 tags por documento

---

### Construção de URLs

O script gera automaticamente a URL do acórdão no site oficial do TCU:

**Formato esperado do acórdão:**
- "1234/2024"
- "Acórdão 1234/2024"

**URL gerada:**
```
https://pesquisa.apps.tcu.gov.br/#/documento/acordao-completo/*/NUMACORDAO%253A1234%2520ANOACORDAO%253A2024
```

Se o número do acórdão não estiver no formato correto, a URL fica vazia.

---

## 📊 Exemplo Completo

### **Entrada (Excel do TCU):**

| Enunciado | Area | Tema | Acordao | Data | Legislacao |
|-----------|------|------|---------|------|------------|
| "Tomada de contas especial. Não comprovação de gastos públicos." | Contratos | Fiscalização | 1234/2024 | 15/01/2024 | Lei 14.133/2021 |

### **Saída (Excel Convertido):**

| Titulo | Descricao | Categoria | Curso | Tags | URL |
|--------|-----------|-----------|-------|------|-----|
| Acórdão 1234/2024 | Tomada de contas especial. Não comprovação de gastos públicos.\n\nTipo: TCE | acordao | gestao-fiscalizacao-contratos | TCU, Acórdão, Contratos, Fiscalização, Lei 14.133/2021 | https://pesquisa.apps.tcu.gov.br/... |

---

## 🎯 Cursos Disponíveis

O sistema mapeia automaticamente para os seguintes cursos:

| Slug | Nome |
|------|------|
| `nova-lei-licitacoes` | Nova Lei de Licitações |
| `planejamento-contratacoes` | Planejamento das Contratações |
| `gestao-fiscalizacao-contratos` | Gestão e Fiscalização de Contratos |
| `processo-sancionador` | Processo Sancionador |
| `inovacao-contratacoes` | Inovação nas Contratações |
| `terceirizacao-formacao-precos` | Terceirização e Formação de Preços |
| `assessoramento-juridico` | Assessoramento Jurídico |
| `revisao-reajuste-repactuacao` | Revisão, Reajuste e Repactuação |
| `alteracoes-contratuais` | Alterações Contratuais |
| `contratacao-direta` | Contratação Direta |

---

## 🛠️ Troubleshooting

### Erro: "Arquivo não encontrado"
- ✅ Verifique o caminho do arquivo
- ✅ Use aspas se o caminho tiver espaços: `"C:/Meus Documentos/TCU.xlsx"`

### Erro: "Nenhum dado encontrado"
- ✅ Verifique se a planilha tem dados
- ✅ Confirme que não está vazia
- ✅ Tente abrir no Excel para verificar

### Aviso: "Colunas esperadas não encontradas"
- ⚠️ O script continua mesmo assim
- ⚠️ Mas o resultado pode não ser ideal
- ✅ Verifique se as colunas têm os nomes corretos

### Muitos acórdãos sem URL
- ⚠️ Significa que o formato da coluna "Acordao" não é padrão
- ✅ Formato esperado: "1234/2024" ou "Acórdão 1234/2024"
- ✅ Você pode adicionar URLs manualmente no Excel antes de importar

### Cursos errados atribuídos
- ✅ Normal - o mapeamento é inteligente mas não perfeito
- ✅ Revise na aba "Dados" e ajuste manualmente
- ✅ Ou ajuste depois da importação em `/admin/documentos`

---

## 💡 Dicas Avançadas

### Importar Múltiplas Planilhas
Se você tem várias planilhas do TCU:

```bash
# Converter todas
npm run convert-tcu TCU_2024.xlsx --output=TCU_2024_convertido.xlsx
npm run convert-tcu TCU_2023.xlsx --output=TCU_2023_convertido.xlsx
npm run convert-tcu TCU_2022.xlsx --output=TCU_2022_convertido.xlsx

# Depois importar uma por uma no admin
```

### Combinar com Outros Documentos
O arquivo convertido pode ser editado para incluir outros tipos de documentos:

1. Abra a aba "Dados"
2. Adicione linhas manualmente
3. Preencha as colunas: Titulo, Descricao, Categoria, Curso, etc.
4. Importe normalmente

### Usar como Template
Você pode salvar o arquivo convertido como template:

1. Delete as linhas de dados (mantém cabeçalhos)
2. Salve como `Template_Importacao.xlsx`
3. Use para criar novas importações manuais

---

## 📚 Comandos Rápidos

```bash
# Converter com nome automático (recomendado)
npm run convert-tcu TCU_Acordaos.xlsx

# Converter com nome personalizado
npm run convert-tcu TCU_Acordaos.xlsx --output=meus_acordaos.xlsx

# Converter de outra pasta
npm run convert-tcu "C:/Downloads/TCU_Acordaos.xlsx"

# Ver ajuda
node scripts/convert-tcu-excel.js
```

---

## 🎓 Fluxo Completo Resumido

```
1. Baixar Excel do TCU
   ↓
2. Executar: npm run convert-tcu arquivo.xlsx
   ↓
3. Revisar aba "Dados" (opcional)
   ↓
4. Acessar: /admin/importar
   ↓
5. Upload do arquivo convertido
   ↓
6. Validar e importar
   ↓
7. Conferir em /admin/documentos
```

---

## 📞 Suporte

Dúvidas ou problemas?
- 📖 Veja também: `IMPORTACAO_EXCEL.md` (importação geral)
- 📖 Documentação da Fase 3: `SESSAO_2025-01-26_FASE_3_TCU_SCRAPER.md`

---

**Última atualização:** 27/01/2025
**Versão do Script:** 1.0.0
**Localização:** `scripts/convert-tcu-excel.js`
