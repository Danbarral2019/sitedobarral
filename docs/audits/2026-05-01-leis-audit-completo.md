# Auditoria Completa — Leis, Leis Complementares e Decretos-Lei

**Gerado:** 2026-05-01

**Lista mínima exigida:** 11 atos definidos pelo mantenedor.

## Resumo

| Métrica | Valor |
|---|---|
| Leis no banco | **19** |
| ✅ OK | 19 |
| ❌ Errors | 0 |
| ⚠️ Warnings | 0 |
| Lista exigida cobertura | **11/11 (100%)** |

## ✅ Lista exigida — todas presentes

| Tipo | Nº/Ano | Apelido | chars |
|---|---|---|---|
| `lei` | **14.133/2021** | LLCA — Nova Lei de Licitações | 272.979 |
| `lei` | **14.973/2024** | Alterou a Lei do CADIN | 107.811 |
| `lei` | **13.709/2018** | LGPD — Lei Geral de Proteção de Dados | 107.673 |
| `lei` | **12.527/2011** | LAI — Lei de Acesso à Informação | 42.214 |
| `lei` | **12.305/2010** | PNRS — Política Nacional de Resíduos Sólidos | 64.434 |
| `lei` | **14.195/2021** | Tradução juramentada e ambiente de negócios | 87.303 |
| `lei` | **8.429/1992** | Lei de Improbidade Administrativa | (importada) |
| `lei` | **4.320/1964** | Normas gerais de direito financeiro | 63.221 |
| `lei` | **10.522/2002** | CADIN — Cadastro Informativo de Créditos | (importada) |
| `lei-complementar` | **101/2000** | LRF — Lei de Responsabilidade Fiscal | 102.912 |
| `decreto-lei` | **4.657/1942** | LINDB — Lei de Introdução às Normas | 20.273 |

## 📋 Demais leis no banco

Atos relevantes presentes além da lista exigida:

| Tipo | Nº/Ano | Apelido |
|---|---|---|
| `lei` | 8.666/1993 | Lei de Licitações antiga (fundamento histórico) |
| `lei` | 12.846/2013 | Lei Anticorrupção |
| `lei` | 9.784/1999 | Processo Administrativo Federal |
| `lei` | 8.248/1991 | Lei de Informática |
| `lei` | 5.452/1943 | CLT — Consolidação das Leis do Trabalho |
| `lei` | 14.744/2023 | (verificar relevância) |
| `lei-complementar` | 95/1998 | LC 95 — elaboração de leis |
| `medida-provisoria` | 1.167/2023 | (em andamento) |

## ✅ Fixes aplicados nesta auditoria

1. **8 leis novas importadas** via Planalto:
   - Lei 14.973/2024, Lei 12.305/2010, Lei 14.195/2021
   - Lei 8.429/1992, Lei 10.522/2002
   - LC 101/2000 (LRF)
   - DL 4.657/1942 (LINDB)
   - Lei 4.320/1964 (precisou de fetch direto + cheerio porque scraper padrão não casa o seletor da página antiga)

2. **CLT (Lei 5.452/1943)** estava com 435 chars (falha de scrape) — re-scrapeada da URL compilada (`Del5452compilado.htm`), agora com **638.263 chars** (texto integral atualizado).

3. **Pipeline pra páginas antigas do Planalto:** `scripts/fix-lei-4320.ts` mostra padrão de fallback — fetch direto + cheerio + body genérico — pra leis pre-2000 que não usam seletor `#parent-fieldname-text`.

## 🛠️ Ferramentas reutilizáveis

- `scripts/audit-leis.ts` — lista + valida + cruza com lista mínima
- `scripts/import-missing-leis.ts` — pipeline genérico pra importar leis novas
- `scripts/fix-leis-antigas.ts` — tenta URLs alternativas (compiladas)
- `scripts/fix-lei-4320.ts` — fallback fetch direto pra layout antigo
