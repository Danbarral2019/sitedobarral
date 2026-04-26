# Ideias futuras — backlog

Registradas em 2026-04-26 a partir de mensagens do Daniel.

Não é roadmap — são ideias com contexto inicial pra retomar quando vier o
momento. Ordem de listagem não é prioridade.

---

## 1. Compartilhar pesquisa via WhatsApp

**Origem:** [17:47, 25/04/2026] Daniel Barral

> "Opção de compartilhar a pesquisa com WhatsApp"

### Contexto

Aluno faz uma consulta na IA jurídica e quer enviar pra colega/grupo de
estudos via WhatsApp. Hoje tem `Share2` no `ChatInterface.tsx` (gera
link público da resposta via `searchHistoryId/share`), mas não tem
deep-link específico pro WhatsApp.

### Implementação esperada

- Botão dedicado de WhatsApp ao lado do botão de share atual
- Link `https://wa.me/?text=<texto-encoded>` (funciona web e mobile)
- Texto enviado: link da resposta pública + título resumido
  (ex: "Veja essa análise sobre licitações: https://...")
- Reutilizar a infra de share pública já existente
  (`/api/search-history/[id]/share` cria slug curto)

### Pontos a decidir antes de implementar

- Quer o WhatsApp expor a pergunta E a resposta no preview, ou só a
  pergunta + link?
- Vale fazer Web Share API genérica (`navigator.share`) ou WhatsApp-specific?
  Web Share dá muitos canais de uma vez (WhatsApp, Telegram, email...) e
  é a tendência mobile.

### Esforço estimado

~2h (componente novo + 1 endpoint reutilizado + teste manual mobile).

---

## 2. Bug bounty — aluno reporta erro da IA → ganha mês grátis

**Origem:** [18:00, 25/04/2026] Daniel Barral

> "Caso um aluno identifique um erro e preencha um formulário me reportando
> o erro, ele ganha um mês grátis. (Um erro por mes)"

### Contexto

Conexão direta com o incidente IBDA 29 (2026-04-26). A defesa em camadas
do commit `462e0d2` (threshold + prompt + cobertura baixa + validador
pós-síntese) reduz hallucinations mas **não elimina**. Programa de bug
bounty:

1. Reforça incentivo do aluno a flagar problemas em vez de descartar uso
2. Gera fluxo de queries problemáticas pro golden set (treina eval contra
   regressão)
3. Cria sentimento de "eu ajudei a melhorar" → retenção

### Implementação esperada

- Formulário acessível a partir do botão 👎 no `ChatInterface.tsx` /
  `JurisprudenciaRestritaClient.tsx`. Campos:
  - Categoria do erro (citação inventada / lei errada / artigo inexistente
    / informação desatualizada / outro)
  - Descrição do erro (texto livre)
  - Print/screenshot (opcional, upload)
  - Link da pesquisa (auto-preenchido via `searchHistoryId`)
- Modelo Prisma novo: `BugReport` com status (pending/validated/rejected/
  duplicate), recompensa atribuída, alunoId, searchHistoryId, descrição,
  screenshot URL, validatedBy, validatedAt
- UI admin (`/admin/bug-reports`): listar pendentes, validar/rejeitar com
  motivo, aplicar recompensa (extensão Stripe de 30 dias na assinatura)
- Limite: 1 erro válido recompensado por aluno por mês civil. Sistema
  rejeita o 2º+ no mês com "Você já tem um erro premiado este mês —
  obrigado pelo report mesmo assim, ele entra na fila pro golden set"
- Integração Stripe: usar Customer Portal API ou
  `subscription.update({ trial_end })` pra empurrar próximo cobrança 30d

### Pontos a decidir antes

- O que conta como "erro válido"? Precisa de critério claro pra evitar
  abuso (ex: aluno reporta 50 "erros" inventados pra ganhar mês). Sugestão:
  só vale erro reproduzível + de fato em fontes da base + prejudicial
  (não só "confuso").
- Validação humana ou automática? Provavelmente humana (você ou monitor)
  no início. Automatizar quando volume justificar.
- Recompensa: extender assinatura paga em 30d, ou crédito numa nova
  compra? Stripe trata diferente.
- Alunos no plano gratuito ainda valem? Ganham assinatura paga 30d?

### Esforço estimado

~10-15h (modelo Prisma + form UI + endpoint POST + admin view + integração
Stripe + email confirmação). Razoável fazer em 2 PRs:
- PR1: Coleta de reports + admin view (sem recompensa)
- PR2: Recompensa Stripe + limites + automações

---

## 3. Agradecimento na newsletter aos contribuidores do mês

**Origem:** [18:06, 25/04/2026] Daniel Barral

> "E ganha agradecimento na newsletter do mês seguinte. a ideia é que eles
> sejam premiados caso contribuam para melhorar a robustez das respostas
> com uso de IA"

### Contexto

Complementa #2. Reconhecimento social vale tanto ou mais que o mês grátis
em termos de engajamento. Newsletter já existe (Mailchimp +
`lib/newsletter/*` + `intro-generator`), só falta nova seção.

### Implementação esperada

- Nova seção variável no template da newsletter: "Contribuições deste mês"
- Query agregadora (cron mensal): seleciona `BugReport` com
  `status='validated'` e `validatedAt` no mês anterior, agrupa por
  alunoId, gera lista de nomes (ou apelidos opt-in)
- Variável de template tipo `{{contribuidoresDoMes}}` injetada no
  `intro-generator.ts`
- Texto sugerido: "🙏 Agradecimento especial a [Nome 1, Nome 2, Nome 3]
  por reportarem erros que ajudaram a deixar a IA jurídica mais precisa
  este mês."
- **Opt-in obrigatório**: aluno escolhe no formulário de bug report se
  quer aparecer com nome real, apelido ou anônimo (default anônimo —
  privacidade primeiro)

### Pontos a decidir antes

- Dar agradecimento mesmo a quem não pegou recompensa Stripe (porque
  passou do limite de 1 por mês)? Provavelmente sim — sinal social tem
  custo zero e vale incentivo extra.
- Nome real vs apelido vs "Aluno A1B2C" (anônimo): formulário deve
  perguntar e default = anônimo.
- E se alguém só reportou em mês com newsletter já enviada? Programar
  cron de agradecimento pro 1º dia útil do mês seguinte ao validatedAt.

### Esforço estimado

~3-4h (nova query + injeção em intro-generator + opt-in no form de bug
report + edição do template Mailchimp).

---

## Sequência sugerida quando for retomar

1. **#2 PR1** primeiro (coleta de reports sem recompensa) — destrava o
   sinal de qualidade pra você imediatamente, sem complexidade Stripe.
2. **#3** depois (newsletter) — quase de graça em cima do PR1.
3. **#1** WhatsApp em paralelo — feature isolada, sem dependência.
4. **#2 PR2** (recompensa Stripe) por último — exige cuidado fiscal e
   limites anti-fraude.

Total estimado pra todas: ~20-25h de dev.
