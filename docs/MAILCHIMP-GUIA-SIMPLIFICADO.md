# MailChimp - Guia Simplificado (2025)

## ✅ IMPORTANTE: Você JÁ tem uma Audience!

Contas novas do MailChimp **já vêm com uma Audience (lista) criada automaticamente**.

Você NÃO precisa criar uma nova - apenas precisa encontrar a que já existe!

---

## 🔍 PASSO 1: Encontrar sua Audience (que já existe)

1. **Faça login** no MailChimp: https://login.mailchimp.com

2. Procure no **menu superior** (barra preta no topo) por:
   - **"Audience"** OU
   - Ícone de 👥 pessoas

3. Clique em **"Audience"**

4. Você verá uma das seguintes telas:
   - **"Audience dashboard"** - Painel da sua lista
   - **"All contacts"** - Todos os contatos
   - Nome da sua lista (ex: "Audience")

✅ **Pronto!** Esta é sua lista. Agora vamos pegar as informações dela.

---

## 📋 PASSO 2: Pegar o ID da sua Audience

Ainda na tela do Audience:

1. Procure no menu por **"Settings"** (Configurações) - geralmente no canto superior direito

2. Clique em **"Settings"** → **"Audience name and defaults"**

3. Você verá uma tela com várias informações. Procure por:

   ```
   Audience ID: a1b2c3d4e5
   ```

4. **COPIE** este código e cole em um arquivo de texto (Bloco de Notas)

   Exemplo:
   ```
   Audience ID: abc123def4
   ```

**Atenção**: Se não encontrar "Settings", tente:
- Clicar no ícone de **engrenagem** ⚙️
- Ou procurar por **"Manage Audience"** → **"Settings"**

---

## 🔑 PASSO 3: Criar sua API Key

1. Clique no **ícone do seu perfil** no canto superior direito (sua foto ou inicial do nome)

2. No menu que abrir, clique em:
   - **"Account & Billing"** (Conta e Faturamento)

3. No menu lateral ESQUERDO, procure por:
   - **"Extras"**
   - Dentro de Extras, clique em **"API keys"**

4. Você verá a página de chaves API. Clique no botão:
   - **"Create A Key"** (Criar uma chave)

5. Uma nova chave será gerada com este formato:
   ```
   abc123def456ghi789jkl012mno345pqr-us1
   ```

6. **COPIE A CHAVE COMPLETA** e cole no Bloco de Notas

   ⚠️ **ATENÇÃO**:
   - Esta é a ÚNICA vez que você verá esta chave
   - Se perder, terá que criar uma nova
   - Copie TUDO, incluindo o `-us1` (ou `-us2`, etc) no final

---

## 🌐 PASSO 4: Identificar o Server Prefix

O Server Prefix é a **última parte da sua API Key**, depois do hífen `-`.

**Veja sua API Key que você copiou:**
```
abc123def456ghi789jkl012mno345pqr-us1
                                   ^^^^
                              Este é o prefix
```

**Exemplos:**
- Se termina com `-us1` → Server Prefix = `us1`
- Se termina com `-us2` → Server Prefix = `us2`
- Se termina com `-us21` → Server Prefix = `us21`

**Anote seu Server Prefix** no Bloco de Notas

---

## 💾 PASSO 5: Configurar no Site

Agora você tem 3 informações:
1. ✅ API Key (ex: `abc123...xyz-us1`)
2. ✅ Server Prefix (ex: `us1`)
3. ✅ Audience ID (ex: `abc123def4`)

### Criar/Editar o arquivo .env.local

1. Abra o VS Code no seu projeto

2. Na **raiz do projeto**, procure o arquivo `.env.local`
   - Se NÃO existir, crie um arquivo novo chamado `.env.local`

3. Adicione estas linhas:

```env
# MailChimp - Newsletter
MAILCHIMP_API_KEY=cole_sua_api_key_completa_aqui
MAILCHIMP_SERVER_PREFIX=cole_seu_server_prefix_aqui
MAILCHIMP_AUDIENCE_ID=cole_seu_audience_id_aqui
MAILCHIMP_REPLY_TO=contato@profbarral.com.br
```

4. **Substitua** com seus dados reais:

```env
# MailChimp - Newsletter
MAILCHIMP_API_KEY=abc123def456ghi789jkl012mno345pqr-us1
MAILCHIMP_SERVER_PREFIX=us1
MAILCHIMP_AUDIENCE_ID=abc123def4
MAILCHIMP_REPLY_TO=contato@profbarral.com.br
```

5. **Salve o arquivo** (Ctrl + S)

---

## 🔄 PASSO 6: Reiniciar o Servidor

1. No terminal do VS Code, **pare o servidor**:
   - Pressione `Ctrl + C`

2. **Inicie novamente**:
   ```bash
   npm run dev
   ```

3. Aguarde até ver:
   ```
   ✓ Ready in XXXms
   ```

---

## ✅ PASSO 7: Testar!

1. Abra o navegador em: **http://localhost:3000**

2. Role a página até o **rodapé**

3. Encontre o formulário de **Newsletter**

4. Digite seu email e clique em **"Cadastrar"**

5. Se aparecer **"Cadastro realizado com sucesso!"** → Funcionou! ✅

### Verificar no MailChimp

1. Volte ao MailChimp

2. Clique em **"Audience"** (menu superior)

3. Clique em **"All contacts"** (Todos os contatos)

4. **Seu email deve aparecer na lista!**

---

## 🐛 Problemas Comuns

### ❌ "MailChimp não configurado"

**Solução:**
1. Confirme que o arquivo `.env.local` está na **raiz do projeto**
2. Confirme que NÃO há espaços extras nas linhas
3. Reinicie o servidor (Ctrl+C e `npm run dev`)

---

### ❌ "Invalid API Key"

**Solução:**
1. Verifique se copiou a chave COMPLETA (incluindo o `-us1`)
2. Gere uma nova chave se necessário
3. Certifique-se de não ter espaços antes ou depois

---

### ❌ "Resource Not Found"

**Solução:**
1. Confirme o **Audience ID** em: Audience → Settings → Audience name and defaults
2. Confirme o **Server Prefix** (último pedaço da API Key)

---

### ❌ Email não aparece no MailChimp

**Verificar:**

1. **Console do navegador** (F12):
   - Procure erros em vermelho
   - Erro 429 = muitas tentativas, aguarde 1 minuto

2. **Console do servidor** (terminal VS Code):
   - Procure "Error ao sincronizar com MailChimp"
   - A mensagem dirá o problema

3. **Servidor rodando?**
   - Deve mostrar "✓ Ready in XXXms"

---

## 📸 Onde Clicar - Visual

```
┌─────────────────────────────────────────────┐
│ MailChimp                    👤 Seu Nome ▼ │ ← Clicar aqui para API Key
├─────────────────────────────────────────────┤
│ [Audience] [Campaigns] [Automations]        │ ← Clicar em Audience
└─────────────────────────────────────────────┘

Depois:

┌─────────────────────────────────────────────┐
│ Audience Dashboard                          │
│                                             │
│ [All contacts] [Settings ⚙️]                │ ← Clicar em Settings
└─────────────────────────────────────────────┘

Depois:

┌─────────────────────────────────────────────┐
│ Settings                                    │
│                                             │
│ > Audience name and defaults                │ ← Clicar aqui
│ > Contact information                       │
└─────────────────────────────────────────────┘

Depois:

┌─────────────────────────────────────────────┐
│ Audience name and defaults                  │
│                                             │
│ Audience name: Audience                     │
│ Audience ID: abc123def4    ← COPIAR ISTO   │
└─────────────────────────────────────────────┘
```

---

## 📞 Ainda com dúvida?

Se mesmo assim não encontrar:

1. **Tire um print da tela** que você está vendo
2. Me mostre qual menu/opções aparecem para você
3. Vou te orientar com base no que você está vendo

---

## 🎯 Resumo Rápido

Você precisa de 3 coisas:

1. **API Key**: Perfil → Account & Billing → Extras → API keys → Create A Key
2. **Server Prefix**: Últimos caracteres da API Key (depois do `-`)
3. **Audience ID**: Audience → Settings → Audience name and defaults

Cole tudo no `.env.local` e reinicie o servidor!
