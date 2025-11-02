# 🎥 Guia de Gravação do Vídeo
## Prof. Daniel Barral - Demonstração da Plataforma

---

## ✅ PRÉ-REQUISITOS

- [x] Servidor de desenvolvimento rodando (`npm run dev`)
- [x] Banco de dados populado com **134 documentos** de exemplo
- [x] Usuário de teste criado: `aluno@teste.com` / `aluno123`
- [x] Browser em tela cheia (recomendado: Chrome)
- [x] Resolução: 1920x1080 (Full HD)

---

## 📍 PÁGINAS PARA GRAVAR (NA ORDEM)

### 1. PÁGINA INICIAL
**URL:** http://localhost:3000

**O que mostrar:**
- ✅ Banner hero com foto do professor
- ✅ 3 cards de benefícios
- ✅ Seção de cursos em destaque (3 primeiros)
- ✅ Carrossel de depoimentos (se houver)
- ✅ Formulário de newsletter
- ✅ Footer com links

**Dicas de gravação:**
- Scroll suave de cima para baixo
- Pause 2-3 segundos em cada seção
- Destaque o botão "Área do Aluno"

---

### 2. PÁGINA DE VALIDAÇÃO QR CODE
**URL:** http://localhost:3000/validar-acesso

**O que mostrar:**
- ✅ Formulário de validação
- ✅ Campo para digitar código QR
- ✅ Mensagem explicativa

**Dicas de gravação:**
- Não precisa validar um código de verdade
- Apenas mostre a interface
- Pode simular hover no botão

---

### 3. PÁGINA DE LOGIN
**URL:** http://localhost:3000/login

**O que mostrar:**
- ✅ Formulário de login
- ✅ Campos email e senha
- ✅ Link "Esqueci minha senha"
- ✅ Link para registro

**Ação:**
- **FAZER LOGIN** com `aluno@teste.com` / `aluno123`
- Isso te levará para a Área Restrita

---

### 4. ÁREA RESTRITA - VISÃO GERAL ⭐ PRINCIPAL
**URL:** http://localhost:3000/area-restrita

**O que mostrar:**
- ✅ Banner de status da matrícula (verde = ativo)
- ✅ Filtros: Curso, Categoria, Tipo, Busca
- ✅ Lista de documentos (deve mostrar ~100+ documentos)
- ✅ Cards de documentos com:
  - Ícone da categoria
  - Título
  - Descrição
  - Tags
  - Botões de ação (Ver, Baixar, Favoritar)

**Ações para demonstrar:**
1. **Filtrar por categoria:**
   - Click no dropdown "Categoria"
   - Selecione "Acórdãos TCU" (deve mostrar 6 acórdãos)
   - Selecione "Orientações Normativas" (deve mostrar 99 ONs!)
   - Selecione "Apostilas" (deve mostrar ~10)

2. **Filtrar por curso:**
   - Click no dropdown "Curso"
   - Selecione "Nova Lei de Licitações"
   - Documentos filtrados aparecem

3. **Buscar:**
   - Digite "licitação" na barra de busca
   - Resultados aparecem em tempo real

4. **Ver detalhes de um documento:**
   - Click em "Ver Detalhes" em qualquer card
   - Modal abre mostrando:
     - Título completo
     - Descrição
     - Tags
     - Botão "Baixar PDF" ou "Acessar Link"
     - Botão "Adicionar aos Favoritos"
     - Botão "Gerar Resumo com IA" (se disponível)

**Dicas de gravação:**
- Esta é a página MAS IMPORTANTE!
- Gaste 60-90 segundos aqui
- Mostre a diversidade de documentos
- Demonstre os filtros funcionando

---

### 5. FAVORITOS
**URL:** http://localhost:3000/area-restrita/favoritos

**O que mostrar:**
- ✅ Lista de favoritos (pode estar vazia)
- ✅ Mensagem "Nenhum favorito ainda" (se vazio)
- ✅ Interface para gerenciar favoritos

