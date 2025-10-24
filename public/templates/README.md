# Templates para Blog - Prof. Daniel Barral

## 📄 Template Word (.docx)

**Arquivo:** `template-artigo-blog.docx`

### ✨ Características do Template

O template Word possui **estilos pré-configurados** de acordo com o padrão acadêmico do site:

#### Estilos Disponíveis:

1. **Título 1** (Heading 1) - Seções principais
   - Fonte: Times New Roman, 14pt, Negrito
   - Cor: Cinza escuro (#1F2937)
   - Espaçamento: 400 antes, 200 depois
   - Atalho: `Ctrl+Alt+1`

2. **Título 2** (Heading 2) - Subseções
   - Fonte: Times New Roman, 13pt, Negrito
   - Cor: Cinza médio (#374151)
   - Espaçamento: 300 antes, 150 depois
   - Atalho: `Ctrl+Alt+2`

3. **Título 3** (Heading 3) - Sub-subseções
   - Fonte: Times New Roman, 12pt, Negrito
   - Cor: Cinza (#4B5563)
   - Espaçamento: 200 antes, 100 depois
   - Atalho: `Ctrl+Alt+3`

4. **Normal** - Corpo do texto
   - Fonte: Times New Roman, 12pt
   - Alinhamento: Justificado
   - Espaçamento entre linhas: 1.5
   - Margens: 1 polegada (2,54 cm) em todos os lados

#### Formatação Especial:

- **Notas de Rodapé:** Fonte 11pt com numeração sobrescrita (¹ ² ³)
- **Referências Bibliográficas:** Recuo francês (primeira linha sem recuo, demais com 2cm de recuo)
- **Citações:** Use estilo "Citação" do Word para blocos destacados

### 📋 Como Usar o Template

#### Passo 1: Baixar
1. Acesse `/admin/blog/upload-word`
2. Clique em "Baixar Template"
3. Salve o arquivo `template-artigo-blog.docx`

#### Passo 2: Preencher Metadados
No início do documento, preencha os campos:
- **Título:** Título completo do seu artigo
- **Autor:** Geralmente "Prof. Daniel Barral"
- **Data:** Data atual no formato DD/MM/AAAA
- **Tags:** Escolha 3-7 tags da lista fornecida (separadas por vírgula)
- **Resumo:** Breve resumo em 1-2 frases

#### Passo 3: Escrever o Conteúdo
- Utilize os **estilos predefinidos** (Título 1, Título 2, Título 3)
- Não formate manualmente (não mude fonte, tamanho, etc.)
- Use os atalhos de teclado para aplicar estilos rapidamente

#### Passo 4: Adicionar Notas de Rodapé
- No texto: use caracteres sobrescritos (¹, ² ³) ou [1] [2] [3]
- Na seção "Notas de Rodapé": liste todas em ordem
- Formato: `¹ Texto da nota de rodapé...`

#### Passo 5: Adicionar Referências
- Na seção "Referências Bibliográficas"
- Siga o formato ABNT
- Liste em ordem alfabética por sobrenome
- Use o recuo francês (já configurado no template)

#### Passo 6: Upload no Sistema
1. Salve o documento (.docx)
2. Acesse `/admin/blog/upload-word`
3. Faça upload do arquivo
4. Revise o preview gerado
5. Salve como rascunho ou publique

### 🎨 Vantagens de Usar o Template Word

✅ **Estilos Pré-configurados:** Não precisa formatar manualmente
✅ **Consistência:** Todos os artigos seguem o mesmo padrão visual
✅ **Conversão Automática:** Mammoth.js converte para Markdown preservando a formatação
✅ **Facilidade:** Use atalhos de teclado (Ctrl+Alt+1, Ctrl+Alt+2, etc.)
✅ **Profissional:** Formatação acadêmica padrão ABNT
✅ **Compatibilidade:** Funciona no Microsoft Word e LibreOffice Writer

### 📚 Tags Disponíveis

**Gerais:**
- Direito Administrativo
- Direito Público
- Licitações
- Gestão Pública
- Administração Pública

**Legislação:**
- Lei 14.133/2021
- Nova Lei de Licitações
- Contratações Públicas
- Contratos Administrativos

**Temas Específicos:**
- Planejamento de Contratações
- Diálogo Competitivo
- Contratação Direta
- Matriz de Riscos
- ETP
- PNCP
- Sanções Administrativas
- Processo Licitatório
- Gestão de Contratos
- Fiscalização Contratual
- Inovação em Contratações
- Terceirização Pública

### 🔧 Regenerar o Template

Se você precisar regenerar o template Word:

```bash
cd "projeto do site no claude/site-prof-barral"
node scripts/generate-word-template.js
```

O arquivo será gerado em: `public/templates/template-artigo-blog.docx`

### 📖 Instruções Detalhadas

Para instruções completas de formatação ABNT e exemplos, consulte:
- `INSTRUCOES_TEMPLATE.md` - Guia completo de uso do template

---

**Data de criação:** 24 de janeiro de 2025
**Versão:** 2.0 (Template Word com estilos configurados)
