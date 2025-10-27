# 📚 Guia de Importação de Acórdãos do TCU

## Problema Identificado

O arquivo `pesquisaExportada (4).xls` exportado do site do TCU está em formato **XLS antigo (CFB/BIFF8)**, que não é totalmente compatível com as bibliotecas JavaScript modernas.

## Solução em 3 Etapas

### Etapa 1: Converter XLS para XLSX

Escolha uma das opções abaixo:

#### Opção A: Excel/LibreOffice (Recomendado)

1. Abra o arquivo `pesquisaExportada (4).xls` no **Excel** ou **LibreOffice Calc**
2. Clique em **Arquivo > Salvar Como**
3. Escolha o formato: **Excel 2007-365 (.xlsx)**
4. Salve com o nome: `pesquisaExportada.xlsx`

#### Opção B: Python (Automático)

Se você tem Python instalado:

```bash
# Instalar dependências
pip install pandas xlrd openpyxl

# Converter arquivo
cd "C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral"
python scripts/convert-xls.py "C:\Users\Administrador\Downloads\pesquisaExportada (4).xls"
```

#### Opção C: Conversor Online

1. Acesse: https://cloudconvert.com/xls-to-xlsx
2. Faça upload do arquivo `.xls`
3. Baixe o arquivo `.xlsx` convertido

---

### Etapa 2: Usar o Conversor TCU do Sistema

Uma vez que você tenha o arquivo `.xlsx`:

1. **Acesse:** http://localhost:3000/admin/tcu-converter
2. **Upload:** Selecione o arquivo `pesquisaExportada.xlsx`
3. **Converta:** O sistema irá:
   - Ler as colunas do TCU: Enunciado, Acórdão, Área, Tema, Subtema, Data, Autor da tese, Legislação, Outros indexadores
   - Mapear automaticamente para os cursos relevantes
   - Gerar tags a partir dos metadados
   - Construir URLs dos acórdãos
   - Criar arquivo Excel pronto para importação
4. **Baixe:** O arquivo convertido `TCU_Convertido_YYYY-MM-DD.xlsx`

---

### Etapa 3: Importar no Sistema

1. **Acesse:** http://localhost:3000/admin/importar
2. **Upload:** Selecione o arquivo `TCU_Convertido_YYYY-MM-DD.xlsx`
3. **Revise:** Visualize a pré-visualização dos dados
4. **Importe:** Confirme a importação

---

## Estrutura do Arquivo TCU Original

**Colunas esperadas do TCU:**

| Coluna | Descrição | Exemplo |
|---|---|---|
| Enunciado | Texto da tese/enunciado | "Não há óbice à contratação..." |
| Acórdão | Número do acórdão | "1234/2023-Plenário" |
| Área | Área temática | "Licitações e Contratos" |
| Tema | Tema específico | "Dispensa de licitação" |
| Subtema | Subtema | "Emergência" |
| Data | Data da sessão | "20/05/2023" |
| Autor da tese | Ministro relator | "Ministro Fulano" |
| Legislação | Leis citadas | "Lei 14.133/2021, art. 75" |
| Outros indexadores | Keywords adicionais | "COVID-19, calamidade pública" |

---

## Mapeamento Automático

O conversor TCU identifica automaticamente os cursos relevantes baseado em palavras-chave:

| Keywords | Curso |
|---|---|
| licitação, pregão, edital | Nova Lei de Licitações |
| planejamento, ETP, termo de referência | Planejamento das Contratações |
| fiscalização, gestão contratual | Gestão e Fiscalização de Contratos |
| sanção, penalidade, multa | Processo Sancionador |
| inovação, startup, diálogo competitivo | Inovação nas Contratações |
| terceirização, mão de obra | Terceirização e Formação de Preços |
| parecer jurídico, AGU | Assessoramento Jurídico |
| reajuste, repactuação, revisão | Revisão, Reajuste e Repactuação |
| aditivo, acréscimo, supressão | Alterações Contratuais |
| dispensa, inexigibilidade | Contratação Direta |

---

## Formato Final (Após Conversão)

**Colunas do sistema:**

| Coluna | Valor | Observações |
|---|---|---|
| Titulo | Número do acórdão | Ex: "1234/2023-Plenário" |
| Descricao | Enunciado + Tipo do processo | Texto completo da tese |
| Categoria | `acordao` | Fixo |
| Curso | Cursos identificados | Separados por vírgula |
| Tags | Tags geradas | TCU, Acordão, Área, Tema, Legislação, etc. |
| Publico | `SIM` | Acórdãos são sempre públicos |
| URL | Link para o TCU | `https://pesquisa.apps.tcu.gov.br/...` |
| Arquivo | (vazio) | Sem arquivo anexo |
| _Area | Área original | Metadado |
| _Tema | Tema original | Metadado |
| _Subtema | Subtema original | Metadado |
| _Data | Data formatada | YYYY-MM-DD |
| _AutorTese | Autor da tese | Metadado |

---

## Troubleshooting

### Erro: "Nenhum dado encontrado na planilha"

**Causa:** Arquivo vazio ou formato incorreto

**Solução:**
1. Verifique se o arquivo tem dados (não está vazio)
2. Certifique-se de que é um arquivo Excel válido (.xlsx)
3. Tente abrir no Excel e salvar novamente

### Erro: "Erro ao ler arquivo"

**Causa:** Formato .xls antigo (CFB)

**Solução:**
1. Converta para .xlsx usando Excel/LibreOffice (Etapa 1)
2. Ou use o script Python fornecido

### Importação resulta em apenas 1 linha

**Causa:** Planilha com apenas cabeçalhos, sem dados

**Solução:**
1. Verifique se o arquivo original do TCU tem dados
2. Confirme que a aba "Dados" do arquivo convertido tem conteúdo
3. Se necessário, exporte novamente do site do TCU

### Cursos não identificados corretamente

**Causa:** Keywords não encontradas no texto

**Solução:**
1. Após importar, edite os documentos manualmente em `/admin/documentos`
2. Ou ajuste as keywords no arquivo `app/api/admin/convert-tcu/route.ts` (linhas 6-17)

---

## Melhorias Implementadas

✅ **Tratamento de erros melhorado:** Mensagem clara quando arquivo .xls não pode ser lido

✅ **Guia completo:** Este documento com todas as etapas

✅ **Script Python:** Conversão automática .xls → .xlsx

✅ **Conversor TCU robusto:** Mapeia automaticamente cursos e gera tags

---

## Próximos Passos Recomendados

1. **Converter seu arquivo atual** seguindo a Etapa 1
2. **Testar o conversor TCU** com o arquivo convertido
3. **Importar os acórdãos** no sistema
4. **Revisar e ajustar** os cursos/tags conforme necessário

---

## Contato para Suporte

Se tiver problemas, compartilhe:
- Screenshot do erro
- Primeiras linhas do arquivo Excel (sem dados sensíveis)
- Mensagem de erro completa do console

---

**Última atualização:** 2025-10-27
