# 📧 Guia de Testes - Sistema de Email

## ✅ Implementações Concluídas

1. ✅ Envio de email de verificação (send-verification)
2. ✅ Envio de email de reset de senha (request-reset)
3. ✅ Reenvio de email na página de confirmação

---

## 🧪 Testes Manuais

### **Pré-requisitos**

Antes de começar os testes, verifique:

```bash
# 1. Servidor de desenvolvimento rodando
npm run dev

# 2. Variáveis de ambiente configuradas no .env.local
RESEND_API_KEY=re_sua_chave_aqui
EMAIL_FROM=contato@profbarral.com.br
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Nota:** Se não tiver `RESEND_API_KEY` configurado, os emails serão exibidos no console do servidor (modo desenvolvimento).

---

## 📝 TESTE 1: Registro de Novo Usuário + Verificação de Email

### Passos:

1. **Acessar página de registro:**
   - URL: http://localhost:3000/registro

2. **Preencher formulário:**
   - Nome: Teste Silva
   - Email: teste@example.com (use um email real se tiver RESEND configurado)
   - Senha: SenhaForte123!
   - Confirmar senha: SenhaForte123!

3. **Clicar em "Criar Conta"**

4. **Verificar redirecionamento:**
   - Deve ir para: `/registro/confirmacao?email=teste@example.com`
   - Página deve mostrar mensagem de sucesso

5. **Verificar envio de email:**

   **COM RESEND_API_KEY:**
   - Abrir email recebido em teste@example.com
   - Verificar design do email (azul/roxo gradiente)
   - Clicar no botão "Verificar Meu Email"

   **SEM RESEND_API_KEY (modo dev):**
   - Abrir terminal do servidor (onde rodou `npm run dev`)
   - Procurar por:
     ```
     📧 ===== EMAIL SIMULADO (DEV) =====
     Para: teste@example.com
     Assunto: Confirme seu email - Prof. Daniel Barral
     ```
   - Copiar o link de verificação que aparece no HTML

6. **Acessar link de verificação:**
   - Deve ir para: `/verificar-email?token=XXXXXX`
   - Deve verificar email e fazer login automaticamente
   - Deve redirecionar para área restrita

### ✅ Resultado Esperado:
- [x] Email enviado/logado no console
- [x] Link de verificação funciona
- [x] Conta fica com `emailVerified = true`
- [x] Login automático após verificação

---

## 📝 TESTE 2: Reenvio de Email de Verificação

### Passos:

1. **Ainda na página `/registro/confirmacao`:**

2. **Clicar em "Clique aqui para reenviar"**

3. **Aguardar mensagem:**
   - Deve aparecer: "✅ Email reenviado com sucesso! Verifique sua caixa de entrada (e spam)."

4. **Verificar novo email:**
   - **COM RESEND:** Abrir inbox, deve ter recebido novo email
   - **SEM RESEND:** Ver novo log no console do servidor

5. **Testar limite de rate:**
   - Clicar em "reenviar" rapidamente 6 vezes
   - Na 6ª tentativa deve aparecer erro de limite excedido

### ✅ Resultado Esperado:
- [x] Reenvio funciona
- [x] Mensagem de sucesso aparece
- [x] Rate limiting protege endpoint (máx 5 por 15min)

---

## 📝 TESTE 3: Esqueci Minha Senha

### Passos:

1. **Acessar página de esqueci senha:**
   - URL: http://localhost:3000/esqueci-senha

2. **Inserir email cadastrado:**
   - Email: teste@example.com
   - Clicar em "Enviar Link de Recuperação"

3. **Verificar mensagem:**
   - Deve aparecer: "Se o email estiver cadastrado, você receberá instruções..."

4. **Verificar email de reset:**

   **COM RESEND:**
   - Abrir email recebido
   - Verificar assunto: "Recuperação de Senha - Prof. Daniel Barral"
   - Clicar no botão "Redefinir Minha Senha"

   **SEM RESEND:**
   - Ver console do servidor:
     ```
     🔑 Reset de senha solicitado para: teste@example.com
     🔗 Link de reset: http://localhost:3000/redefinir-senha?token=XXXX
     ```
   - Copiar link de reset

5. **Acessar página de redefinir senha:**
   - Deve carregar formulário
   - Inserir nova senha: NovaSenha456!
   - Confirmar senha: NovaSenha456!
   - Clicar em "Redefinir Senha"

6. **Verificar redirecionamento:**
   - Deve ir para `/login` com mensagem de sucesso
   - Fazer login com a NOVA senha
   - Deve funcionar

### ✅ Resultado Esperado:
- [x] Email de reset enviado
- [x] Link de reset válido por 1 hora
- [x] Nova senha funciona
- [x] Senha antiga não funciona mais

---

## 📝 TESTE 4: Email de Expiração (Cron Job)

Este teste requer acesso ao banco de dados e configuração do cron.

### Passos:

1. **Criar matrícula próxima da expiração:**
   ```bash
   # Abrir Prisma Studio
   npx prisma studio

   # Ir para model Enrollment
   # Editar uma matrícula e setar expiresAt para daqui 85 dias
   # (90 dias é o gatilho para enviar notificação)
   ```

2. **Executar cron job manualmente:**
   ```bash
   # No terminal
   curl -X POST http://localhost:3000/api/enrollment/check-expiration \
     -H "Content-Type: application/json" \
     -H "X-Cron-Secret: seu-cron-secret-aqui"
   ```

3. **Verificar email de expiração:**
   - Deve enviar email com aviso de expiração
   - Tema: laranja/vermelho gradiente
   - Conteúdo: oferta de upgrade vitalício

### ✅ Resultado Esperado:
- [x] Cron job identifica matrículas expirando
- [x] Email de aviso é enviado
- [x] Campo `notificationSentAt` é atualizado
- [x] Link de upgrade funciona

---

## 🐛 Troubleshooting

### Email não está sendo enviado (mas deveria)

1. **Verificar RESEND_API_KEY:**
   ```bash
   echo $RESEND_API_KEY
   # Deve mostrar algo como: re_xxxxxxxxxx
   ```

2. **Verificar logs do servidor:**
   - Procurar por "❌ Erro ao enviar email"
   - Ver mensagem de erro específica

3. **Testar Resend diretamente:**
   - Acessar: https://resend.com/emails
   - Ver histórico de emails enviados
   - Verificar status e erros

### Email vai para SPAM

1. **Configurar SPF, DKIM, DMARC** no DNS do domínio
2. **Verificar domínio no Resend** completamente
3. **Não usar endereços @gmail/@yahoo em FROM**

### Link de verificação/reset não funciona

1. **Verificar NEXT_PUBLIC_BASE_URL:**
   ```bash
   # Deve estar correto no .env.local
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

