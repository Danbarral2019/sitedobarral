# MailChimp - Guia Prático Passo a Passo (Interface em Português)

## 🎯 Objetivo
Configurar sua conta MailChimp e conectar ao site para gerenciar a newsletter.

---

## 📝 PASSO 1: Criar sua Lista de Contatos (Público/Audience)

1. **Faça login** no MailChimp: https://login.mailchimp.com

2. No menu lateral esquerdo, procure e clique em uma destas opções:
   - **"Público"** (interface mais recente)
   - **"Audience"** (interface em inglês)
   - **"Listas"** (interface antiga)
   - Ícone de pessoas/contatos 👥

3. Você verá uma das seguintes opções:
   - **"Criar público"** ou **"Criar lista"** ou **"Create Audience"**
   - Se já tiver uma lista, procure por **"Gerenciar público"** ou **"Manage Audience"**

4. Clique em **"Criar público"** / **"Create Audience"**

5. Se aparecer um pop-up perguntando sobre importar contatos, clique em:
   - **"Criar público"** ou **"Create Audience"**
   - (não vamos importar agora)

6. Preencha o formulário:

   **Nome do público / Audience name:** (nome interno, apenas você vê)
   ```
   Newsletter Prof. Daniel Barral
   ```

   **Nome padrão de envio / Default From name:** (nome que aparece para quem recebe o email)
   ```
   Prof. Daniel Barral
   ```

   **Endereço de email padrão / Default From email address:** (seu email profissional)
   ```
   contato@profbarral.com.br
   ```
   ⚠️ **IMPORTANTE**: Use um email que você tenha acesso real

   **Lembrar as pessoas de como se inscreveram / Remind people how they signed up:**
   ```
   Você se inscreveu para receber novidades sobre Licitações e Contratos Administrativos
   ```

   **Domínio da URL da campanha / Campaign URL domain:** (opcional, mas recomendado)
   ```
   profbarral.com.br
   ```

   **Informações de contato / Contact information:**
   - Nome da empresa/organização
   - Endereço completo (obrigatório por lei anti-spam CAN-SPAM)

7. Clique em **"Salvar"** / **"Save"**

✅ **Pronto!** Sua lista foi criada.

---

## 🔑 PASSO 2: Obter a API Key (Chave da API)

1. No canto **superior direito**, clique no **ícone do seu perfil** (sua foto ou inicial do nome)

2. No menu que abrir, procure e clique em uma destas opções:
   - **"Conta e faturamento"** ou
   - **"Account & billing"** ou
   - **"Conta"**

3. No menu lateral, procure por:
   - **"Extras"** → **"Chaves de API"** ou
   - **"Extras"** → **"API keys"**

4. Você verá a seção **"Suas chaves de API"** / **"Your API keys"**

5. Clique no botão:
   - **"Criar uma chave"** ou
   - **"Create A Key"**

5. Uma nova API Key será gerada. Ela terá este formato:
   ```
   a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6-us1
   ```

6. **COPIE A API KEY COMPLETA** e salve em um arquivo temporário (Bloco de Notas)

   ⚠️ **ATENÇÃO**:
   - Você NÃO conseguirá ver esta chave novamente
   - Se perder, terá que gerar uma nova
   - Nunca compartilhe esta chave

---

## 🌐 PASSO 3: Identificar o Server Prefix

O Server Prefix é a **última parte da sua API Key**, depois do hífen (-).

**Exemplo:**
- Se sua API Key é: `xxxxxxxxxxxxxxxxxxxxxx-us1`
- Seu Server Prefix é: **`us1`**

- Se sua API Key é: `xxxxxxxxxxxxxxxxxxxxxx-us2`
- Seu Server Prefix é: **`us2`**

- Se sua API Key é: `xxxxxxxxxxxxxxxxxxxxxx-us21`
- Seu Server Prefix é: **`us21`**

📝 **Anote seu Server Prefix**

---

## 📋 PASSO 4: Obter o ID do Público (Audience ID)

1. No menu lateral esquerdo, procure e clique em:
   - **"Público"** ou
   - **"Audience"** ou
   - Ícone de pessoas 👥

2. Clique em uma destas opções:
   - **"Todos os contatos"** ou
   - **"All contacts"** ou
   - O nome da sua lista que você criou

3. No menu superior, procure e clique em:
   - **"Configurações"** ou
   - **"Settings"**

4. No menu que abrir, clique em:
   - **"Nome e padrões do público"** ou
   - **"Audience name and defaults"**

5. Procure pela linha **"ID do público"** ou **"Audience ID"**

   Será um código como este:
   ```
   a1b2c3d4e5
   ```

6. **COPIE O ID** completo e salve no mesmo arquivo temporário (Bloco de Notas)

---

## ⚙️ PASSO 5: Configurar no Site

Agora você tem todas as informações necessárias:
- ✅ API Key
- ✅ Server Prefix
- ✅ Audience ID

### 5.1 Abrir o arquivo de configuração

1. Abra o projeto no VS Code

2. Procure o arquivo **`.env.local`** na raiz do projeto
   - Se NÃO existir, crie um novo arquivo chamado `.env.local`

### 5.2 Adicionar as configurações

Cole estas linhas no arquivo `.env.local`:

```env
# =============================================================================
# MAILCHIMP - Newsletter
# =============================================================================
MAILCHIMP_API_KEY=cole_sua_api_key_completa_aqui
MAILCHIMP_SERVER_PREFIX=cole_seu_server_prefix_aqui
MAILCHIMP_AUDIENCE_ID=cole_seu_audience_id_aqui
MAILCHIMP_REPLY_TO=contato@profbarral.com.br
```

