# Assistente de Publicação Manual

**Data de Implementação:** 24/01/2025

## Visão Geral

Sistema simplificado para preparação manual de publicações nas redes sociais, substituindo a integração automática por APIs. Essa abordagem elimina a complexidade de manutenção de tokens de API, limitações de requisições e problemas de configuração, mantendo os benefícios de padronização e eficiência.

## Motivação

A integração automática com APIs de redes sociais (Instagram Graph API, LinkedIn API) apresentava desafios significativos:

- **Complexidade técnica**: Configuração de tokens, OAuth, permissões
- **Manutenção contínua**: Tokens que expiram (60 dias no Instagram), renovações
- **Limitações das APIs**: Requisições por hora, restrições de conteúdo
- **Mudanças frequentes**: APIs mudam sem aviso prévio
- **Relação custo-benefício**: Alto esforço de manutenção vs benefício real

## Solução: Assistente Manual

Sistema que **prepara** o conteúdo mas deixa a **publicação** nas mãos do usuário, oferecendo:

✅ Textos otimizados e padronizados automaticamente
✅ Imagens Open Graph geradas automaticamente
✅ Botões de copiar com um clique
✅ ZERO configuração de APIs
✅ ZERO manutenção técnica
✅ Controle total sobre quando e como publicar
✅ Muito mais rápido que escrever posts do zero

## Fluxo de Trabalho

### Passo 1: Acessar o Assistente

1. Acesse o painel admin em `/admin/blog`
2. Na listagem de posts, clique no ícone **roxo de compartilhar** (Share2) ao lado do post desejado
3. Você será redirecionado para `/admin/assistente-social?postId=XXX`

### Passo 2: Revisar e Personalizar

O assistente mostra automaticamente:

**Informações do Post:**
- Título
- Resumo (excerpt)
- Status (publicado/rascunho)
- Link para visualizar no site

**Imagem Open Graph:**
- Preview da imagem gerada automaticamente
- Botão para abrir/baixar a imagem
- Formato otimizado para redes sociais (1200x630px)

**Textos Otimizados:**

