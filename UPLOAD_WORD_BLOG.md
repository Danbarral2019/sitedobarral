# Upload de Artigos em Word para o Blog

**Data de Implementação:** 24/01/2025

## Visão Geral

Sistema completo para upload de artigos em formato Word (.doc/.docx) para o blog, com processamento automático de metadados, notas de rodapé acadêmicas e referências bibliográficas em formato ABNT.

## Motivação

Facilitar o workflow de publicação de artigos acadêmicos, permitindo que você:
- Escreva artigos no Word (ferramenta familiar)
- Use formatação acadêmica tradicional (notas de rodapé, referências ABNT)
- Faça upload direto para o blog
- Revise antes de publicar

## Funcionalidades Implementadas

### 1. Upload com Drag-and-Drop

✅ Componente `WordUploader`:
- Arraste e solte arquivos .doc ou .docx
- Ou selecione pelo navegador de arquivos
- Validação automática de tipo e tamanho (máx 10MB)
- Feedback visual durante upload e processamento
- Barra de progresso e mensagens de status

### 2. Processamento Automático

✅ Extração de metadados:
- **Título** do artigo
- **Autor** (padrão: Prof. Daniel Barral)
- **Data** de publicação
- **Tags** selecionadas de lista pré-definida
- **Resumo** (excerpt) do artigo

✅ Processamento de conteúdo:
- Conversão de Word para Markdown
- Preservação de formatação:
  - Negrito, itálico, sublinhado
  - Títulos (H1, H2, H3)
  - Listas numeradas e com marcadores
  - Citações (blockquotes)
  - Tabelas
  - Links

✅ Notas de Rodapé:
- Detecção automática de números sobrescritos (¹ ² ³)
- Detecção de [1], [2], [3]
- Separação automática em seção "Notas de Rodapé"
- Links clicáveis entre texto e notas

✅ Referências Bibliográficas:
- Extração automática da seção "Referências Bibliográficas"
- Formatação ABNT preservada
- Renderização com recuo francês

✅ Imagens (suporte futuro):
- Estrutura preparada para extrair imagens do Word
- Armazenamento automático em `/public/uploads`

### 3. Preview Antes de Salvar

✅ Modo Dual (Edição/Preview):
- **Modo Edição**: Todos os campos editáveis (título, tags, conteúdo, notas, referências)
- **Modo Preview**: Visualização exatamente como ficará no blog
- Alternância com um clique

✅ Validação:
- Campos obrigatórios: título e conteúdo
- Geração automática de slug a partir do título
- Salva como rascunho por padrão
- Redirecionamento para edição após salvar

### 4. Renderização no Blog

✅ Estilos Acadêmicos Profissionais:
- Notas de rodapé tradicionais (números sobrescritos azuis)
- Seção de notas separada por linha dupla
- Referências com recuo francês ABNT
- Destaque para citações de leis e decretos
- Tipografia otimizada para leitura acadêmica

## Estrutura do Template

### Formato do Arquivo Word

O arquivo Word deve seguir esta estrutura EXATAMENTE:

```
Título: [Seu título aqui]
Autor: Prof. Daniel Barral
Data: DD/MM/AAAA
Tags: [Tags separadas por vírgula]
Resumo: [Resumo breve do artigo]

[LINHA EM BRANCO]

[CONTEÚDO DO ARTIGO]

...texto com notas de rodapé¹...

---

Notas de Rodapé

¹ Primeira nota aqui
² Segunda nota aqui

---

Referências Bibliográficas

SOBRENOME, Nome. Título. Edição. Cidade: Editora, ano.
```

### Tags Pré-Definidas (20 opções)

#### Direito Administrativo Geral:
- Direito Administrativo
- Direito Público
- Administração Pública
- Gestão Pública
- Licitações

#### Legislação:
- Lei 14.133/2021
- Nova Lei de Licitações
- Lei 8.666/93
- Legislação de Licitações
- Marco Legal

#### Processos:
- Processo Licitatório
- Contratações Públicas
- Contratos Administrativos
- Gestão de Contratos
- Fiscalização Contratual

#### Temas Específicos:
- Planejamento de Contratações
- Diálogo Competitivo
- Contratação Direta
- Matriz de Riscos
- ETP (Estudo Técnico Preliminar)

## Workflow Completo

### Passo 1: Preparar Artigo no Word

1. Abra o template (`template-artigo-blog.txt`)
2. Preencha todos os campos obrigatórios:
   - Título
   - Autor
   - Data
   - Tags (selecione da lista)
   - Resumo
3. Escreva o conteúdo do artigo
4. Adicione notas de rodapé usando ¹ ² ³ ou [1] [2] [3]
5. Liste as notas na seção "Notas de Rodapé"
6. Liste as referências na seção "Referências Bibliográficas" (formato ABNT)
7. Salve como .docx

### Passo 2: Upload no Sistema

1. Acesse `/admin/blog`
2. Clique em **"Upload Word"** (botão azul)
3. Arraste seu arquivo .docx ou clique para selecionar
4. Aguarde o processamento (geralmente < 5 segundos)

### Passo 3: Revisar e Editar

1. Sistema exibe todos os dados extraídos
2. **Modo Edição**: Corrija qualquer campo se necessário
3. **Modo Preview**: Veja como ficará no blog
4. Verifique especialmente:
   - Tags estão corretas
   - Notas de rodapé numeradas corretamente
   - Referências no formato ABNT
   - Formatação preservada

### Passo 4: Salvar

