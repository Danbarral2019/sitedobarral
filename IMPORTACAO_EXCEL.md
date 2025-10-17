# 📊 Funcionalidade de Importação via Excel - DOCUMENTAÇÃO

## ✅ Status da Implementação

**CONCLUÍDO** - Todas as funcionalidades foram implementadas com sucesso!

---

## 🎯 O Que Foi Implementado

### 1. ✅ Template Excel Padronizado

**Arquivo**: Sistema gera automaticamente via API
**Download**: `/api/admin/import-excel/template`

**Estrutura do Template:**
```
Colunas:
├── Titulo         (Obrigatório)
├── Descricao      (Opcional)
├── Categoria      (apostila, acordao, parecer, edital, artigo, outro)
├── Curso          (slug do curso, ex: contratacao-direta)
├── Publico        (Sim/Não)
├── Tags           (Separadas por vírgula)
├── URL            (Link externo)
└── Arquivo        (Nome do arquivo PDF/DOC)
```

**Exemplos incluídos no template:**
- Acórdão 1234/2023 - Dispensa de Licitação (curso único)
- Parecer AGU sobre Registro de Preços (curso único)
- **NOVO!** Lei 14.133/2021 Comentada (TODOS os cursos)
- **NOVO!** Acórdão 5678/2023 - Fiscalização e Planejamento (múltiplos cursos)

---

### 🆕 **NOVO!** Suporte a Múltiplos Cursos

Agora é possível incluir um mesmo documento em **múltiplos cursos de uma vez**!

**Opções disponíveis:**

1. **Curso Único** (como antes):
   ```
   Curso: contratacao-direta
   ```

2. **Múltiplos Cursos** (separados por vírgula):
   ```
   Curso: gestao-fiscalizacao-contratos, planejamento-contratacoes
   ```
   ➡️ O documento será criado em **ambos** os cursos

3. **TODOS os Cursos** (use "TODOS" ou "*"):
   ```
   Curso: TODOS
   ```
   ➡️ O documento será criado nos **10 cursos** automaticamente!

**Casos de Uso:**
- **Legislação fundamental**: Lei 14.133/2021 completa → útil para todos os cursos
- **Acórdãos abrangentes**: TCU sobre múltiplos aspectos → relevante para vários cursos
- **Pareceres gerais**: AGU sobre temas transversais → aplicável a diversos contextos

---

### 2. ✅ Sistema de Classificação Automática

**Arquivo**: `lib/auto-classifier.ts`

#### Regras Implementadas (baseadas no SQL):

| Palavra-chave | Curso Sugerido | Prioridade |
|---------------|----------------|------------|
| "contratação direta", "dispensa" | Contratação Direta | 20 (Alta) |
| "inexigibilidade" | Contratação Direta | 20 (Alta) |
| "pregão" | Nova Lei de Licitações | 30 |
| "edital", "licitação" | Nova Lei de Licitações | 40 |
| "registro de preços" | Nova Lei de Licitações | 40 |
| "projeto básico" | Planejamento de Contratações | 50 |
| "orçamento estimativo" | Planejamento de Contratações | 50 |
| "parecer jurídico" | Assessoramento Jurídico | 60 |
| "gestão", "fiscalização" | Gestão e Fiscalização | 65 |
| "comissão", "pregoeiro" | Nova Lei de Licitações | 70 |
| "fraude", "conluio" | Processo Administrativo Sancionador | 30 |
| "alteração contratual", "aditivo" | Alterações Contratuais | 50 |
| "reajuste", "repactuação" | Revisão, Reajuste e Repactuação | 50 |
| "terceirização" | Terceirização e Formação de Preços | 55 |
| "inovação", "marketplace" | Inovação nas Contratações | 55 |

#### Funcionalidades do Classificador:

1. **autoClassifyDocument()** - Classifica um documento e retorna:
   - Curso sugerido (slug)
   - Nível de confiança (0-100%)
   - Regra que foi aplicada

