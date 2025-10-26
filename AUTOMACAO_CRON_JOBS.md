# Sistema de Automação de Cron Jobs

Este documento descreve o sistema de automação implementado para importação de documentos e envio de newsletters.

## Visão Geral

O sistema de automação consiste em dois cron jobs principais:

1. **Importação Automática de Documentos** - Executa scrapers semanalmente
2. **Newsletter Mensal** - Envia email com documentos novos todo mês

## 1. Importação Automática de Documentos

### Endpoint
`GET /api/cron/import-documents`

### Agendamento
- **Frequência:** Semanal
- **Dia:** Toda terça-feira
- **Horário:** 02:00 (horário UTC)
- **Cron Expression:** `0 2 * * 2`

### Funcionalidade

Executa automaticamente os seguintes scrapers:

#### TCU Scraper
- Busca acórdãos do TCU dos últimos 30 dias
- Palavras-chave: "licitação"
- Tipos: Acórdãos
- Filtra apenas documentos novos (não duplicados)
- Importa automaticamente com status `reviewed: false`

#### AGU Scraper
- Busca Orientações Normativas da AGU
- Filtra apenas ONs novas (não duplicadas)
- Importa automaticamente com status `reviewed: false`

### Comportamento
- Documentos importados ficam como **não revisados** (`reviewed: false`)
- Documentos ficam **privados** até admin aprovar (`isPublic: false`)
- Admin pode revisar e aprovar em `/admin/documentos`
- Evita duplicação verificando URL e título

### Resposta
```json
{
  "success": true,
  "message": "Importação automática executada com sucesso",
  "results": {
    "tcu": {
      "success": true,
      "count": 5,
      "error": null
    },
    "agu": {
      "success": true,
      "count": 2,
      "error": null
    },
    "startTime": "2025-01-26T02:00:00.000Z",
    "endTime": "2025-01-26T02:05:30.123Z"
  }
}
```

## 2. Newsletter Mensal

### Endpoint
`GET /api/cron/monthly-newsletter`

### Agendamento
- **Frequência:** Mensal
- **Dia:** Dia 1 de cada mês
- **Horário:** 09:00 (horário UTC)
- **Cron Expression:** `0 9 1 * *`

### Funcionalidade

1. **Coleta documentos novos dos últimos 30 dias:**
   - Apenas documentos públicos (`isPublic: true`)
   - Ordenados por data de upload (mais recentes primeiro)

2. **Agrupa por categoria:**
   - Apostilas e Material Didático
   - Acórdãos
   - Pareceres Jurídicos
   - Editais
   - Artigos e Doutrinas
   - Orientações Normativas
   - Outros Documentos

3. **Envia email para todos os inscritos ativos:**
   - Via Resend API
   - Template HTML responsivo
   - Personalizado com nome do assinante
   - Link para área restrita

### Template de Email

O email inclui:
- Header com branding Prof. Daniel Barral
- Saudação personalizada
- Número total de documentos novos
- Documentos agrupados por categoria com:
  - Emoji representativo
  - Título do documento
  - Descrição (até 200 caracteres)
  - Data de adição
- Call-to-action para acessar área restrita
- Footer com link de cancelamento de inscrição

### Comportamento
- **Se não houver documentos novos:** Newsletter NÃO é enviada
- **Se não houver inscritos ativos:** Newsletter NÃO é enviada
- Envia em lote para todos os inscritos
- Registra erros de envio no console

### Resposta
```json
{
  "success": true,
  "message": "Newsletter mensal enviada com sucesso",
  "stats": {
    "documents": 15,
    "subscribers": 234,
    "emailsSent": 230,
    "emailsFailed": 4
  }
}
```

## Segurança

Ambos os endpoints são protegidos por `CRON_SECRET`:

```typescript
const cronSecret = request.headers.get('x-cron-secret');

if (cronSecret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
}
```

### Configuração
Adicione ao `.env.local` e variáveis de ambiente da Vercel:
```
CRON_SECRET=seu-segredo-aleatorio-aqui
```

## Configuração no Vercel

O arquivo `vercel.json` contém a configuração dos cron jobs:

```json
{
  "crons": [
    {
      "path": "/api/enrollment/check-expiration",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/notify-new-documents",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/import-documents",
      "schedule": "0 2 * * 2"
    },
    {
      "path": "/api/cron/monthly-newsletter",
      "schedule": "0 9 1 * *"
    }
  ]
}
```