**Ação:**
1. Volte para /area-restrita
2. Click na "estrela" de um documento para favoritar
3. Volte para /area-restrita/favoritos
4. O documento favoritado deve aparecer

---

### 6. HISTÓRICO DE ACESSOS
**URL:** http://localhost:3000/area-restrita/historico

**O que mostrar:**
- ✅ Lista de documentos visualizados/baixados
- ✅ Data e hora de cada acesso
- ✅ Tipo de ação (visualizou, baixou)

**Dicas:**
- Deve ter registros dos documentos que você abriu
- Mostra rastreamento completo

---

### 7. PÁGINA DE CURSOS
**URL:** http://localhost:3000/cursos

**O que mostrar:**
- ✅ Grid com os 10 cursos
- ✅ Cards de cada curso com:
  - Ícone
  - Título
  - Descrição breve
  - Botão "Ver Detalhes"

**Ação:**
- Click em um curso (ex: "Nova Lei de Licitações")
- Vai para página do curso individual

---

### 8. PÁGINA DE CURSO INDIVIDUAL
**URL:** http://localhost:3000/cursos/nova-lei-licitacoes

**O que mostrar:**
- ✅ Banner do curso
- ✅ Descrição completa
- ✅ **BIBLIOGRAFIA (sempre pública!)**
- ✅ Lista de livros, artigos, sites recomendados

**Dicas:**
- Destaque que a bibliografia é PÚBLICA
- Scroll pela lista de referências
- Pause para mostrar detalhes

---

### 9. BLOG
**URL:** http://localhost:3000/blog

**O que mostrar:**
- ✅ Lista de artigos publicados
- ✅ Cards com:
  - Imagem destacada (se houver)
  - Título
  - Excerpt
  - Data de publicação
  - Autor

**Ação:**
- Click em um artigo para abrir

---

### 10. ARTIGO DO BLOG
**URL:** http://localhost:3000/blog/[slug]

**O que mostrar:**
- ✅ Título completo
- ✅ Data e autor
- ✅ Conteúdo formatado em markdown
- ✅ Navegação de artigos relacionados

---

### 11. PUBLICAÇÕES
**URL:** http://localhost:3000/publicacoes

**O que mostrar:**
- ✅ Filtros por tipo (Livros, Artigos, Notícias)
- ✅ Lista de publicações acadêmicas
- ✅ Detalhes de cada publicação

---

### 12. CONTATO
**URL:** http://localhost:3000/contato

**O que mostrar:**
- ✅ Formulário de contato
- ✅ Campos: Nome, Email, Assunto, Mensagem
- ✅ Informações de contato do professor

**Dicas:**
- Não precisa enviar o formulário
- Apenas mostre a interface

---

### 13. SOBRE
**URL:** http://localhost:3000/sobre

**O que mostrar:**
- ✅ Foto do professor
- ✅ Biografia
- ✅ Formação acadêmica
- ✅ Experiência profissional

---

## 🎬 SEQUÊNCIA RECOMENDADA DE GRAVAÇÃO

### **PARTE 1: Primeiro Acesso (1 min)**
1. Página inicial → Scroll suave
2. Click "Área do Aluno" → Vai para Login
3. Fazer login com `aluno@teste.com` / `aluno123`

### **PARTE 2: Área Restrita (2 min)** ⭐ CORE
4. Área Restrita → Mostrar filtros
5. Filtrar por categoria "Acórdãos TCU"
6. Filtrar por categoria "Orientações Normativas"
7. Buscar "licitação"
8. Abrir detalhes de 1-2 documentos
9. Favoritar um documento
10. Ir para Favoritos → Ver documento favoritado
11. Ir para Histórico → Ver acessos registrados

### **PARTE 3: Conteúdo Público (1 min)**
12. Ir para Cursos → Mostrar grid
13. Click em curso → Mostrar bibliografia pública
14. Ir para Blog → Mostrar artigos
15. Click em artigo → Mostrar conteúdo

### **PARTE 4: Finalização (30s)**
16. Ir para Contato → Mostrar formulário
17. Voltar para Página Inicial → Encerramento

