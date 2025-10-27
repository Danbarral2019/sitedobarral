# 🌐 Conversor Web de Excel TCU

## 🎉 Nova Funcionalidade!

Agora você pode converter planilhas do TCU **diretamente no navegador**, sem precisar usar o terminal!

---

## 🚀 Como Acessar

### **Produção (Vercel):**
```
https://seu-dominio.vercel.app/admin/tcu-converter
```

### **Desenvolvimento Local:**
```
http://localhost:3000/admin/tcu-converter
```

---

## 📋 Passo a Passo

### **1. Acesse o Conversor**
- Faça login no admin
- Vá para: `/admin/tcu-converter`

### **2. Faça Upload do Excel do TCU**
- Clique na área de upload
- Selecione o arquivo `.xlsx` do TCU
- Arquivo aparece com nome e tamanho

### **3. Converta**
- Clique no botão azul "Converter Arquivo"
- Aguarde 2-10 segundos (dependendo do tamanho)
- ✅ Mensagem de sucesso aparece

### **4. Baixe o Resultado**
- Clique em "Baixar Excel Convertido"
- Arquivo é salvo como `TCU_Convertido_YYYY-MM-DD.xlsx`

### **5. Importe no Sistema**
- Clique em "Ir para Importação"
- Ou vá manualmente para `/admin/importar`
- Faça upload do arquivo convertido
- Valide e importe

---

## 🎯 O que o Conversor Faz?

### **Automaticamente:**
✅ Identifica cursos relevantes (pode ser múltiplos!)
✅ Gera tags dos metadados (TCU, Área, Tema, Legislação)
✅ Cria URLs oficiais do TCU
✅ Formata no padrão do sistema
✅ Gera 3 abas: Instruções, Dados, Estatísticas

### **Colunas Esperadas (Excel do TCU):**
- Enunciado
- Acórdão (número tipo "1234/2024")
- Área, Tema, Subtema
- Data, Autor da tese
- Legislação, Outros indexadores

---

## 💡 Vantagens da Versão Web

| Antes (Terminal) | Agora (Web) |
|------------------|-------------|
| ❌ Precisa abrir terminal | ✅ Apenas navegador |
| ❌ Precisa lembrar comando | ✅ Interface visual |
| ❌ Só no seu PC | ✅ Funciona em qualquer lugar |
| ❌ Precisa Node.js instalado | ✅ Sem instalação |
| ❌ Comandos complexos | ✅ Clique e pronto |

---

## 🔧 Tecnologia

### **Backend:**
- **Endpoint:** `POST /api/admin/convert-tcu`
- **Biblioteca:** `xlsx` (leitura/escrita de Excel)
- **Autenticação:** Admin obrigatório
- **Processamento:** Lado servidor (serverless function)

### **Frontend:**
- **Página:** `/admin/tcu-converter`
- **Framework:** Next.js 15 + React
- **UI:** Tailwind CSS + Lucide Icons
- **Upload:** FormData API

---

## 📊 Fluxo Técnico

```
1. Usuário faz upload (FormData)
   ↓
2. POST /api/admin/convert-tcu
   ↓
3. Servidor lê Excel com xlsx.read()
   ↓
4. Converte cada linha (identificação de cursos, tags, URLs)
   ↓
5. Gera novo Excel com 3 abas
   ↓
6. Retorna como download (blob)
   ↓
7. Frontend cria link de download
```

---

## 🛡️ Segurança

✅ **Autenticação obrigatória** (admin only)
✅ **Validação de arquivo** (apenas .xlsx/.xls)
✅ **Processamento no servidor** (não expõe lógica)
✅ **Nenhum dado é salvo** (apenas conversão e download)

---

## 📁 Arquivos Criados

1. **`app/api/admin/convert-tcu/route.ts`** (340 linhas)
   - Endpoint da API
   - Lógica de conversão (igual ao script local)
   - Retorna Excel como blob