### Formato Cron Expression
```
┌───────────── minuto (0 - 59)
│ ┌───────────── hora (0 - 23)
│ │ ┌───────────── dia do mês (1 - 31)
│ │ │ ┌───────────── mês (1 - 12)
│ │ │ │ ┌───────────── dia da semana (0 - 6) (0 = domingo)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

Exemplos:
- `0 9 * * *` - Todo dia às 9h
- `0 2 * * 2` - Toda terça às 2h
- `0 9 1 * *` - Dia 1 de cada mês às 9h

## Testes Manuais

Use o script de teste para testar os endpoints localmente:

```bash
# Testar importação de documentos
node scripts/test-cron-jobs.js import

# Testar newsletter mensal
node scripts/test-cron-jobs.js newsletter

# Testar todos
node scripts/test-cron-jobs.js all
```

### Teste via cURL

```bash
# Importação
curl -X GET http://localhost:3000/api/cron/import-documents \
  -H "x-cron-secret: seu-segredo"

# Newsletter
curl -X GET http://localhost:3000/api/cron/monthly-newsletter \
  -H "x-cron-secret: seu-segredo"
```

## Monitoramento

### Logs
Os cron jobs registram logs detalhados no console da Vercel:
- Início e fim da execução
- Quantidade de documentos processados
- Erros encontrados
- Estatísticas de envio de email

### Verificação Manual
1. Acesse o painel da Vercel
2. Vá em "Logs" → "Cron Jobs"
3. Verifique execuções recentes
4. Analise erros se houver

## Solução de Problemas

### Cron job não está executando
1. Verifique se `CRON_SECRET` está configurado na Vercel
2. Confirme que o cron está configurado em `vercel.json`
3. Verifique logs da Vercel para erros

### Newsletter não sendo enviada
1. Verifique se `RESEND_API_KEY` está configurado
2. Confirme que `EMAIL_FROM` está verificado no Resend
3. Verifique se há inscritos ativos no banco
4. Confirme que há documentos públicos nos últimos 30 dias

### Importação duplicando documentos
1. A verificação de duplicação usa URL e título
2. Se o título ou URL mudarem, será importado como novo
3. Admin pode deletar duplicatas manualmente

### Scrapers falhando
1. Verifique se os sites TCU/AGU mudaram estrutura
2. Analise erros específicos nos logs
3. Teste scrapers individualmente no painel admin
4. Atualize seletores CSS se necessário

## Manutenção

### Atualizar frequência dos cron jobs
1. Edite `vercel.json`
2. Modifique a expressão cron
3. Commit e push para aplicar
4. Vercel atualiza automaticamente

### Adicionar novos scrapers
1. Implemente novo scraper em `lib/`
2. Adicione chamada em `/api/cron/import-documents`
3. Teste localmente
4. Deploy

### Personalizar template de newsletter
1. Edite função `generateNewsletterHtml()` em `/api/cron/monthly-newsletter`
2. Teste com `node scripts/test-cron-jobs.js newsletter`
3. Deploy

## Variáveis de Ambiente Necessárias

```env
# Segurança dos cron jobs
CRON_SECRET=seu-segredo-aleatorio

# Email (Resend)
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=newsletter@profdanielbarral.com.br

# URL base
NEXT_PUBLIC_BASE_URL=https://www.profdanielbarral.com.br
```

## Estrutura de Arquivos

```
app/api/cron/
├── import-documents/
│   └── route.ts           # Endpoint de importação automática
└── monthly-newsletter/
    └── route.ts           # Endpoint de newsletter mensal

scripts/
└── test-cron-jobs.js      # Script de teste

vercel.json                # Configuração de cron jobs
```

## Roadmap / Melhorias Futuras

- [ ] Dashboard de monitoramento de cron jobs
- [ ] Notificação no Slack/Discord quando cron falha
- [ ] Relatório mensal de atividades por email para admin
- [ ] Retry automático em caso de falha
- [ ] A/B testing de templates de newsletter
- [ ] Segmentação de newsletter por interesses
- [ ] Preview de newsletter antes do envio
- [ ] Agendamento manual de newsletter fora do ciclo mensal

## Suporte

Em caso de problemas ou dúvidas:
1. Verifique os logs da Vercel
2. Teste localmente com o script de teste
3. Consulte esta documentação
4. Verifique configurações de ambiente
