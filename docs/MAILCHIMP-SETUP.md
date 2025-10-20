# Configuração do MailChimp - Newsletter

Este guia explica como configurar a integração com MailChimp para gerenciar a newsletter do site.

## 📋 Pré-requisitos

1. Conta no MailChimp (gratuita até 500 contatos)
2. Lista/Audience criada no MailChimp

## 🔧 Passo a Passo

### 1. Criar Conta no MailChimp

1. Acesse https://mailchimp.com
2. Clique em "Sign Up Free"
3. Preencha seus dados e confirme o email

### 2. Criar uma Audience (Lista)

1. No dashboard do MailChimp, vá em **Audience** → **All contacts**
2. Clique em **Create Audience**
3. Preencha:
   - **Audience name**: Newsletter Prof. Daniel Barral
   - **Default from name**: Prof. Daniel Barral
   - **Default from email**: contato@profbarral.com.br
   - **Campaign URL domain**: profbarral.com.br
4. Salve a Audience

### 3. Obter Credenciais

#### 3.1 API Key

1. Clique no seu perfil (canto superior direito) → **Account & billing**
2. Vá em **Extras** → **API keys**
3. Clique em **Create A Key**
4. Copie a API Key gerada (formato: `xxxxxxxx-us1` ou similar)
5. **IMPORTANTE**: Guarde em local seguro - não será exibida novamente

#### 3.2 Server Prefix

O Server Prefix é o **sufixo do seu API Key**:
- Se sua API Key é `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6-us1`, o Server Prefix é **`us1`**
- Se é `xxxxxxxx-us2`, o Server Prefix é **`us2`**

#### 3.3 Audience ID

1. Vá em **Audience** → **All contacts**
2. Clique em **Settings** → **Audience name and defaults**
3. Procure por **Audience ID** (formato: `a1b2c3d4e5`)
4. Copie o ID

### 4. Configurar Variáveis de Ambiente

Edite o arquivo `.env.local` (crie se não existir) e adicione:

```env
# MailChimp
MAILCHIMP_API_KEY=sua_api_key_completa_aqui
MAILCHIMP_SERVER_PREFIX=us1
MAILCHIMP_AUDIENCE_ID=seu_audience_id_aqui
MAILCHIMP_REPLY_TO=contato@profbarral.com.br
```

**Exemplo real:**
```env
MAILCHIMP_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6-us1
MAILCHIMP_SERVER_PREFIX=us1
MAILCHIMP_AUDIENCE_ID=a1b2c3d4e5
MAILCHIMP_REPLY_TO=contato@profbarral.com.br
```

### 5. Reiniciar o Servidor

```bash
npm run dev
```

## ✅ Testar a Integração

### Teste 1: Cadastro Automático

1. Acesse o site: http://localhost:3000
2. Cadastre-se na newsletter (rodapé ou página de contato)
3. Verifique no console do servidor se não há erros
4. Acesse o MailChimp → **Audience** → **All contacts**
5. Confirme que o email apareceu na lista

### Teste 2: Sincronização Manual (Admin)

1. Faça login no admin: http://localhost:3000/admin/login
2. Faça uma requisição POST para: http://localhost:3000/api/admin/newsletter/sync
3. Verifique a resposta JSON com o resultado da sincronização

```bash
# Exemplo usando curl
curl -X POST http://localhost:3000/api/admin/newsletter/sync \
  -H "Cookie: auth-token=SEU_TOKEN_AQUI"
```

## 📊 Funcionalidades Implementadas

### Sincronização Automática

Quando um usuário se cadastra na newsletter:
1. ✅ Salva no banco de dados local
2. ✅ Sincroniza automaticamente com MailChimp
3. ✅ Adiciona tags/interesses selecionados
4. ✅ Separa nome em First Name e Last Name

### Sincronização Manual (Admin)

Endpoint: `POST /api/admin/newsletter/sync`
- Sincroniza TODOS os inscritos ativos do banco com MailChimp
- Útil para primeira sincronização ou correção de dados
- Retorna quantos foram sincronizados e quantos falharam

### Cancelamento de Inscrição

Quando um usuário cancela a inscrição:
1. ✅ Marca como inativo no banco local
2. ✅ Remove do MailChimp (status: unsubscribed)

## 🏷️ Tags e Segmentação

O sistema suporta tags/interesses. Configure tags no MailChimp:

1. Vá em **Audience** → **Manage Audience** → **Tags**
2. Crie tags como:
   - Licitações
   - Contratos
   - Nova Lei 14.133
   - Gestão Pública
   - etc.

Os usuários podem selecionar interesses ao se cadastrar e essas tags serão aplicadas automaticamente.

## 📧 Criando Campanhas

### Manualmente no MailChimp

1. Vá em **Campaigns** → **Create Campaign**
2. Escolha **Regular** ou **Automated**
3. Defina audience, assunto e conteúdo
4. Agende ou envie imediatamente

### Via API (Futuro)

O sistema já possui funções para criar e enviar campanhas programaticamente:

```typescript
import { createCampaign, sendCampaign } from '@/lib/mailchimp';

// Criar campanha
const result = await createCampaign(
  'Novos Artigos sobre Licitações',
  '<h1>Confira os novos conteúdos...</h1>',
  'Preview text here'
);

// Enviar campanha
if (result.success && result.campaignId) {
  await sendCampaign(result.campaignId);
}
```

## 🔍 Verificação de Status

O sistema verifica automaticamente se o MailChimp está configurado:

```typescript
import { isMailChimpConfigured } from '@/lib/mailchimp';

if (!isMailChimpConfigured()) {
  console.warn('MailChimp não configurado');
}
```

Se não estiver configurado:
- ✅ O site continua funcionando normalmente
- ✅ Cadastros são salvos no banco local
- ⚠️ Não sincroniza com MailChimp (logs de aviso no console)

## 🚨 Troubleshooting

### Erro: "MailChimp não configurado"

**Solução**: Verifique se todas as variáveis de ambiente estão definidas corretamente em `.env.local`

### Erro: "Invalid API Key"

**Soluções**:
1. Confirme que copiou a API Key completa (incluindo o sufixo `-us1`)
2. Verifique se não há espaços extras
3. Tente gerar uma nova API Key

### Erro: "Resource Not Found"

**Possíveis causas**:
1. **Audience ID incorreto**: Confirme o ID em Audience Settings
2. **Server Prefix incorreto**: Deve corresponder ao sufixo da API Key

### Emails não aparecem no MailChimp

**Verificar**:
1. Console do navegador para erros
2. Console do servidor Node.js
3. Se o ambiente está configurado (`isMailChimpConfigured()`)

## 📱 Limites da Conta Gratuita

- **Contatos**: Até 500
- **Emails/mês**: 1.000 (total)
- **Emails/dia**: 500
- **Campanhas simultâneas**: 1

Para mais, considere upgrade para plano pago.

## 🔐 Segurança

⚠️ **IMPORTANTE**:
- NUNCA faça commit do `.env.local` (já está no `.gitignore`)
- NUNCA exponha sua API Key publicamente
- NUNCA compartilhe suas credenciais

## 📚 Recursos Adicionais

- [Documentação Oficial MailChimp](https://mailchimp.com/developer/)
- [MailChimp Marketing API](https://mailchimp.com/developer/marketing/)
- [Guia de Audience](https://mailchimp.com/help/create-audience/)

## 🆘 Suporte

Se encontrar problemas:
1. Verifique logs do servidor (`console.log`)
2. Consulte a documentação oficial do MailChimp
3. Verifique se a conta está ativa e sem bloqueios
