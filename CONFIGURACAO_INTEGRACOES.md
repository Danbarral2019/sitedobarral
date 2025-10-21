# Guia de Configuração de Integrações

Este documento contém instruções detalhadas para configurar as integrações externas do site.

---

## 📊 1. Google Analytics

### **Status**: ✅ Código implementado | ⏳ Aguardando credenciais

### **O que faz**:
- Rastreia visitantes do site
- Métricas de engajamento (tempo médio, páginas mais visitadas)
- Análise de origem do tráfego (Google, Instagram, direto, etc.)
- Conversões (cadastros na newsletter, cliques em "Solicitar Informações")

### **Passo a Passo**:

#### 1.1 Criar conta no Google Analytics

1. Acesse: https://analytics.google.com/
2. Clique em **"Iniciar medição"**
3. Preencha os dados:
   - **Nome da conta**: Prof. Daniel Barral
   - **Nome da propriedade**: Site Prof. Daniel Barral
   - **Fuso horário**: (GMT-03:00) Brasília
   - **Moeda**: Real brasileiro (BRL)

#### 1.2 Configurar propriedade GA4

1. Em **"Plataforma"**, selecione: **Web**
2. Preencha:
   - **URL do site**: `https://profdanielbarral.com`
   - **Nome do stream**: Site Principal
3. Clique em **"Criar stream"**

#### 1.3 Obter o ID de Medição

1. Após criar, você verá uma tela com:
   ```
   ID de medição
   G-XXXXXXXXXX
   ```
2. **Copie esse ID** (formato: `G-` seguido de letras/números)

#### 1.4 Adicionar à Vercel

1. Acesse: https://vercel.com/seu-projeto/settings/environment-variables
2. Adicione nova variável:
   - **Name**: `NEXT_PUBLIC_GA_ID`
   - **Value**: `G-XXXXXXXXXX` (cole o ID copiado)
   - **Environment**: Production (marque)
3. Clique em **"Save"**
4. Faça **redeploy** do site

### **Como verificar se está funcionando**:

1. Acesse o site: `https://profdanielbarral.com`
2. Abra o DevTools (F12) → **Console**
3. Procure por mensagens do tipo: `gtag` ou `Google Analytics`
4. No Google Analytics → **Relatórios → Tempo real**
5. Você deve ver sua visita aparecendo em tempo real

### **Métricas importantes para acompanhar**:
- ✅ Páginas mais visitadas (ver quais cursos interessam mais)
- ✅ Tempo médio na área restrita
- ✅ Taxa de cadastro na newsletter
- ✅ Origem do tráfego (Instagram, YouTube, Google)
- ✅ Downloads de documentos (se implementado tracking)

---

## 📧 2. MailChimp (Newsletter)

### **Status**: ✅ Código implementado | ⏳ Aguardando credenciais

### **O que faz**:
- Gerencia lista de emails da newsletter
- Segmenta inscritos por interesse (cursos específicos)
- Envia campanhas de email marketing
- Automação de boas-vindas

### **Passo a Passo**:

#### 2.1 Criar conta no MailChimp

1. Acesse: https://mailchimp.com/
2. Clique em **"Sign Up Free"**
3. Preencha os dados da conta
4. Confirme o email

#### 2.2 Criar Audience (Lista de emails)

1. No MailChimp, vá em: **Audience → All contacts**
2. Clique em **"Create Audience"**
3. Preencha:
   - **Audience name**: Newsletter Prof. Daniel Barral
   - **Default from email**: contato@profdanielbarral.com (ou seu email)
   - **Default from name**: Prof. Daniel Barral

#### 2.3 Obter as credenciais