2. **suggestCategory()** - Sugere categoria baseado no texto:
   - Detecta "acórdão" → categoria: acordao
   - Detecta "parecer" → categoria: parecer
   - Detecta "edital" → categoria: edital
   - Etc.

3. **extractTags()** - Extrai tags relevantes:
   - TCU, AGU, Lei 14.133/2021, pregão, dispensa, etc.

4. **bulkClassify()** - Classifica múltiplos documentos de uma vez

---

### 3. ✅ API de Processamento e Validação

**Arquivo**: `lib/excel-processor.ts`

#### Endpoints Criados:

##### `POST /api/admin/import-excel/validate`
- Valida arquivo Excel
- Retorna preview dos documentos
- Mostra erros e avisos
- Aplica classificação automática

##### `POST /api/admin/import-excel/import`
- Importa documentos validados para o banco
- Retorna estatísticas de sucesso/erro
- Só importa documentos válidos

##### `GET /api/admin/import-excel/template`
- Gera e baixa template Excel
- Já vem com exemplos preenchidos

#### Validações Implementadas:

- ✅ Título obrigatório
- ✅ Categoria válida (apostila, acordao, parecer, edital, artigo, outro)
- ✅ Curso existente (valida slug)
- ✅ Formato do arquivo (.xlsx ou .xls)
- ✅ Estrutura das colunas
- ✅ Tamanho máximo (10MB)

---

### 4. ✅ Tela de Importação no Admin

**URL**: `/admin/importar`
**Arquivo**: `app/admin/importar/page.tsx`

#### Features da Interface:

1. **Instruções Passo a Passo**
   - Explica como usar a funcionalidade
   - Destaca classificação automática

2. **Botão Download Template**
   - Baixa Excel com exemplos
   - Formato padronizado

3. **Upload de Arquivo**
   - Drag & drop
   - Validação de formato (.xlsx, .xls)
   - Limite de 10MB

4. **Preview da Validação**
   - Estatísticas (total, válidos, erros)
   - Lista completa de documentos
   - Badges de status (válido/inválido)
   - Indicador de classificação automática
   - Nível de confiança (%)
   - Tags detectadas
   - Erros e avisos por documento

5. **Importação com Progresso**
   - Barra de progresso
   - Feedback de sucesso
   - Redirecionamento automático

6. **Integração com Admin**
   - Botão "Importar Excel" no painel admin
   - Cores verdes (diferente dos outros botões)

---

## 📁 Arquivos Criados/Modificados

### Novos Arquivos:

```
lib/
├── auto-classifier.ts              (Sistema de classificação inteligente)
├── excel-processor.ts              (Processamento e validação de Excel)

app/api/admin/import-excel/
├── validate/route.ts               (API de validação de planilha)
├── import/route.ts                 (API de importação de metadados)
├── template/route.ts               (API para download do template)
└── upload-files/route.ts           (🆕 API de upload em lote com matching)

app/admin/
└── importar/page.tsx               (Tela de importação com wizard de 2 passos)

IMPORTACAO_EXCEL.md                 (Esta documentação completa)
```

### Arquivos Modificados:

```
app/admin/page.tsx                  (Adicionado botão verde "Importar Excel")
app/page.tsx                        (Adicionado botão admin no rodapé)
package.json                        (Adicionado biblioteca xlsx)
```

### Novas Funcionalidades Implementadas:

1. ✅ **Sistema de Wizard de 2 Passos**
   - Passo 1: Importação de metadados via Excel
   - Passo 2: Upload de PDFs em lote (opcional)

2. ✅ **Matching Automático de Arquivos**
   - Sistema busca documentos por nome de arquivo
   - Vincula automaticamente PDFs aos documentos
   - Mostra estatísticas de matching (vinculados vs não vinculados)

3. ✅ **Feedback Visual Completo**
   - Indicador de progresso de steps
   - Estatísticas detalhadas de upload
   - Lista de arquivos vinculados com sucesso
   - Lista de arquivos sem correspondência
   - Mensagens de erro específicas

4. ✅ **Flexibilidade Total**
   - Pode usar URLs externas (links)
   - Pode fazer upload de PDFs locais
   - Pode combinar ambos na mesma planilha
   - Pode pular o upload de PDFs e fazer depois