---

## 📊 ESTATÍSTICAS DO BANCO (para narração)

**Total de documentos:** 134

**Por categoria:**
- Orientações Normativas (ON): 99
- Apostilas/Material: ~10
- Acórdãos TCU: 6
- Pareceres AGU: 4
- Editais/Modelos: 6
- Artigos: 4
- Outros/Legislação: 3

**Por curso:**
- Nova Lei de Licitações: ~20 documentos
- Todos os 10 cursos têm conteúdo

---

## 🎨 CONFIGURAÇÕES DE GRAVAÇÃO

### **Software recomendado:**
- **OBS Studio** (gratuito): https://obsproject.com
- **Camtasia** (pago): https://www.techsmith.com/video-editor.html
- **Loom** (web): https://www.loom.com (rápido e fácil)

### **Configurações OBS:**
```
Resolução: 1920x1080 (Full HD)
FPS: 30
Bitrate: 6000 kbps
Encoder: x264 ou NVENC (GPU)
Formato: MP4
```

### **Browser:**
- Tela cheia (F11)
- Zoom: 100%
- Ocultar bookmarks bar
- Modo anônimo (sem extensões)

---

## 💡 DICAS PROFISSIONAIS

### **Durante a gravação:**
1. ✅ Movimentos de mouse LENTOS e suaves
2. ✅ Pause 2-3 segundos em cada elemento importante
3. ✅ Evite clicks rápidos ou erráticos
4. ✅ Scroll suave (não muito rápido)
5. ✅ Não fale durante a gravação (só narração depois)

### **Elementos para destacar:**
- ⭐ Filtros inteligentes
- ⭐ Diversidade de documentos
- ⭐ Interface limpa e organizada
- ⭐ Facilidade de navegação
- ⭐ Bibliografia sempre pública

### **Evite:**
- ❌ Mostrar erros ou páginas vazias
- ❌ Movimentos muito rápidos
- ❌ Clicks fora de elementos
- ❌ Scroll descontrolado

---

## 🎤 ROTEIRO DE NARRAÇÃO

Use o arquivo `ROTEIRO_SYNTHESIA.md` para narração completa sincronizada com as cenas.

---

## ✅ CHECKLIST PRÉ-GRAVAÇÃO

Antes de começar, verifique:

- [ ] Servidor rodando em http://localhost:3000
- [ ] Login funcionando (`aluno@teste.com` / `aluno123`)
- [ ] Documentos carregando na Área Restrita
- [ ] Filtros funcionando corretamente
- [ ] Browser em tela cheia
- [ ] Resolução 1920x1080
- [ ] OBS ou software de gravação configurado
- [ ] Mouse com movimentos suaves
- [ ] Notificações do sistema desativadas
- [ ] Fundo de tela limpo (se gravar desktop)

---

## 📹 PÓS-GRAVAÇÃO

### **Edição:**
1. Cortar erros e pausas longas
2. Adicionar transições suaves entre cenas
3. Adicionar textos destacados (veja roteiro Synthesia)
4. Adicionar música de fundo (20-30% volume)
5. Sincronizar narração

### **Exportação:**
- Formato: MP4
- Resolução: 1920x1080
- Codec: H.264
- Qualidade: High
- Taxa de bits: 8-10 Mbps

---

## 🚀 PRÓXIMOS PASSOS

Após gravar e editar:

1. ✅ Upload no YouTube (não listado para revisão)
2. ✅ Compartilhar com 2-3 alunos para feedback
3. ✅ Fazer ajustes se necessário
4. ✅ Publicar como público
5. ✅ Incorporar no site (página inicial ou modal de boas-vindas)
6. ✅ Compartilhar nas redes sociais
7. ✅ Enviar para lista de alunos via email

---

**BOA GRAVAÇÃO! 🎬✨**

Qualquer dúvida, consulte o `ROTEIRO_VIDEO_EXPLICATIVO.md` ou `ROTEIRO_SYNTHESIA.md`.
