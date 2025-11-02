# Teste de Scraping com Playwright MCP

Este documento contém instruções para Claude executar o scraping de Pareceres Vinculantes e DECOR usando as ferramentas MCP do Playwright.

## Pré-requisitos

1. ✅ Playwright MCP instalado e ativo: `claude mcp list`
2. ✅ Navegador instalado: `mcp__playwright__browser_install`

## TESTE 1: Scraping de Pareceres Vinculantes

### Passo 1.1: Navegar para a página

```
Usar ferramenta: mcp__playwright__browser_navigate

Parâmetros:
{
  "url": "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/pareceres-da-consultoria-geral-da-uniao/pareceres-vinculantes"
}
```

### Passo 1.2: Aguardar carregamento

```
Usar ferramenta: mcp__playwright__browser_wait_for

Parâmetros:
{
  "time": 3
}
```

### Passo 1.3: Capturar snapshot da página

```
Usar ferramenta: mcp__playwright__browser_snapshot

Parâmetros: {}
```

**Analisar o snapshot para identificar:**
- Estrutura da listagem (tabela, cards, lista)
- Seletores CSS dos elementos
- Presença de paginação

### Passo 1.4: Extrair dados dos pareceres

```
Usar ferramenta: mcp__playwright__browser_evaluate

Parâmetros:
{
  "function": "() => { const pareceres = []; const items = document.querySelectorAll('.parecer-item, .documento-item, article, .item'); items.forEach(item => { const titulo = item.querySelector('h3, h4, .titulo, a')?.textContent?.trim(); const ementa = item.querySelector('.ementa, .descricao, p')?.textContent?.trim(); const link = item.querySelector('a')?.href; const match = titulo?.match(/(?:Parecer|PV)\\s*(?:Vinculante)?\\s*n?[°º]?\\s*(\\d+)[\\/\\-](\\d{4})/i); if (match && titulo) { pareceres.push({ numero: match[1], ano: parseInt(match[2]), titulo: titulo, ementa: ementa || '', urlPrincipal: link || '', urlPDF: item.querySelector('a[href$=\".pdf\"]')?.href || '' }); } }); return pareceres; }"
}
```

### Passo 1.5: Processar e salvar resultados

Para cada parecer extraído:

1. Validar dados com `validateParecerData()`
2. Converter para AGUDocument com `convertParecerToAGUDocument()`
3. Analisar relevância com `analyzeRelevance()`
4. Salvar no banco com `findOrCreateWithVersioning()`

## TESTE 2: Scraping de DECOR

### Passo 2.1: Navegar para a página

```
Usar ferramenta: mcp__playwright__browser_navigate

Parâmetros:
{
  "url": "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/despachos-do-consultor-geral-da-uniao-decor"
}
```

### Passo 2.2: Aguardar carregamento

```
Usar ferramenta: mcp__playwright__browser_wait_for

Parâmetros:
{
  "time": 3
}
```

### Passo 2.3: Detectar estrutura da página

```
Usar ferramenta: mcp__playwright__browser_evaluate

Parâmetros:
{
  "function": "() => { const estrutura = { temTabela: !!document.querySelector('table'), temListaLinks: document.querySelectorAll('a[href*=\"decor\"]').length > 0, temAccordion: !!document.querySelector('.accordion, details'), totalLinks: document.querySelectorAll('a').length, totalTabelas: document.querySelectorAll('table').length, classes: Array.from(document.body.classList), primeiroH1: document.querySelector('h1')?.textContent?.trim() }; return estrutura; }"
}
```

### Passo 2.4: Extrair DECOR (múltiplas estratégias)

**Estratégia A: Se for Tabela**

```
Usar ferramenta: mcp__playwright__browser_evaluate

Parâmetros:
{
  "function": "() => { const decors = []; const rows = document.querySelectorAll('table tr, .table-row'); rows.forEach(row => { const cells = row.querySelectorAll('td, .cell'); if (cells.length >= 2) { const numeroTexto = cells[0]?.textContent?.trim(); const assunto = cells[1]?.textContent?.trim(); const link = row.querySelector('a')?.href; const match = numeroTexto?.match(/(?:DECOR)?\\s*(\\d+)[\\/\\-](\\d{4})/i); if (match) { decors.push({ numero: match[1], ano: parseInt(match[2]), titulo: numeroTexto || `DECOR ${match[1]}/${match[2]}`, ementa: assunto || '', assunto: assunto || '', urlPrincipal: link || '', urlPDF: row.querySelector('a[href$=\".pdf\"]')?.href || '' }); } } }); return decors; }"
}
```

