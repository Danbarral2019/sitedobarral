# 🤖 Resumos Automáticos com IA - Guia Rápido

## O que é?

Sistema de geração automática de resumos executivos para documentos jurídicos usando inteligência artificial (Claude AI da Anthropic).

---

## 🎯 Para que serve?

- ⚡ **Acelera curadoria:** Reduz 80% do tempo gasto escrevendo resumos
- 📚 **Melhora experiência:** Alunos veem resumos objetivos de todos os documentos
- 🎓 **Didático:** Resumos focados em aplicação prática para gestores públicos
- 🤖 **Inteligente:** Identifica automaticamente artigos da Lei 14.133/2021

---

## 💰 Quanto custa?

**Praticamente GRÁTIS!**
- Custo por resumo: ~$0.001 (um décimo de centavo)
- Estimativa mensal: $0.15-0.20 (cinquenta resumos)

---

## 🚀 Como Usar

### 1. Acessar Edição de Documento

```
Admin Panel → Documentos → [Clique em qualquer documento]
```

### 2. Localizar Seção de Resumo

Role a página até encontrar:

```
┌─────────────────────────────────────────┐
│ ✨ Resumo Automático (IA)              │
│                                         │
│ Gere um resumo executivo do documento  │
│ usando inteligência artificial          │
│                                         │
│         [Gerar Resumo com IA]  ←────── │
└─────────────────────────────────────────┘
```

### 3. Gerar Resumo

1. **Clique no botão roxo:** "Gerar Resumo com IA"
2. **Aguarde 2-5 segundos** (ícone de loading aparece)
3. **Preview aparece** com:
   - ✅ Confiança da IA (0-100%)
   - 📝 Resumo executivo (2-3 parágrafos)
   - 📌 Destaques principais (3-5 pontos)
   - 🏷️ Tags sugeridas
   - 📖 Artigos da Lei 14.133/2021 citados
   - 💭 Raciocínio da IA

### 4. Revisar e Salvar

**Opção A - Aceitar como está:**
- Clique em "Salvar" no topo da página
- Resumo salvo no banco de dados

**Opção B - Editar manualmente:**
- Edite o texto no campo "Resumo" (acima da seção de IA)
- Clique em "Salvar"
- Sistema marca como "editado manualmente"

**Opção C - Regenerar:**
- Clique em "Regenerar" (se não gostou)
- IA gera novo resumo
- Repita processo

**Opção D - Remover:**
- Clique em "Remover"
- Resumo deletado
- Pode gerar novamente depois

---

## 📊 Entendendo a Confiança

A IA indica o nível de confiança no resumo gerado:

| Confiança | Badge | Significado |
|-----------|-------|-------------|
| 80-100% | 🟢 Verde | Análise precisa, informações completas |
| 60-79% | 🟡 Amarelo | Análise confiável, informações parciais |
| 40-59% | 🔴 Vermelho | Análise básica, informações limitadas |
| 0-39% | 🔴 Vermelho | Informações insuficientes |

**Dica:** Resumos com confiança ≥ 70% atualizam automaticamente tags e artigos da Lei.

---

## 💡 Dicas de Uso

### ✅ Quando Usar

- ✅ Documentos com título e descrição completos
- ✅ ONs da AGU, Acórdãos do TCU
- ✅ Pareceres, apostilas, editais
- ✅ Quando precisar agilizar curadoria

### ⚠️ Quando Revisar Manualmente

- ⚠️ Confiança < 70%
- ⚠️ Documentos muito técnicos ou específicos
- ⚠️ Título/descrição genéricos
- ⚠️ Artigos da Lei incorretos

### 🎓 Melhores Práticas

1. **Sempre revise o resumo** antes de salvar
2. **Edite se necessário** para melhorar clareza
3. **Verifique artigos da Lei** se mencionados
4. **Use como base** e personalize para seu público
5. **Regenere** se não ficou bom na primeira vez

---

## 🔧 Troubleshooting

### Botão não aparece?
- ✅ Verifique se está logado como admin
- ✅ Verifique se está na página de edição de documento
- ✅ Role a página até a seção "Resumo Automático (IA)"

### Erro "Serviço de IA não configurado"?
- ⚠️ ANTHROPIC_API_KEY não está configurada
- 📧 Entre em contato com desenvolvedor

### Resumo não salva?
- ✅ Clique em "Salvar" no topo da página (não apenas ver o preview)
- ✅ Verifique se outros campos obrigatórios estão preenchidos

### Demora muito?
- ⏱️ Tempo normal: 2-5 segundos
- ⏱️ Se demorar >10 segundos, atualize a página e tente novamente

---

## 📖 Exemplo de Resumo Gerado

**Entrada:**
```
Título: Acórdão TCU nº 7251/2025
Descrição: TOMADA DE CONTAS ESPECIAL. CAIXA ECONÔMICA FEDERAL.
CONTRATO DE REPASSE. NÃO COMPROVAÇÃO DE GASTOS...
```

**Saída (IA):**
```
📝 RESUMO EXECUTIVO:
Este acórdão do TCU trata de Tomada de Contas Especial envolvendo
a Caixa Econômica Federal em contrato de repasse. O documento
aborda a não comprovação de gastos públicos, estabelecendo
critérios para análise de prestação de contas e responsabilização
de gestores.

A decisão tem impacto direto na gestão de contratos de repasse e
na fiscalização de recursos federais, servindo como precedente
para casos similares de irregularidades em prestação de contas.

📌 DESTAQUES:
1. Tomada de Contas Especial em contrato de repasse
2. Não comprovação adequada de gastos públicos
3. Estabelece critérios para responsabilização de gestores

🏷️ TAGS: TCU, Acórdão, Tomada de Contas, Caixa Econômica,
Contrato de Repasse, Prestação de Contas

💯 CONFIANÇA: 82%
```

---

## 🎯 Resultados Esperados

Após usar o sistema regularmente:

- 📚 **Todos os documentos** com resumos executivos
- ⚡ **80% menos tempo** gasto em curadoria
- 🎓 **Alunos mais engajados** com conteúdo resumido
- 🔍 **Melhor descobribilidade** de documentos
- 📊 **Dados estruturados** (tags, artigos) automáticos

---

## 📞 Suporte

Dúvidas ou problemas?
- 📧 Entre em contato com o desenvolvedor
- 📖 Veja documentação completa: `SESSAO_2025-01-27_RESUMOS_AUTOMATICOS_IA.md`

---

**Última atualização:** 27/01/2025
**Versão:** 1.0.0
