import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Test files rely on pass-through mock helpers where `any` is the pragmatic
    // choice (untyped Request shims, vi.fn() spreads of (...args: any[])).
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // ─────────────────────────────────────────────────────────────────────
    // Guarda do design system.
    //
    // Em 31/08/2026 o site público, os componentes e a área restrita foram
    // migrados para os tokens do DESIGN.md: 5.743 classes de cor crua caíram
    // para 831, e gradientes, sombras em repouso e vidro fosco chegaram a
    // zero. Sem esta regra, a próxima página nasce fora do sistema e em seis
    // meses a auditoria precisa ser refeita.
    //
    // Vermelho, verde, esmeralda e rosa ficam PERMITIDOS: a paleta não tem
    // essas cores e ali elas carregam função (erro de validação, sucesso).
    // Um erro em petróleo seria pior, não melhor.
    //
    // O admin fica de fora: são telas internas, ainda com 5.056 classes cruas,
    // e migrá-las não muda nada para quem visita ou assina.
    // ─────────────────────────────────────────────────────────────────────
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    ignores: ["app/admin/**", "components/admin/**", "**/__tests__/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/\\b(?:bg|text|border|from|to|via|ring|divide|fill|stroke|placeholder|caret|accent|outline|decoration)-(?:slate|gray|zinc|neutral|stone|orange|amber|yellow|lime|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\\d{2,3}\\b/]",
          message:
            "Cor fora da paleta. Use os tokens do design system (brand-*, surface-*, ink-*, border-*, amber-accent*). Vermelho e verde seguem permitidos onde sinalizam erro ou sucesso.",
        },
        {
          selector:
            "TemplateElement[value.raw=/\\b(?:bg|text|border|from|to|via|ring|divide|fill|stroke)-(?:slate|gray|zinc|neutral|stone|orange|amber|yellow|lime|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\\d{2,3}\\b/]",
          message:
            "Cor fora da paleta dentro de template literal. Use os tokens do design system.",
        },
        {
          selector: "Literal[value=/\\bbg-gradient-to-|\\bbg-linear-to-/]",
          message:
            "Gradiente de fundo. O sistema não usa: profundidade vem de tonalidade — empilhe surface-page, surface-raised e surface-deep.",
        },
        {
          selector: "Literal[value=/\\bshadow-(?:sm|md|lg|xl|2xl)\\b/]",
          message:
            "Sombra em repouso. Sombra é estado, não decoração: use border border-border-subtle.",
        },
        {
          selector: "Literal[value=/\\bbackdrop-blur/]",
          message: "Vidro fosco. O caderno do tribunal é papel, não vidro.",
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".claude/**",
      ".superpowers/**",
      "coverage/**",
      "docs/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "scripts/**",
      "FUNCIONALIDADES_FUTURAS/**",
      "test-static-image.js",
      // Internal tooling, not part of the web app bundle
      "eval/**",
      "mcp-server-gemini/**",
    ],
  },
];

export default eslintConfig;