2. **Verificar expiração do token:**
   - Verificação: 24 horas
   - Reset: 1 hora
   - Usar link dentro do prazo

3. **Verificar banco de dados:**
   ```bash
   npx prisma studio
   # Ver tabela User
   # Conferir campos verificationToken e verificationExpiry
   ```

### Rate Limit bloqueando testes

1. **Aguardar 15 minutos** entre testes múltiplos
2. **Ou resetar o servidor** (Ctrl+C e `npm run dev` de novo)
3. **Ou usar IPs diferentes** (modo incógnito ajuda em cookies)

---

## 📊 Checklist Final

Após executar todos os testes:

- [ ] Registro + verificação funciona end-to-end
- [ ] Reenvio de verificação funciona
- [ ] Esqueci senha funciona end-to-end
- [ ] Emails têm design profissional
- [ ] Links expiram corretamente
- [ ] Rate limiting protege endpoints
- [ ] Logs aparecem no console (dev)
- [ ] Emails reais são enviados (produção)

---

## 🚀 Próximos Passos

Após validar os testes acima:

1. **Deploy em staging/produção**
2. **Configurar RESEND_API_KEY em produção**
3. **Configurar cron job no Vercel** (já está em vercel.json)
4. **Monitorar logs de email** no painel Resend
5. **Ajustar templates** se necessário (lib/email.ts)

---

## 📝 Notas

- Todos os templates de email estão em: `lib/email.ts`
- Para customizar design: editar HTML/CSS nos templates
- Para mudar textos: editar strings nos templates
- Emails são responsivos (funcionam mobile + desktop)
