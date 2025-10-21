# 📱 Configuração de Redes Sociais

Guia completo para configurar a integração com Instagram e LinkedIn para publicação automática de posts do blog.

---

## 📊 Visão Geral

Quando você publica um post no blog, o sistema automaticamente:
1. ✅ Gera uma imagem Open Graph bonita (1200x630px)
2. ✅ Publica no Instagram com imagem + caption
3. ✅ Publica no LinkedIn com imagem + texto profissional
4. ✅ Salva registros no banco de dados
5. ✅ Permite republicar se falhar

---

## 📋 Pré-requisitos

### Para Instagram:
- ✅ Conta Instagram convertida para **Business Account**
- ✅ Conta Facebook (para acessar Meta Developer)
- ✅ Instagram conectado a uma Página do Facebook

### Para LinkedIn:
- ✅ Conta LinkedIn profissional
- ✅ Acesso ao LinkedIn Developer Portal

---

## 🔧 Parte 1: Configurar Instagram

### Passo 1: Converter Instagram para Business Account

1. Abra o Instagram no celular
2. Vá em **Configurações → Conta**
3. Toque em **Mudar para Conta Profissional**
4. Escolha categoria: **Educação** ou **Serviços Profissionais**
5. Escolha tipo: **Conta Comercial**

### Passo 2: Criar Página no Facebook

1. Acesse https://facebook.com/pages/create
2. Nome da página: **Prof. Daniel Barral**
3. Categoria: **Educação**
4. Descrição: _(sua descrição profissional)_
5. Clique em **Criar Página**

### Passo 3: Conectar Instagram à Página do Facebook

1. Na Página do Facebook, vá em **Configurações**
2. Menu esquerdo → **Instagram**
3. Clique em **Conectar Conta**
4. Faça login no Instagram
5. Autorize a conexão

### Passo 4: Criar Facebook App

1. Acesse https://developers.facebook.com/apps
2. Clique em **Criar App**
3. Tipo: **Outro**
4. Nome do app: **Prof Daniel Barral - Social Publisher**
5. Email de contato: _(seu email)_
6. Clique em **Criar App**

### Passo 5: Adicionar Produto Instagram

1. No painel do app, encontre **Instagram Basic Display**
2. Clique em **Configurar**
3. Nas configurações, adicione:
   - **Valid OAuth Redirect URIs**: `https://profdanielbarral.com/admin/redes-sociais/callback`
   - **Deauthorize Callback URL**: `https://profdanielbarral.com/api/auth/instagram/deauthorize`
   - **Data Deletion Request URL**: `https://profdanielbarral.com/api/auth/instagram/delete`
4. Salve alterações

### Passo 6: Obter Credenciais do Instagram

#### 6.1. App ID e App Secret

1. No painel do app, vá em **Configurações → Básico**
2. Copie:
   - **ID do App**: `INSTAGRAM_APP_ID`
   - **Chave Secreta do App**: `INSTAGRAM_APP_SECRET`

#### 6.2. Access Token de Longa Duração

**IMPORTANTE:** Tokens do Instagram expiram. Precisamos de token de **longa duração** (60 dias).

1. Primeiro, obtenha um token de curta duração via Graph API Explorer:
   - Acesse: https://developers.facebook.com/tools/explorer
   - Selecione seu App no dropdown
   - Adicione permissões:
     - `instagram_basic`
     - `instagram_content_publish`
     - `pages_read_engagement`
     - `pages_show_list`
   - Clique em **Generate Access Token**
   - Copie o token

2. Troque por token de longa duração:
   - Acesse: `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=SEU_APP_ID&client_secret=SEU_APP_SECRET&fb_exchange_token=SEU_TOKEN_CURTO`
   - Substitua `SEU_APP_ID`, `SEU_APP_SECRET` e `SEU_TOKEN_CURTO`
   - Cole no navegador
   - Copie o `access_token` retornado

3. **Salve este token**: `INSTAGRAM_ACCESS_TOKEN`

#### 6.3. Instagram Business Account ID

1. Com o token de longa duração, acesse:
   ```
   https://graph.facebook.com/v18.0/me/accounts?access_token=SEU_TOKEN
   ```

