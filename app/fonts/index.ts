// Fontes auto-hospedadas (next/font/local). Os .woff2 desta pasta são os mesmos
// arquivos que o next/font/google baixava do Google Fonts a cada build: fontes
// variáveis (eixo wght), um arquivo por subset. Versioná-los tira o Google Fonts
// do caminho crítico do `next build` e do deploy.
//
// Cada subset é uma chamada `localFont` com sua própria unicode-range, e todas as
// chamadas de uma família declaram o mesmo `font-family`. O navegador monta uma
// família composta e só baixa um subset quando a página usa um caractere da faixa,
// exatamente como no CSS do Google Fonts. A chamada do subset latin, a última de
// cada família (mesma ordem do CSS do Google), é a que expõe a variável CSS, é
// pré-carregada e gera a fonte de fallback com métricas ajustadas.
//
// next/font exige que cada chamada seja uma declaração literal no escopo do
// módulo, por isso a repetição.
import localFont from "next/font/local";

// Source Serif 4 — display + reading. Substitui Cinzel.
// Só o subset "latin" é pré-carregado: cobre todos os acentos do português (ã, ç, ó etc.).
// Os demais subsets só são baixados se a página usar um caractere da faixa (unicode-range).
export const sourceSerifCyrillicExt = localFont({
  src: "./source-serif-4-cyrillic-ext.woff2",
  weight: "400 700",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'Source Serif 4'" },
    { prop: "unicode-range", value: "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const sourceSerifCyrillic = localFont({
  src: "./source-serif-4-cyrillic.woff2",
  weight: "400 700",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'Source Serif 4'" },
    { prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const sourceSerifGreek = localFont({
  src: "./source-serif-4-greek.woff2",
  weight: "400 700",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'Source Serif 4'" },
    { prop: "unicode-range", value: "U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const sourceSerifVietnamese = localFont({
  src: "./source-serif-4-vietnamese.woff2",
  weight: "400 700",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'Source Serif 4'" },
    { prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const sourceSerifLatinExt = localFont({
  src: "./source-serif-4-latin-ext.woff2",
  weight: "400 700",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'Source Serif 4'" },
    { prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const sourceSerif = localFont({
  src: "./source-serif-4-latin.woff2",
  weight: "400 700",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'Source Serif 4'" },
    { prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
  ],
  display: "swap",
  variable: "--font-serif",
  adjustFontFallback: "Times New Roman",
});

// Inter — UI/sans. Substitui Poppins.
export const interCyrillicExt = localFont({
  src: "./inter-cyrillic-ext.woff2",
  weight: "400 700",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'Inter'" },
    { prop: "unicode-range", value: "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const interCyrillic = localFont({
  src: "./inter-cyrillic.woff2",
  weight: "400 700",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'Inter'" },
    { prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const interGreekExt = localFont({
  src: "./inter-greek-ext.woff2",
  weight: "400 700",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'Inter'" },
    { prop: "unicode-range", value: "U+1F00-1FFF" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const interGreek = localFont({
  src: "./inter-greek.woff2",
  weight: "400 700",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'Inter'" },
    { prop: "unicode-range", value: "U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const interVietnamese = localFont({
  src: "./inter-vietnamese.woff2",
  weight: "400 700",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'Inter'" },
    { prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const interLatinExt = localFont({
  src: "./inter-latin-ext.woff2",
  weight: "400 700",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'Inter'" },
    { prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const inter = localFont({
  src: "./inter-latin.woff2",
  weight: "400 700",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'Inter'" },
    { prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
  ],
  display: "swap",
  variable: "--font-sans",
  adjustFontFallback: "Arial",
});

// JetBrains Mono — números de artigo, citações técnicas, códigos.
export const jetbrainsMonoCyrillicExt = localFont({
  src: "./jetbrains-mono-cyrillic-ext.woff2",
  weight: "400 500",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'JetBrains Mono'" },
    { prop: "unicode-range", value: "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const jetbrainsMonoCyrillic = localFont({
  src: "./jetbrains-mono-cyrillic.woff2",
  weight: "400 500",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'JetBrains Mono'" },
    { prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const jetbrainsMonoGreek = localFont({
  src: "./jetbrains-mono-greek.woff2",
  weight: "400 500",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'JetBrains Mono'" },
    { prop: "unicode-range", value: "U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const jetbrainsMonoVietnamese = localFont({
  src: "./jetbrains-mono-vietnamese.woff2",
  weight: "400 500",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'JetBrains Mono'" },
    { prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const jetbrainsMonoLatinExt = localFont({
  src: "./jetbrains-mono-latin-ext.woff2",
  weight: "400 500",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'JetBrains Mono'" },
    { prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
export const jetbrainsMono = localFont({
  src: "./jetbrains-mono-latin.woff2",
  weight: "400 500",
  style: "normal",
  declarations: [
    { prop: "font-family", value: "'JetBrains Mono'" },
    { prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
  ],
  display: "swap",
  variable: "--font-mono",
  adjustFontFallback: "Arial",
});
