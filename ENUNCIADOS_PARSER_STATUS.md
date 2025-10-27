# 📄 Sistema de Extração de Enunciados - Status

## 🎯 Objetivo

Processar PDFs de enunciados (IBDA, INCP, CJF) que contêm **múltiplos enunciados** e importar cada um como **documento separado** no banco de dados.

---

## ✅ Implementado (70%)

### 1. **Parser de PDF (`lib/enunciados-parser.ts`)**

**Funcionalidades:**
- ✅ Extrai text completo do PDF usando `pdf-parse`
- ✅ Identifica enunciados pelo padrão "ENUNCIADO 1", "ENUNCIADO 2", etc.
- ✅ Separa texto de cada enunciado individual
- ✅ Extrai metadados:
  - Número da proposta pública (ex: "265 (GT 1 – art. 2º e 3º)")
  - Artigos da Lei 14.133/2021 mencionados
  - Keywords automáticas (licitação, pregão, economicidade, etc.)
- ✅ Classifica cada enunciado usando IA (reutiliza `tcu-classifier.ts`)

**Exemplo de uso:**
```typescript
const result = await parseEnunciadosPDF(pdfBuffer, 'IBDA_Enunciados.pdf');
// Retorna: { success: true, totalEnunciados: 50, enunciados: [...] }
```

### 2. **API de Extração (`/api/admin/enunciados-import/parse`)**

**Endpoint:**
- `POST /api/admin/enunciados-import/parse`
- Recebe: FormData com `file` (PDF) + `autoClassify` (boolean)
- Retorna: Lista de enunciados extraídos e classificados

**Exemplo de resposta:**
```json
{
  "success": true,
  "fonte": "IBDA_Enunciados.pdf",
  "totalEnunciados": 3,
  "enunciados": [
    {
      "numero": 1,
      "titulo": "ENUNCIADO 1",
      "texto": "A incidência da Lei n. 14.133/2021...",
      "fonte": "IBDA_Enunciados.pdf",
      "metadados": {
        "numeroPropostaPublica": "265 (GT 1 – art. 2º e 3º)",
        "artigos": ["2", "3"],
        "keywords": ["lei 14.133/2021", "convenção"]
      },
      "classification": {
        "success": true,
        "titulo": "IBDA Enunciado 1 - Aplicação da CISG",
        "descricao": "Discussão sobre aplicação da Convenção...",
        "categoria": "apostila",
        "cursos": ["1"],
        "tags": ["lei-14133", "convenção-cisg"],
        "confianca": 85,
        "raciocinio": "Enunciado trata de aplicação da lei..."
      }
    }
  ]
}
```

### 3. **Interface Parcial (`/admin/enunciados-import`)**

**Funcionalidades implementadas:**
- ✅ Upload de PDF
- ✅ Botão "Extrair e Classificar Enunciados"
- ✅ Indicador de progresso durante processamento
- ✅ Display de erros

---

## 🚧 Falta Implementar (30%)

### 1. **Completar Interface de Revisão**

**Necessário:**
- Interface similar ao `TCUReviewTable.tsx`
- Mostrar lista de enunciados extraídos
- Permitir:
  - Ver texto completo de cada enunciado
  - Editar título, descrição sugeridos pela IA
  - Escolher cursos (multi-select)
  - Adicionar/remover tags
  - Marcar para importar ou pular
- Botão "Importar X Enunciados Selecionados"

**Mockup:**
```
┌─────────────────────────────────────────────┐
│ Revisão de Enunciados Extraídos             │
│ Fonte: IBDA_Enunciados.pdf | 50 enunciados │
├─────────────────────────────────────────────┤
│                                             │
│ [✓] ENUNCIADO 1                            │
│     A incidência da Lei n. 14.133/2021...  │
│     IA sugeriu: Cursos [1, 3] | Conf: 85%  │
│     [Editar] [Pular]                        │
│                                             │
│ [✓] ENUNCIADO 2                            │
│     O contrato de securitização...          │
│     IA sugeriu: Cursos [1] | Conf: 92%     │
│     [Editar] [Pular]                        │
│                                             │
│ ...                                         │
└─────────────────────────────────────────────┘
[← Voltar] [Importar 48 Selecionados →]
```