2. Encontre sua Página do Facebook na resposta

3. Com o `page_id`, acesse:
   ```
   https://graph.facebook.com/v18.0/PAGE_ID?fields=instagram_business_account&access_token=SEU_TOKEN
   ```

4. Copie o `instagram_business_account.id`: `INSTAGRAM_BUSINESS_ACCOUNT_ID`

### Passo 7: Adicionar Variáveis no Vercel

1. Acesse https://vercel.com → Seu Projeto → Settings → Environment Variables

2. Adicione:
   ```
   INSTAGRAM_APP_ID=123456789
   INSTAGRAM_APP_SECRET=abc123def456
   INSTAGRAM_ACCESS_TOKEN=EAAxxxxxxxxxx
   INSTAGRAM_BUSINESS_ACCOUNT_ID=17841401234567890
   ```

3. Clique em **Save**

4. Redeploy o site

---

## 🔧 Parte 2: Configurar LinkedIn

### Passo 1: Criar LinkedIn App

1. Acesse https://www.linkedin.com/developers/apps
2. Clique em **Create app**
3. Preencha:
   - **App name**: Prof Daniel Barral - Social Publisher
   - **LinkedIn Page**: _(crie uma página se não tiver)_
   - **Privacy policy URL**: `https://profdanielbarral.com/privacidade`
   - **App logo**: _(upload de logo)_
4. Aceite os termos e clique em **Create app**

### Passo 2: Configurar Produtos e Permissões

1. Na aba **Products**, adicione:
   - **Share on LinkedIn** (clique em Request access)
   - **Sign In with LinkedIn** (se disponível)

2. Aguarde aprovação (geralmente automática)

### Passo 3: Configurar OAuth 2.0

1. Vá na aba **Auth**

2. Em **OAuth 2.0 settings**, adicione:
   - **Redirect URLs**:
     ```
     https://profdanielbarral.com/admin/redes-sociais/linkedin/callback
     ```

3. Copie as credenciais:
   - **Client ID**: `LINKEDIN_CLIENT_ID`
   - **Client Secret**: `LINKEDIN_CLIENT_SECRET`

### Passo 4: Gerar Access Token

**Opção A: Via OAuth Flow (Recomendado)**

1. Monte a URL de autorização:
   ```
   https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=SEU_CLIENT_ID&redirect_uri=https://profdanielbarral.com/admin/redes-sociais/linkedin/callback&scope=w_member_social%20r_liteprofile
   ```

2. Acesse a URL no navegador

3. Autorize o app

4. Você será redirecionado com um `code` na URL

5. Troque o `code` por access token:
   ```bash
   curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code" \
     -d "code=SEU_CODE" \
     -d "client_id=SEU_CLIENT_ID" \
     -d "client_secret=SEU_CLIENT_SECRET" \
     -d "redirect_uri=https://profdanielbarral.com/admin/redes-sociais/linkedin/callback"
   ```

6. Copie o `access_token`: `LINKEDIN_ACCESS_TOKEN`

**Opção B: Via Postman (Mais Fácil)**

1. Baixe Postman: https://www.postman.com/downloads
2. Use a coleção LinkedIn OAuth
3. Siga o wizard de autorização
4. Copie o token gerado

### Passo 5: Obter Person URN

1. Com o access token, execute:
   ```bash
   curl -X GET https://api.linkedin.com/v2/me \
     -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
     -H "X-Restli-Protocol-Version: 2.0.0"
   ```

2. Copie o `id` retornado (ex: `AbC123XyZ`)

3. Formato do Person URN: `urn:li:person:AbC123XyZ`

4. Salve: `LINKEDIN_PERSON_URN=urn:li:person:AbC123XyZ`

### Passo 6: Adicionar Variáveis no Vercel

1. Acesse https://vercel.com → Seu Projeto → Settings → Environment Variables

2. Adicione:
   ```
   LINKEDIN_CLIENT_ID=78abc123def
   LINKEDIN_CLIENT_SECRET=XyZ789AbC
   LINKEDIN_ACCESS_TOKEN=AQVxxxxxxxxxxxxxx
   LINKEDIN_PERSON_URN=urn:li:person:AbC123XyZ
   ```