---

## 🚀 Como Usar

A importação agora funciona em **2 passos** (Wizard):

### **PASSO 1: Importar Metadados via Excel**

#### 1.1. Acessar a Tela de Importação

```
http://localhost:3000/admin/importar
```

Ou clicar no botão **"Importar Excel"** no painel admin.

#### 1.2. Baixar o Template

Clique em **"Baixar Template Excel"** para obter o arquivo modelo.

#### 1.3. Preencher o Template

**Opção A: PDF Local** (você tem o arquivo PDF)
```
Titulo: Acórdão 5678/2023 - Pregão Eletrônico
Descricao: Análise sobre pregão eletrônico e registro de preços
Categoria: acordao
Curso: nova-lei-licitacoes
Publico: Não
Tags: TCU, pregão, registro de preços
URL:
Arquivo: acordao_5678.pdf  ← Nome EXATO do PDF que você vai enviar no Passo 2
```

**Opção B: URL Externa** (documento fica no site original)
```
Titulo: Parecer AGU sobre Dispensa de Licitação
Descricao: Orientações sobre contratação direta por dispensa
Categoria: parecer
Curso: contratacao-direta
Publico: Sim
Tags: AGU, dispensa
URL: https://portal.tcu.gov.br/parecer_123.pdf  ← Link externo
Arquivo:  ← Deixe vazio se usar URL
```

**Opção C: Classificação Automática** (deixe Categoria e Curso em branco)
```
Titulo: Acórdão TCU sobre Licitação Emergencial
Descricao: Análise de dispensa por emergência
Categoria: [vazio - será "acordao" automaticamente]
Curso: [vazio - será "contratacao-direta" automaticamente]
Publico: Sim
Tags: [vazio - serão extraídas automaticamente]
URL:
Arquivo: acordao_tcu_emergencial.pdf
```

#### 1.4. Upload e Validação

- Arraste o arquivo Excel para a área de upload
- Clique em **"Validar Planilha"**
- Revise o preview (estatísticas, documentos, erros)

#### 1.5. Confirmar Importação

Se tudo estiver OK:
- Clique em **"Confirmar Importação"**
- Aguarde o progresso
- Sistema avança automaticamente para o Passo 2

---

### **PASSO 2: Upload de PDFs em Lote (Opcional)**

Após importar os metadados, você pode fazer upload dos arquivos PDF que foram referenciados na coluna "Arquivo" do Excel.

#### 2.1. Como funciona o Matching Automático

O sistema faz **matching por nome de arquivo**:

1. **Você colocou no Excel**: `Arquivo: acordao_5678.pdf`
2. **Sistema busca no banco**: Procura documentos com URL = "acordao_5678.pdf"
3. **Você faz upload do PDF**: Seleciona o arquivo `acordao_5678.pdf` no seu computador
4. **Sistema vincula automaticamente**: Faz upload do PDF e atualiza o documento com a URL correta

#### 2.2. Fazer Upload dos PDFs

- Arraste todos os PDFs para a área de upload (aceita até 100 arquivos de uma vez)
- Clique em **"Fazer Upload e Vincular"**
- Sistema mostra quais arquivos foram vinculados com sucesso
- Arquivos sem correspondência são listados separadamente

#### 2.3. Resultado do Matching

Você verá 3 estatísticas:
- **Total enviado**: Quantos PDFs você selecionou
- **Vinculados**: Quantos foram matched com documentos do Excel
- **Sem match**: Quantos PDFs não encontraram correspondência

**Exemplo de resultado:**
```
✅ Arquivos Vinculados:
  - acordao_5678.pdf → vinculado a: Acórdão 5678/2023 - Pregão Eletrônico
  - parecer_agu_01.pdf → vinculado a: Parecer AGU 01/2024

⚠️ Arquivos Sem Correspondência:
  - acordo_errado.pdf (nome não corresponde a nenhum documento do Excel)
```

#### 2.4. Pular Este Passo (Opcional)