**API Key**:
1. Clique no seu perfil (canto superior direito)
2. **Account → Extras → API keys**
3. Clique em **"Create A Key"**
4. Copie a chave (formato: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us1`)
5. **Importante**: Guarde em local seguro!

**Server Prefix**:
- É os últimos 3-4 caracteres da API Key
- Exemplo: Se a key termina com `-us1`, o prefix é `us1`
- Pode ser: `us1`, `us2`, `us21`, etc.

**Audience ID**:
1. Vá em **Audience → All contacts**
2. Clique em **Settings → Audience name and defaults**
3. Procure por **"Audience ID"**
4. Copie o ID (formato letras/números misturados)

#### 2.4 Adicionar à Vercel

1. Acesse: https://vercel.com/seu-projeto/settings/environment-variables
2. Adicione 4 variáveis:

**Variável 1**:
- **Name**: `MAILCHIMP_API_KEY`
- **Value**: `sua_chave_completa_aqui-us1`
- **Environment**: Production (marque)

**Variável 2**:
- **Name**: `MAILCHIMP_SERVER_PREFIX`
- **Value**: `us1` (ou o que aparecer na sua key)
- **Environment**: Production (marque)

**Variável 3**:
- **Name**: `MAILCHIMP_AUDIENCE_ID`
- **Value**: `id_da_audience_aqui`
- **Environment**: Production (marque)

**Variável 4**:
- **Name**: `MAILCHIMP_REPLY_TO`
- **Value**: `contato@profdanielbarral.com`
- **Environment**: Production (marque)

3. Clique em **"Save"** em cada uma
4. Faça **redeploy** do site

### **Como testar se está funcionando**:

1. Acesse o site: `https://profdanielbarral.com`
2. Role até o formulário de newsletter (final da homepage)
3. Cadastre um email de teste
4. Verifique:
   - ✅ Mensagem de sucesso no site
   - ✅ Email aparece no MailChimp → Audience → All contacts

### **Configurações recomendadas**:

**Tags para segmentação** (opcional):
- `Curso: Nova Lei Licitações`
- `Curso: Gestão Contratos`
- `Curso: Planejamento`
- etc.

**Email de boas-vindas** (opcional):
1. Vá em **Automations**
2. Crie automation: **"Welcome new subscribers"**
3. Personalize o email de boas-vindas

---

## 💳 3. Sistema de Pagamento (Futuro)

### **Status**: 📝 Planejado para Fase 4

### **O que será**:
Sistema para alunos comprarem **upgrade vitalício** (acesso perpétuo aos materiais).

### **Opções recomendadas**:

#### Opção A: Stripe
- ✅ Internacional
- ✅ API bem documentada
- ✅ Aceita cartão de crédito
- ✅ Boleto bancário (via Stripe Brazil)
- ⚠️ Taxa: 2.9% + R$0.39 por transação

#### Opção B: Mercado Pago
- ✅ Popular no Brasil
- ✅ Aceita Pix, cartão, boleto
- ✅ Checkout transparente
- ⚠️ Taxa: ~4% por transação

### **Fluxo previsto**:

1. Aluno acessa área restrita
2. Vê banner: **"Seu acesso expira em 60 dias. Upgrade para vitalício!"**
3. Clica em **"Fazer Upgrade"**
4. Redireciona para checkout (Stripe ou Mercado Pago)
5. Após pagamento aprovado:
   - Webhook atualiza banco de dados
   - Campo `isLifetime` → `true`
   - Email de confirmação enviado

### **Implementação futura** (não fazer agora):
```typescript
// app/api/payment/webhook/route.ts
export async function POST(request: NextRequest) {
  // Verificar assinatura do webhook
  // Atualizar enrollment.isLifetime = true
  // Enviar email de confirmação
}
```

---

## 📱 4. Integração com Redes Sociais (Futuro)

### **Status**: 📝 Planejado para Fase 4

### **O que será**:
Publicação automática de novos posts do blog no Instagram e LinkedIn.

### **APIs necessárias**:

#### Instagram (Meta Graph API):
1. Criar app no Meta for Developers
2. Obter token de acesso
3. Configurar permissões: `instagram_content_publish`
4. Webhook para publicar quando novo post do blog é criado

#### LinkedIn (LinkedIn API):
1. Criar app no LinkedIn Developers
2. Obter credenciais OAuth
3. Permissões: `w_member_social`
4. Post automático com link para o blog

### **Fluxo previsto**:

1. Professor publica novo post no blog (via admin)
2. Sistema cria imagem de capa automaticamente (Open Graph image)
3. Webhook dispara:
   - Post no Instagram (imagem + link na bio)
   - Post no LinkedIn (texto + link)
4. Email notifica o professor que foi publicado

### **Implementação futura** (não fazer agora):
```typescript
// app/api/social/publish-blog-post/route.ts
export async function POST(request: NextRequest) {
  // Publicar no Instagram
  // Publicar no LinkedIn
  // Notificar professor por email
}
```

---

## 📋 Checklist de Configuração

### Agora (Configurações obrigatórias):
- [ ] Configurar Google Analytics (ID de medição)
- [ ] Configurar MailChimp (API Key + Audience ID)
- [ ] Testar newsletter no site
- [ ] Verificar métricas no Analytics

### Futuro (Fase 4):
- [ ] Implementar sistema de pagamento (Stripe ou Mercado Pago)
- [ ] Criar webhook de confirmação de pagamento
- [ ] Testar upgrade vitalício
- [ ] Integrar API do Instagram
- [ ] Integrar API do LinkedIn
- [ ] Configurar publicação automática de posts

---

## 🆘 Suporte e Troubleshooting

### Google Analytics não aparece no site:
1. Verificar variável `NEXT_PUBLIC_GA_ID` na Vercel
2. Verificar se está em produção (não funciona em dev)
3. Limpar cache do navegador
4. Aguardar 24h para dados aparecerem

### MailChimp retorna erro "Invalid API Key":
1. Verificar se copiou a key completa (com `-us1` no final)
2. Verificar server prefix correto
3. Testar key no MailChimp → API Playground

### Newsletter não cadastra:
1. Verificar todas as 4 variáveis configuradas
2. Ver logs da Vercel (Functions → Logs)
3. Testar endpoint: `/api/newsletter` (POST)

---

**Precisa de ajuda? Entre em contato com o suporte técnico.**