### 5.3 Substituir pelos seus dados

**ANTES (exemplo):**
```env
MAILCHIMP_API_KEY=cole_sua_api_key_completa_aqui
MAILCHIMP_SERVER_PREFIX=cole_seu_server_prefix_aqui
MAILCHIMP_AUDIENCE_ID=cole_seu_audience_id_aqui
MAILCHIMP_REPLY_TO=contato@profbarral.com.br
```

**DEPOIS (com seus dados reais):**
```env
MAILCHIMP_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6-us1
MAILCHIMP_SERVER_PREFIX=us1
MAILCHIMP_AUDIENCE_ID=a1b2c3d4e5
MAILCHIMP_REPLY_TO=contato@profbarral.com.br
```

### 5.4 Salvar o arquivo

- Pressione `Ctrl + S` para salvar
- O arquivo `.env.local` NÃO deve ser commitado no Git (já está no .gitignore)

---

## 🔄 PASSO 6: Reiniciar o Servidor

1. No terminal do VS Code, pare o servidor:
   - Pressione `Ctrl + C`

2. Inicie novamente:
   ```bash
   npm run dev
   ```

3. Aguarde até ver:
   ```
   ✓ Ready in XXXXms
   ```

---

## ✅ PASSO 7: Testar a Integração

### Teste 1: Cadastro Manual no Site

1. Abra o navegador em: http://localhost:3000

2. Role até o rodapé da página

3. Procure o formulário de **Newsletter**

4. Cadastre um email de teste (pode ser o seu mesmo)

5. Clique em **"Cadastrar"**

6. Se aparecer **"Cadastro realizado com sucesso!"** → Funcionou! ✅

7. **Verifique no MailChimp:**
   - Vá em **"Público"** / **"Audience"** → **"Todos os contatos"** / **"All contacts"**
   - Seu email deve aparecer na lista de contatos

### Teste 2: Verificar Logs do Servidor

No terminal do VS Code, procure por:

```
✅ SEM ERROS:
Nenhuma mensagem de erro sobre MailChimp

❌ COM ERRO:
Error ao sincronizar com MailChimp: ...
MailChimp não configurado
Invalid API Key
```

Se aparecer erro, veja a seção **Problemas Comuns** abaixo.

---

## 🐛 Problemas Comuns

### ❌ "MailChimp não configurado"

**Causa**: Variáveis de ambiente não foram carregadas

**Solução**:
1. Confirme que o arquivo `.env.local` existe na raiz do projeto
2. Confirme que as variáveis estão escritas corretamente (sem espaços extras)
3. Reinicie o servidor (Ctrl+C e `npm run dev` novamente)

---

### ❌ "Invalid API Key"

**Causa**: API Key incorreta ou incompleta

**Solução**:
1. Verifique se copiou a API Key COMPLETA (incluindo o `-us1` ou similar)
2. Verifique se não há espaços antes ou depois
3. Se necessário, gere uma nova API Key no MailChimp

---

### ❌ "Resource Not Found" ou "404"

**Causa**: Audience ID ou Server Prefix incorretos

**Solução**:
1. Verifique o **Audience ID** em: Audience → Settings → Audience name and defaults
2. Confirme que o **Server Prefix** corresponde ao final da sua API Key
3. Exemplos:
   - API Key: `xxx-us1` → Server Prefix: `us1`
   - API Key: `xxx-us21` → Server Prefix: `us21`

---

### ❌ Email não aparece no MailChimp

**Possíveis causas e soluções**:

1. **Verifique o console do navegador (F12)**:
   - Procure por erros em vermelho
   - Se houver erro 429: Você está fazendo muitas requisições (rate limit)
   - Aguarde 1 minuto e tente novamente

2. **Verifique o console do servidor** (terminal do VS Code):
   - Procure por "Error ao sincronizar com MailChimp"
   - A mensagem de erro dirá qual é o problema exato

3. **Verifique se o servidor está rodando**:
   - Deve aparecer "Ready in XXXms" no terminal
   - A sincronização funciona tanto em desenvolvimento quanto em produção

---

## 📊 Verificar Status da Integração

Você pode verificar se o MailChimp está configurado corretamente:

1. Abra o console do servidor
2. Procure por mensagens que começam com `MailChimp`
3. Não deve haver warnings sobre "não configurado"

---

## 🎯 Próximos Passos

Após configurar com sucesso:

1. ✅ Teste cadastrando alguns emails
2. ✅ Configure tags/segmentos no MailChimp (opcional)
3. ✅ Personalize templates de email (opcional)
4. ✅ Configure automações (será implementado na próxima etapa)

---

## 📞 Precisa de Ajuda?

Se ainda tiver problemas:

1. **Tire um print** da tela onde está o erro
2. **Copie a mensagem de erro** do console
3. **Verifique** se seguiu todos os passos acima

Informações úteis para debug:
- Versão do Node: Execute `node -v` no terminal
- Sistema operacional: Windows/Mac/Linux
- Mensagem de erro completa

---

## 🔐 Segurança

**LEMBRE-SE**:
- ✅ O arquivo `.env.local` já está no `.gitignore` (não será enviado ao Git)
- ❌ NUNCA compartilhe sua API Key
- ❌ NUNCA faça commit do `.env.local`
- ✅ Em produção (Vercel), configure as variáveis no dashboard

---

## 📚 Links Úteis

- [MailChimp Login](https://login.mailchimp.com)
- [Documentação MailChimp](https://mailchimp.com/help/)
- [Gerar Nova API Key](https://admin.mailchimp.com/account/api/)