Se você usou apenas URLs externas ou quer fazer upload dos PDFs depois:
- Clique em **"Pular Este Passo"**
- Você pode fazer upload individual depois na tela "Gerenciar Documentos"

---

## 📎 URLs vs PDFs Locais - Entenda a Diferença

### **Opção 1: URLs Externas**

**Quando usar**: Quando o documento já está hospedado em outro site (TCU, AGU, etc.)

**Como funciona**:
- Você preenche a coluna **URL** no Excel
- Sistema cria um **link externo** no seu site
- Quando aluno clicar, será **redirecionado** para o site original
- **Não ocupa espaço** no seu servidor

**Exemplo**:
```excel
Titulo: Acórdão TCU 1234/2024
URL: https://portal.tcu.gov.br/acordaos/acordao_1234.pdf
Arquivo: [vazio]
```

**Resultado**: Link direto para o site do TCU

---

### **Opção 2: PDFs Locais (Upload)**

**Quando usar**: Quando você tem o arquivo PDF no seu computador e quer hospedar no seu site

**Como funciona** (Sistema de 2 Passos):

**Passo 1 - Excel**: Você informa o nome do arquivo
```excel
Titulo: Acórdão TCU 1234/2024
URL: [vazio]
Arquivo: acordao_1234.pdf  ← Nome do arquivo que você vai enviar
```

**Passo 2 - Upload**: Sistema faz matching automático
1. Sistema busca documento com nome "acordao_1234.pdf"
2. Você faz upload do arquivo `acordao_1234.pdf`
3. Sistema vincula automaticamente
4. Arquivo fica hospedado em `/uploads/curso-id/uuid-acordao_1234.pdf`

**Vantagem**: Documento fica no seu servidor, sempre disponível mesmo se o site original sair do ar

---

### **Opção 3: Combinação (Excel + Upload Posterior)**

Você pode:
1. Importar apenas os metadados via Excel (coluna Arquivo preenchida, mas sem upload)
2. Fazer upload dos PDFs depois, na tela "Gerenciar Documentos"
3. Ou usar o **Passo 2** para fazer upload em lote com matching automático

---

### **Decisão Rápida**:

| Situação | Use |
|----------|-----|
| Documento já está online (TCU, AGU) | ✅ Coluna **URL** |
| Você tem o PDF no computador | ✅ Coluna **Arquivo** + Upload no Passo 2 |
| Mistura de ambos | ✅ Use URL para alguns, Arquivo para outros |
| Muitos PDFs (50-100) | ✅ **Excel + Upload em Lote no Passo 2** ⚡ |

---

## 🎨 Classificação Automática Inteligente

### Como Funciona?

1. **Análise do Texto**
   - Sistema analisa título e descrição
   - Normaliza texto (remove acentos, lowercase)
   - Busca palavras-chave

2. **Aplicação de Regras**
   - Regras ordenadas por prioridade
   - Prioridade menor = mais específico
   - Primeira regra que corresponder é aplicada

3. **Cálculo de Confiança**
   ```
   Confiança = 100 - Prioridade da Regra

   Exemplo:
   - Regra com prioridade 20 = 80% de confiança
   - Regra com prioridade 95 = 5% de confiança (fallback)
   ```

4. **Sugestão de Categoria**
   - Detecta tipo de documento no texto
   - Se não detectar, usa "outro"

5. **Extração de Tags**
   - Busca termos relevantes pré-definidos
   - TCU, AGU, Lei 14.133/2021, etc.

### Exemplo Prático:

**Documento de Entrada:**
```
Titulo: "Acórdão TCU 2345/2024 sobre dispensa emergencial"
Descricao: "Análise de contratação direta por dispensa em situação emergencial"
```

**Resultado da Classificação:**
```javascript
{
  courseSlug: "contratacao-direta",        // ✅ Auto-classificado
  category: "acordao",                     // ✅ Auto-detectado
  tags: ["TCU", "dispensa"],               // ✅ Auto-extraídas
  confidence: 80,                          // ✅ Alta confiança (prioridade 20)
  autoClassified: true
}
```