**Estratégia B: Se for Lista de Links**

```
Usar ferramenta: mcp__playwright__browser_evaluate

Parâmetros:
{
  "function": "() => { const decors = []; const links = document.querySelectorAll('a[href*=\"decor\"], a[href*=\"despacho\"]'); links.forEach(link => { const texto = link.textContent?.trim(); const match = texto?.match(/(?:DECOR|Despacho)?\\s*(\\d+)[\\/\\-](\\d{4})/i); if (match) { decors.push({ numero: match[1], ano: parseInt(match[2]), titulo: texto || `DECOR ${match[1]}/${match[2]}`, ementa: link.getAttribute('title') || '', urlPrincipal: link.href, urlPDF: link.href.endsWith('.pdf') ? link.href : '' }); } }); return decors; }"
}
```

### Passo 2.5: Processar e salvar resultados

Para cada DECOR extraído:

1. Validar dados com `validateDECORData()`
2. Converter para AGUDocument com `convertDECORToAGUDocument()`
3. Analisar relevância com `analyzeRelevance()`
4. Salvar no banco com `findOrCreateWithVersioning()`

## TESTE 3: Detalhamento de Documento Individual

### Passo 3.1: Escolher um parecer/DECOR da lista

### Passo 3.2: Navegar para página individual

```
Usar ferramenta: mcp__playwright__browser_navigate

Parâmetros:
{
  "url": "<URL_DO_PARECER_OU_DECOR>"
}
```

### Passo 3.3: Extrair detalhes completos

```
Usar ferramenta: mcp__playwright__browser_evaluate

Parâmetros:
{
  "function": "() => { return { titulo: document.querySelector('h1, .titulo-principal')?.textContent?.trim(), ementa: document.querySelector('.ementa, .resumo')?.textContent?.trim(), textoCompleto: document.querySelector('.texto-completo, .conteudo, article')?.textContent?.trim(), dataPublicacao: document.querySelector('.data-publicacao, time')?.textContent?.trim(), linkPDF: document.querySelector('a[href$=\".pdf\"]')?.href, fundamentacaoLegal: document.querySelector('.fundamentacao, .base-legal')?.textContent?.trim() }; }"
}
```

## Resultados Esperados

### Para Pareceres Vinculantes:
- ✅ Array com todos os pareceres encontrados
- ✅ Cada parecer com: número, ano, título, ementa, URLs
- ✅ Validação: sem erros de formato
- ✅ Salvos no banco de dados na categoria `parecer-vinculante`

### Para DECOR:
- ✅ Array com todos os DECOR encontrados
- ✅ Cada DECOR com: número, ano, título, assunto, URLs
- ✅ Validação: sem erros de formato
- ✅ Salvos no banco de dados na categoria `decor`

### Para Versionamento:
- ✅ Primeira execução: todos documentos marcados como "created"
- ✅ Segunda execução: mudanças detectadas e versionadas
- ✅ Histórico completo de versões disponível

## Troubleshooting

### Problema: Página não carrega
**Solução:** Aumentar tempo de espera para 5-10 segundos

### Problema: Seletores não encontram elementos
**Solução:**
1. Capturar novo snapshot
2. Inspecionar estrutura HTML real
3. Ajustar seletores CSS
4. Tentar estratégias alternativas (tabela vs lista vs accordion)

### Problema: Dados incompletos
**Solução:**
1. Verificar se PDFs estão em subpáginas
2. Navegar para página individual do documento
3. Extrair detalhes completos com `get*DetailsScrapingInstructions()`

### Problema: Navegação lenta
**Solução:**
1. Usar `headless: true` (padrão)
2. Desabilitar imagens se possível
3. Processar em lotes (10-20 documentos por vez)

## Métricas de Sucesso

- **Taxa de sucesso:** > 95% dos documentos extraídos com sucesso
- **Completude:** > 90% dos documentos com todos os campos preenchidos
- **Duplicatas:** 0 duplicatas criadas (detectadas por versionamento)
- **Performance:** < 1 minuto por página de listagem
- **Versionamento:** 100% das mudanças detectadas e registradas

## Próximos Passos

Após validar o scraping:

1. **Automatizar:** Criar cron job para executar semanalmente
2. **Monitorar:** Configurar alertas para mudanças em documentos importantes
3. **Notificar:** Enviar emails aos alunos sobre novos documentos
4. **Enriquecer:** Adicionar análise de IA para classificação automática
5. **Expandir:** Adicionar outros tipos de documentos AGU (Súmulas, etc)