1. Clique em **"Salvar como Rascunho"**
2. Sistema salva e redireciona para edição
3. Você pode publicar imediatamente ou deixar como rascunho

### Passo 5: Publicar (Opcional)

1. Na tela de edição, marque "Publicado"
2. Clique em "Salvar"
3. Artigo fica disponível em `/blog/[slug]`

## Arquivos Implementados

### Componentes

**`components/WordUploader.tsx`**
- Componente de upload com drag-and-drop
- Validação de arquivos
- Upload para API
- Feedback visual de progresso

### Páginas

**`app/admin/blog/upload-word/page.tsx`**
- Página principal de upload
- Preview e edição
- Salvamento como rascunho
- Integração com API

### API Routes

**`app/api/admin/blog-posts/upload-word/route.ts`**
- Processamento do arquivo Word
- Extração de metadados
- Conversão para Markdown
- Separação de notas e referências

**`app/api/admin/blog-posts/download-template/route.ts`**
- Download do template em texto
- (Futuramente: template .docx)

### Estilos e Renderização

**`components/MarkdownContent.tsx`** (melhorado)
- Estilos acadêmicos profissionais
- Notas de rodapé clicáveis
- Referências com recuo francês ABNT
- Separadores visuais entre seções
- Destaque para citações legais

### Templates

**`public/templates/template-artigo-blog.txt`**
- Template prático para copiar para o Word
- Estrutura completa
- Exemplos de formatação
- 20 tags pré-definidas

**`public/templates/INSTRUCOES_TEMPLATE.md`**
- Documentação completa do template
- Guia de formatação
- Exemplos de referências ABNT
- Checklist antes de enviar

## Tecnologias Utilizadas

- **mammoth.js**: Conversão de Word para Markdown
- **react-markdown**: Renderização de Markdown
- **remark-gfm**: Suporte a GitHub Flavored Markdown
- **Next.js 15**: Framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Estilos

## Exemplos de Uso

### Nota de Rodapé no Word

```
Conforme estabelecido pela Lei 14.133/2021¹, as contratações devem...

---
Notas de Rodapé

¹ BRASIL. Lei nº 14.133, de 1º de abril de 2021...
```

**Resultado no Blog:**
"Conforme estabelecido pela Lei 14.133/2021<sup><a href="#fn1">1</a></sup>..."

### Referência ABNT no Word

```
Referências Bibliográficas

DI PIETRO, Maria Sylvia Zanella. Direito Administrativo. 34. ed. São Paulo: Atlas, 2021.
```

**Resultado no Blog:**
Renderizado com recuo francês e formatação adequada.

## Boas Práticas

### ✅ Faça

- Use o template fornecido como base
- Selecione tags da lista pré-definida
- Numere notas de rodapé sequencialmente
- Use formato ABNT para referências
- Revise no preview antes de salvar
- Mantenha imagens abaixo de 2MB cada

### ❌ Evite

- Inventar tags novas (use as pré-definidas)
- Pular numeração de notas (1, 2, 4...)
- Usar formatação muito complexa
- Arquivos maiores que 10MB
- Copiar/colar de PDFs (pode quebrar formatação)

## Limitações Conhecidas

1. **Imagens**: Extração de imagens ainda não implementada (estrutura preparada)
2. **Tabelas complexas**: Tabelas muito elaboradas podem perder formatação
3. **Fontes especiais**: Apenas formatação básica é preservada
4. **Equações matemáticas**: Não suportado (use imagens)
5. **Comentários e revisões**: Não são extraídos

## Melhorias Futuras

### Curto Prazo
- [ ] Extração e upload automático de imagens
- [ ] Suporte a arquivos .doc (além de .docx)
- [ ] Auto-complete de tags
- [ ] Preview lado a lado (edição/preview simultâneos)

### Médio Prazo
- [ ] Template .docx oficial para download
- [ ] Detecção automática de citações para gerar referências
- [ ] Importação de bibliografia de Zotero/Mendeley
- [ ] Versionamento de artigos

### Longo Prazo
- [ ] IA para sugerir tags automaticamente
- [ ] Correção ortográfica integrada
- [ ] Plagio detection
- [ ] Exportar artigo publicado de volta para Word

## Suporte

### Problemas Comuns

**P: Upload falha com "Arquivo inválido"**
R: Certifique-se que o arquivo é .doc ou .docx e não está corrompido.

**P: Notas de rodapé não aparecem**
R: Verifique se usou números sobrescritos (¹) ou [1] e se tem a seção "Notas de Rodapé".

**P: Formatação está quebrada**
R: Use apenas formatação básica do Word (negrito, itálico, listas, títulos).

**P: Tags não aparecem**
R: Tags devem estar separadas por vírgula no campo "Tags:" do início do documento.

**P: Referências não têm recuo francês**
R: Certifique-se que a seção se chama exatamente "Referências Bibliográficas" ou "Referências".

### Onde Buscar Ajuda

1. Consulte `INSTRUCOES_TEMPLATE.md`
2. Veja exemplos no template
3. Teste com arquivo pequeno primeiro
4. Verifique console do navegador (F12) para erros
5. Entre em contato com suporte técnico

## Changelog

### v1.0 - 24/01/2025
- ✨ Upload com drag-and-drop
- ✨ Processamento automático de Word
- ✨ Extração de metadados
- ✨ Notas de rodapé acadêmicas
- ✨ Referências ABNT
- ✨ Preview antes de salvar
- ✨ Template com 20 tags
- ✨ Renderização melhorada no blog

---

**Implementado por:** Claude Code
**Data:** 24 de janeiro de 2025
**Versão:** 1.0