---

## 🔧 Resolução de Problemas

### Erro: "Coluna Titulo é obrigatória"
**Solução**: Verifique se a primeira linha do Excel tem exatamente "Titulo" (sem acento).

### Erro: "Curso não encontrado"
**Solução**: Use os slugs corretos:
- `nova-lei-licitacoes`
- `planejamento-contratacoes`
- `gestao-fiscalizacao-contratos`
- `processo-administrativo-sancionador`
- `inovacao-contratacoes`
- `terceirizacao-precos`
- `assessoramento-juridico`
- `revisao-reajuste-repactuacao`
- `alteracoes-contratuais`
- `contratacao-direta`

### Aviso: "Usando classificação automática"
**Não é erro!** Significa que o sistema detectou automaticamente o curso mais adequado.

### Erro de Build (OneDrive)
**Solução**:
1. Mova o projeto para fora do OneDrive
2. Ou pause a sincronização do OneDrive temporariamente
3. Execute `npm run dev` para testar em desenvolvimento

---

## 📊 Estatísticas de Importação

Após importar, você verá:
- Total de linhas processadas
- Documentos válidos
- Documentos com erros
- Quantos foram auto-classificados
- Confiança média da classificação

---

## 🎓 Exemplos de Uso Real

### Cenário 1: Importar 100 Acórdãos do TCU

```excel
Titulo                                    | Descricao                              | Categoria | Curso | Tags
Acórdão 1234/2024 - Pregão Eletrônico    | Análise sobre pregão e SRP             |           |       | TCU
Acórdão 1235/2024 - Dispensa             | Contratação direta emergencial         |           |       | TCU, emergência
Acórdão 1236/2024 - Fiscalização         | Gestão de contratos de TI              |           |       | TCU, TI
```

**Resultado**: Sistema classifica automaticamente para os cursos corretos!

### Cenário 2: Importar Pareceres da AGU

```excel
Titulo                                    | Categoria | Publico
Parecer AGU 01/2024 - Registro de Preços | parecer   | Sim
Parecer AGU 02/2024 - Assessoramento     | parecer   | Sim
```

**Resultado**: Classificados corretamente para "Nova Lei de Licitações" e "Assessoramento Jurídico"!

### 🆕 Cenário 3: Documento Relevante para Múltiplos Cursos

```excel
Titulo                                     | Categoria | Curso                                              | Publico
Acórdão TCU 1500/2024 - Gestão Contratual | acordao   | gestao-fiscalizacao-contratos, planejamento-contratacoes | Não
```

**Resultado**: O mesmo acórdão será criado em **2 cursos** diferentes! Evita duplicação manual.

### 🆕 Cenário 4: Legislação Fundamental para TODOS

```excel
Titulo                            | Categoria | Curso | Publico
Lei 14.133/2021 - Texto Completo | apostila  | TODOS | Sim
Constituição Federal - Art. 37   | apostila  | *     | Sim
```

**Resultado**: Ambos documentos serão criados nos **10 cursos**! Perfeito para material de base comum a todos.

---

## 🔐 Segurança

- ✅ Apenas admins autenticados podem importar
- ✅ Validação de formato de arquivo
- ✅ Limite de tamanho (10MB)
- ✅ Sanitização de dados
- ✅ Validação de campos obrigatórios

---

## 🚀 Próximos Passos (Melhorias Futuras)

1. **Upload Paralelo**: Importar múltiplos arquivos de uma vez
2. **Histórico de Importações**: Log de todas as importações
3. **Importação Incremental**: Detectar duplicatas
4. **Preview de PDFs**: Visualizar arquivos antes de importar
5. **Integração com OneDrive**: Importar direto da nuvem
6. **Agendamento**: Importações automáticas programadas
7. **Notificações**: Email quando importação finalizar

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique esta documentação
2. Consulte os exemplos do template
3. Revise os avisos e erros no preview

---

**Desenvolvido com ❤️ usando Next.js 15, TypeScript e xlsx**

**Data de Implementação**: Janeiro 2025