2. **`app/admin/tcu-converter/page.tsx`** (245 linhas)
   - Interface web
   - Upload de arquivo
   - Download do resultado
   - Instruções e feedback visual

---

## 🎓 Exemplo de Uso

### **Cenário Real:**

**Você tem:** `TCU_Acordaos_2024.xlsx` (150 acórdãos)

**Passos:**
1. Acessar `/admin/tcu-converter`
2. Upload do arquivo
3. Clicar "Converter"
4. Baixar `TCU_Convertido_2025-01-27.xlsx`
5. Importar em `/admin/importar`
6. ✅ 150 acórdãos no sistema!

**Tempo total:** ~2 minutos

---

## 🆚 Comparação: Terminal vs Web

### **Quando usar o TERMINAL** (`npm run convert-tcu`):
- ✅ Você é desenvolvedor e já está no terminal
- ✅ Precisa automatizar (scripts, CI/CD)
- ✅ Conversões em lote (múltiplos arquivos)
- ✅ Integração com outros scripts

### **Quando usar a WEB** (`/admin/tcu-converter`):
- ✅ Você é admin/curador (não desenvolvedor)
- ✅ Acesso de qualquer lugar (até celular!)
- ✅ Interface visual mais amigável
- ✅ Não quer lidar com terminal
- ✅ **Produção no Vercel** (não tem terminal!)

---

## 🌟 Dica de Ouro

**Fluxo otimizado para curadoria:**

```
1. Baixar Excel do TCU
   ↓
2. /admin/tcu-converter (converter online)
   ↓
3. /admin/importar (validar e importar)
   ↓
4. /admin/documentos (revisar documentos)
   ↓
5. Gerar resumos com IA (novo!)
```

**Tudo no navegador, sem terminal!** 🎉

---

## 🐛 Troubleshooting

### Erro: "Nenhum dado encontrado"
- ✅ Verifique se o Excel tem dados
- ✅ Confirme que a primeira linha tem cabeçalhos
- ✅ Tente abrir o Excel antes para verificar

### Erro: "Erro ao converter"
- ✅ Verifique se o arquivo é .xlsx ou .xls
- ✅ Tente converter localmente primeiro (debug)
- ✅ Verifique os logs do servidor

### Upload não funciona
- ✅ Arquivo muito grande? Limite do Vercel: 4.5MB
- ✅ Formato correto? (.xlsx, não .csv)
- ✅ Tente arquivo menor para testar

### Download não inicia
- ✅ Desabilite bloqueador de pop-ups
- ✅ Verifique se navegador permite downloads
- ✅ Tente outro navegador

---

## 🚀 Próximas Melhorias (Futuro)

- [ ] Mostrar estatísticas na tela (sem precisar abrir Excel)
- [ ] Preview dos dados antes de baixar
- [ ] Edição inline de cursos/tags
- [ ] Conversão + importação em um clique
- [ ] Suporte para outros formatos (CSV, Google Sheets)
- [ ] Histórico de conversões

---

## 📞 Suporte

- 📖 **Guia completo:** `GUIA_IMPORTACAO_EXCEL_TCU.md`
- 📖 **Script local:** `scripts/convert-tcu-excel.js`
- 📖 **Fase 3 TCU:** `SESSAO_2025-01-26_FASE_3_TCU_SCRAPER.md`

---

## 🎯 Conclusão

**Você agora tem 2 opções para converter Excel do TCU:**

1. **Terminal:** `npm run convert-tcu arquivo.xlsx`
2. **Web:** `/admin/tcu-converter` ⭐ **NOVO!**

**Ambas fazem exatamente a mesma coisa!**
**Use a que for mais conveniente para você.** 😊

---

**Data:** 27/01/2025
**Versão:** 1.0.0
**Status:** ✅ PRODUCTION READY
**Ambiente:** Funciona em dev e produção (Vercel)