3. Clique em **Save**

4. Redeploy o site

---

## ✅ Parte 3: Testar Integração

### Teste via Console do Node

No terminal da Vercel ou local:

```javascript
// Testar Instagram
const { createInstagramPost } = require('./lib/instagram');
await createInstagramPost(
  'https://profdanielbarral.com/api/og/primeiro-post',
  'Teste de publicação automática! #DireitoAdministrativo'
);

// Testar LinkedIn
const { createLinkedInImagePost } = require('./lib/linkedin');
await createLinkedInImagePost(
  'Teste de publicação automática no LinkedIn!',
  'https://profdanielbarral.com/api/og/primeiro-post'
);
```

### Teste via Interface Admin

1. Acesse `/admin/blog/novo`

2. Preencha o formulário do post

3. Marque checkbox: **☑ Publicar nas redes sociais**

4. Clique em **Publicar**

5. Verifique:
   - Instagram: https://instagram.com/SEU_USUARIO
   - LinkedIn: https://linkedin.com/in/SEU_PERFIL

6. Veja logs em `/admin/redes-sociais`

---

## 🔄 Renovação de Tokens

### Instagram

Tokens expiram em **60 dias**. Para renovar:

1. Use a função `refreshInstagramToken()` em `lib/instagram.ts`

2. Ou acesse novamente o Graph API Explorer e gere novo token

3. Atualize `INSTAGRAM_ACCESS_TOKEN` na Vercel

### LinkedIn

Tokens expiram em **60 dias** (ou conforme configurado). Para renovar:

1. Repita o OAuth flow (Passo 4 da configuração do LinkedIn)

2. Ou implemente refresh token (se disponível para seu app)

3. Atualize `LINKEDIN_ACCESS_TOKEN` na Vercel

---

## 🐛 Troubleshooting

### Erro: "Instagram não configurado"

- ✅ Verifique se todas as 4 variáveis estão na Vercel
- ✅ Redeploy após adicionar variáveis
- ✅ Confirme que Instagram é Business Account

### Erro: "Invalid access token"

- ✅ Token expirou - gere novo token de longa duração
- ✅ Verifique permissões: instagram_basic, instagram_content_publish

### Erro: "Image URL must use HTTPS"

- ✅ Imagem OG deve ser HTTPS
- ✅ Verifique que site está em produção (não localhost)

### Erro: "LinkedIn API error"

- ✅ Verifique Person URN está correto (formato: `urn:li:person:...`)
- ✅ Confirme que app tem produto "Share on LinkedIn" aprovado
- ✅ Token pode ter expirado

### Instagram não publica

- ✅ Aguarde 3-5 segundos entre criar container e publicar
- ✅ Imagem deve ser acessível publicamente (não localhost)
- ✅ Caption não pode ter mais de 2200 caracteres

---

## 📊 Monitoramento

### Ver Publicações

Acesse: `/admin/redes-sociais`

Você verá:
- ✅ Lista de posts publicados
- ✅ Status (published, failed, pending)
- ✅ Link para o post na rede social
- ✅ Erro (se houver)
- ✅ Botão para republicar

### Estatísticas

Na mesma tela, veja:
- Total de publicações
- Taxa de sucesso por plataforma
- Posts que falharam (para retry)

---

## 🎯 Próximos Passos

Após configurar tudo:

1. ✅ Criar primeiro post de teste
2. ✅ Verificar se apareceu nas redes sociais
3. ✅ Ajustar hashtags padrão (em `lib/instagram.ts`)
4. ✅ Customizar template de imagem OG (em `app/api/og/[slug]/route.tsx`)
5. ✅ Configurar agenda de renovação de tokens (60 dias)

---

## 📚 Documentação Oficial

- **Instagram Graph API**: https://developers.facebook.com/docs/instagram-api
- **LinkedIn Share API**: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
- **Vercel OG Image**: https://vercel.com/docs/functions/edge-functions/og-image-generation

---

**Dúvidas?** Consulte os logs do Vercel em: https://vercel.com/seu-projeto/logs