1. **Instagram** (casual, com hashtags):
   - Título do post
   - Resumo/excerpt
   - Emoji 📖 + link do artigo
   - Hashtags relevantes (#DireitoAdministrativo, #Licitacoes, etc.)
   - Máximo ~2200 caracteres

2. **LinkedIn** (profissional):
   - Título do post
   - Resumo/excerpt
   - Emoji 🔗 + link do artigo
   - Hashtags mais formais
   - Tom mais profissional

**Campos editáveis:**
- Você pode editar ambos os textos diretamente nos campos de texto antes de copiar
- Personalize hashtags, adicione emojis, ajuste o tom

### Passo 3: Copiar e Publicar

**Para Instagram:**
1. Clique em **"Copiar Texto"** no card roxo do Instagram
2. Abra o Instagram no celular ou desktop
3. Crie um novo post
4. Cole o texto copiado
5. Adicione a imagem (baixada do assistente)
6. Publique!

**Para LinkedIn:**
1. Clique em **"Copiar Texto"** no card azul do LinkedIn
2. Abra o LinkedIn
3. Crie uma nova publicação
4. Cole o texto copiado
5. Adicione a imagem (baixada do assistente)
6. Publique!

**Feedback visual:**
- Ao copiar, o botão muda para "Copiado!" por 2 segundos
- Toast de confirmação aparece no canto da tela

## Estrutura Técnica

### Arquivos Criados/Modificados

**Novo:**
- `/app/admin/assistente-social/page.tsx` - Interface do assistente

**Modificado:**
- `/app/admin/blog/page.tsx` - Adicionado botão Share2 na listagem

**Mantido (não usado mais para publicação automática):**
- `/lib/instagram.ts` - Funções de formatação de texto ainda úteis
- `/lib/linkedin.ts` - Funções de formatação de texto ainda úteis
- `/lib/social-publisher.ts` - Pode ser removido ou simplificado no futuro

### API Endpoints Utilizados

- `GET /api/admin/blog-posts/[id]` - Buscar dados do post
- `GET /api/og/[slug]` - Gerar imagem Open Graph (já existente)

### Componentes UI

- **Layout:** `AdminLayout` (padrão do admin)
- **Icons:** Lucide React (Instagram, Linkedin, Share2, Copy, Check, etc.)
- **Toast:** Hook `useToast` para notificações
- **Navigation:** Next.js Link e useRouter

## Vantagens vs Sistema Anterior

| Aspecto | Sistema Anterior (Auto) | Sistema Novo (Manual) |
|---------|-------------------------|----------------------|
| Configuração | Complexa (tokens, OAuth) | Nenhuma |
| Manutenção | Alta (renovar tokens) | Zero |
| Confiabilidade | Sujeita a falhas de API | 100% confiável |
| Controle | Automático (menos controle) | Total controle |
| Velocidade | Rápido (mas falha às vezes) | Rápido (copiar/colar) |
| Personalização | Limitada | Total antes de copiar |
| Custos | APIs pagas no futuro? | Zero |
| Aprendizado | Alto (APIs complexas) | Baixo (copiar/colar) |

## Formato dos Textos Gerados

### Instagram

```
[Título do Post]

[Resumo/Excerpt do Post]

📖 Leia o artigo completo em:
[URL do post]

#DireitoAdministrativo #Licitacoes #ContratosPublicos #DireitoPublico #Concursos #Lei14133 #NovaLeiDeLicitacoes #DireitoParaConcursos
```

### LinkedIn

```
[Título do Post]

[Resumo/Excerpt do Post]

🔗 Leia o artigo completo: [URL do post]

#DireitoAdministrativo #Licitações #DireitoPublico
```

## Personalização

### Editar Hashtags

Você pode adicionar ou remover hashtags diretamente no campo de texto antes de copiar:

**Instagram (sugestões):**
- Gerais: #DireitoAdministrativo, #Licitacoes, #DireitoPublico
- Específicas: #Lei14133, #PNCP, #ContratosAdministrativos
- Concursos: #Concursos, #EstudandoDireito, #DireitoParaConcursos
- Engajamento: #DicasDeDireito, #AprendendoDireito

**LinkedIn (mais formais):**
- #DireitoAdministrativo, #Licitações, #DireitoPublico
- #GestãoPública, #AdministraçãoPública, #ComprasPublicas
- #CarreiraPublica, #ServidorPublico

### Ajustar Tom

- **Instagram**: Mais casual, emojis liberados, linguagem próxima
- **LinkedIn**: Profissional, formal, foco em expertise e valor

## Melhores Práticas

### Horários de Publicação

**Instagram:**
- Terça a Quinta: 9h-11h ou 17h-19h
- Evite: Finais de semana e feriados

**LinkedIn:**
- Terça a Quinta: 8h-10h ou 17h-18h
- Quarta-feira é o melhor dia

### Frequência

- **Não spam**: Máximo 1-2 posts por dia no Instagram
- **Consistência**: Melhor postar 3x/semana do que 10x em um dia
- **LinkedIn**: 2-5 posts por semana é ideal

### Imagens

- **Instagram**: Prefere quadrado (1:1) ou vertical (4:5)
- **LinkedIn**: Horizontal (16:9 ou 2:1) funciona bem
- A imagem OG gerada é 1200x630px (ótima para ambos)

### Engajamento

- Responda comentários nas primeiras 2 horas
- Faça perguntas nos posts para incentivar interação
- Use Stories do Instagram para reforçar posts

## Limpeza Futura (Opcional)

Arquivos que podem ser removidos se não forem mais necessários:

1. `/lib/social-publisher.ts` - Orquestrador de publicação automática
2. `/app/admin/redes-sociais/page.tsx` - Interface antiga de monitoramento
3. `/app/api/admin/social/*` - Endpoints de publicação automática
4. Dependências não usadas: verificar se alguma lib pode ser removida

**⚠️ Aviso:** Antes de remover, verifique se não há outras referências no código.

## Perguntas Frequentes

**P: E se eu quiser voltar para publicação automática?**
R: Todos os arquivos de integração foram mantidos. Basta reconfigurar os tokens nas variáveis de ambiente e usar a interface antiga em `/admin/redes-sociais`.

**P: A imagem OG é gerada toda vez?**
R: Sim, mas é cacheada pelo navegador. A geração é rápida (usa Vercel OG).

**P: Posso editar os textos antes de copiar?**
R: Sim! Os campos são editáveis. Personalize à vontade antes de copiar.

**P: E se o post não tiver imagem?**
R: A imagem OG é sempre gerada automaticamente com o título e branding do site.

**P: Funciona no celular?**
R: Sim, mas é mais prático usar no desktop para preparar e depois publicar no celular (especialmente Instagram).

## Suporte

Em caso de dúvidas ou problemas:

1. Verifique se o post existe e está acessível em `/admin/blog`
2. Teste se a imagem OG carrega acessando `/api/og/[slug-do-post]`
3. Use F12 (DevTools) para verificar erros no console
4. Contate o suporte técnico com prints da tela

---

**Implementado por:** Claude Code
**Data:** 24 de janeiro de 2025
**Versão:** 1.0