### 2. **API de Importação Final**

**Endpoint:**
- `POST /api/admin/enunciados-import/import`
- Recebe: Lista de enunciados aprovados
- Ação: Cria um documento no banco para CADA enunciado
- Retorna: Stats (importados, falhas)

**Pseudocódigo:**
```typescript
for (const enunciado of enunciadosAprovados) {
  await prisma.document.create({
    data: {
      title: enunciado.editedTitle || classification.titulo,
      description: enunciado.texto.substring(0, 500),
      type: 'link', // ou 'pdf' se houver link
      url: '#', // ou link do enunciado se disponível
      category: 'apostila', // Enunciados são material de estudo
      courseId: enunciado.selectedCourses[0], // Criar documento para cada curso?
      isPublic: true, // Enunciados geralmente são públicos
      tags: JSON.stringify(enunciado.selectedTags),
      // Campos específicos de enunciado
      notes: `Fonte: ${enunciado.fonte}\nNúmero: ${enunciado.numero}`,
      // Se houver metadados adicionais, salvar em campo dedicado
    },
  });
}
```

### 3. **Melhorias Opcionais**

- [ ] Suporte a diferentes padrões de numeração (alguns PDFs usam "Enunciado I", "Enunciado II")
- [ ] Detectar fonte automaticamente (IBDA, INCP) pelo conteúdo do PDF
- [ ] Permitir edição inline do texto do enunciado (caso extração tenha erros)
- [ ] Botão "Reprocessar com IA" para enunciados específicos
- [ ] Salvar PDF original como anexo

---

## 🧪 Como Testar

### Teste Manual (após completar implementação):

1. Acesse `/admin/enunciados-import`
2. Upload de um PDF com enunciados (exemplo: IBDA)
3. Sistema extrai e classifica automaticamente
4. Revise cada enunciado
5. Marque os que deseja importar
6. Clique "Importar"
7. Verifique em `/admin/documentos` se os enunciados foram criados

### PDFs de Teste:

Você mencionou ter PDFs do IBDA e INCP. Estrutura esperada:

```
ENUNCIADO 1
Número da proposta apresentada pelo público para a discussão: 265 (GT 1 – art. 2º e 3º)
A incidência da Lei n. 14.133/2021...

ENUNCIADO 2
O contrato de securitização formalizado pelo Poder Público...

ENUNCIADO 3
...
```

---

## 🛠️ Guia de Implementação Rápida

Para completar os 30% restantes:

### Passo 1: Atualizar Interface

Edite `app/admin/enunciados-import/page.tsx`:
- Adicionar seção de revisão após parseResult
- Lista de enunciados com checkboxes
- Botões de ação
- Modal de edição (opcional)

### Passo 2: Criar API de Importação

Crie `app/api/admin/enunciados-import/import/route.ts`:
```typescript
export const POST = withAdminAuth(async (request: NextRequest) => {
  const { enunciados } = await request.json();

  for (const enunciado of enunciados) {
    // Criar documento no banco
    await prisma.document.create({...});
  }

  return NextResponse.json({ success: true, imported: enunciados.length });
});
```

### Passo 3: Conectar Tudo

Na interface, ao clicar "Importar":
```typescript
const response = await fetch('/api/admin/enunciados-import/import', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ enunciados: selectedEnunciados }),
});
```

---

## 📊 Comparação: Sistema Antigo vs Novo

| Aspecto | Sistema Antigo | Sistema Novo (WIP) |
|---------|----------------|-------------------|
| **Input** | PDF inteiro como 1 documento | PDF com múltiplos enunciados |
| **Processamento** | Manual | Automático (IA extrai + classifica) |
| **Output** | 1 documento | N documentos (1 por enunciado) |
| **Revisão** | Após importação | Antes da importação |
| **Classificação** | Manual | Automática com IA |

---

## 🎯 Próxima Ação Recomendada

1. **Completar a interface de revisão** (mais importante)
2. **Criar API de importação**
3. **Testar com PDF real do IBDA**

Após isso, o sistema estará 100% funcional! 🚀
