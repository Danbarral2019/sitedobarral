# Remedição de desempenho — 31/08/2026

Substitui os números do relatório Lighthouse de **9 de maio de 2026** (desempenho
58, LCP 9,6s), citado no item 23 do plano de redesign. Aquele relatório está
velho em dois sentidos: foi rodado antes de o modo "em breve" ser ligado, e três
dos seus achados já não se sustentam.

## Disposição de cada achado de maio

| Achado de maio | Estado em 31/08/2026 |
|---|---|
| Compressão de texto desligada (169 KiB) | **Não procede mais.** A resposta vem em Brotli: 56.078 → 9.922 bytes no HTML da home, 82% de redução. |
| Política de cache ausente em 4 recursos | **Não procede mais.** `next.config.ts` define `immutable` para `/_next/static`, `/_next/image` e `/icons`, `no-store` para as famílias de API sensíveis e `s-maxage=300` para as idempotentes. |
| Erros de JavaScript no console ("Erro ao carregar depoimentos") | **Não reproduzido.** Zero erros no console da home com build de produção. |
| Múltiplos redirecionamentos, 9,47s | **Existe, mas custa ~1s, não 9,5s.** Medido abaixo. |
| 280 KiB de JavaScript não usado | **Procede, e é o que sobrou.** Medido abaixo. |

## Cadeia de redirecionamentos

Medida com `curl` contra produção:

| Origem | Resposta | Destino | Tempo |
|---|---|---|---|
| `http://profdanielbarral.com` | 308 | `https://profdanielbarral.com/` | 0,23s |
| `https://profdanielbarral.com` | 307 | `https://www.profdanielbarral.com/` | 0,44s |
| `http://www.profdanielbarral.com` | 308 | `https://www.profdanielbarral.com/` | 0,16s |
| `https://www.profdanielbarral.com` | **200** | — | 0,30s |

A suspeita da auditoria estava certa quanto à causa: é **apex → www na camada de
host**, não no `middleware.ts`. Quem digita o domínio sem `www` e sem `https`
paga três saltos, cerca de 0,9s somados — não os 9,47s do relatório, que
provavelmente incluíam o carregamento inteiro sob throttle móvel.

O salto `http → https` é inevitável na primeira visita, mas o site já envia
`Strict-Transport-Security` com `preload`. Se o domínio estiver na lista de
preload do Chrome, o navegador pula esse salto sozinho a partir da segunda
visita — vale conferir em <https://hstspreload.org>.

**O que resolveria o resto:** apontar o apex direto para `https://www` num único
salto, na configuração de domínio da Vercel. É mudança de configuração, não de
código, e por isso não está neste repositório.

## Composição da home real

Medida com build de produção local (`npm run start`), porque **em produção a home
está atrás do modo "em breve"** — o visitante recebe `/coming-soon`, então medir
o domínio hoje não mede a página que o relatório de maio mediu.

| | |
|---|---|
| Recursos | 30 |
| Total descomprimido | 1.011 KB |
| **JavaScript descomprimido** | **695 KB**, em 15 arquivos |
| CSS descomprimido | 217 KB, em 2 arquivos |
| Fontes | 97 KB, 2 arquivos |
| CLS | 0 |
| Erros de console | 0 |

Os quatro maiores:

| Arquivo | Descomprimido |
|---|---|
| `chunks/97391-*.js` | 402 KB |
| `css/31a65c13*.css` | 176 KB |
| `chunks/4bd1b696-*.js` (React) | 169 KB |
| woff2 (2 fontes) | 97 KB |

TTFB e `load` locais (9ms e 1.015ms) **não são comparáveis** ao Lighthouse móvel
com throttle e não devem ser citados como melhoria.

### Fontes: sem problema

Quatro famílias são declaradas no layout raiz (Source Serif 4, Inter, JetBrains
Mono e Lora), mas a home baixa **só duas**, e não há `<link rel=preload>`
forçando as demais. A Lora, usada apenas em `MarkdownContent.tsx`, não é baixada
na home. Não há ganho a extrair daqui.

### CSS: 176 KB, sem corte seguro à vista

1.004 custom properties, das quais 169 são `--color-*` e 746 são `--tw-*`
internas do Tailwind. São 1.797 blocos de regra. Chamam atenção 236 utilitários
de gradiente (`from-*`, `to-*`, `via-*`), que só existem porque o código usa
gradientes — que o design system proíbe. **Terminar o item 19 encolhe este
arquivo como efeito colateral.**

## O que ficou aberto, e por quê

O único item de código que sobra é o **chunk compartilhado de 402 KB**. Reduzi-lo
exige rodar o analisador de bundle (já configurado em `next.config.ts` via
`@next/bundle-analyzer`), identificar o que entra nele e mover import para
carregamento dinâmico. É um projeto com risco de regressão em site de produção,
não um ajuste — e por isso não foi feito junto desta remedição.

**Antes de mexer nisso, rode um Lighthouse novo**, com o modo "em breve"
desligado ou com bypass, para ter um número comparável ao de maio. Sem isso não
há como saber se o trabalho melhorou algo.
