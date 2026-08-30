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
    // ── Catraca do design system ────────────────────────────────────────────
    // Barra a paleta crua do Tailwind, gradientes e vidro fosco nos arquivos
    // JÁ migrados para os tokens do DESIGN.md. É uma catraca de propósito: a
    // lista de `files` cresce a cada página migrada e nunca encolhe, então a
    // dívida só pode cair. Sem isto, a próxima página nova nasce fora do
    // sistema, que foi como a home, a busca e a /lei-14133 chegaram onde estão.
    //
    // Ao migrar uma página, acrescente o caminho dela aqui, no mesmo commit.
    // Tokens disponíveis (app/globals.css, bloco @theme): brand-*, surface-*,
    // ink-*, border-subtle, border-strong, amber-accent-*.
    files: [
      "app/page.tsx",
      "components/home/**/*.tsx",
      "components/layout/**/*.tsx",
      "app/lei-14133/**/*.tsx",
      "components/lei-14133/**/*.tsx",
      "app/(acervo)/jurisprudencia/**/*.tsx",
      "app/(acervo)/legislacao/**/*.tsx",
      "app/(acervo)/base-conhecimento/**/*.tsx",
      "app/(acervo)/glossario/**/*.tsx",
      "app/(acervo)/publicacoes/**/*.tsx",
      "app/(acervo)/blog/**/*.tsx",
      "app/novidades/**/*.tsx",
      "app/documento/**/*.tsx",
      "components/legislacao/**/*.tsx",
      "app/(acervo)/planos/**/*.tsx",
      "app/cursos/**/*.tsx",
      "app/sobre/**/*.tsx",
      "app/contato/**/*.tsx",
      "app/faq/**/*.tsx",
      "app/artigos/**/*.tsx",
      "app/busca/**/*.tsx",
      "app/login/**/*.tsx",
      "app/registro/**/*.tsx",
      "app/coming-soon/**/*.tsx",
      "app/termos/**/*.tsx",
      "app/privacidade/**/*.tsx",
      "components/NewsletterForm.tsx",
      "components/PWAProvider.tsx",
      "components/faq/**/*.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/(?:^|[\\s:])(?:bg|text|border|from|via|to|ring|divide|placeholder|decoration|outline|fill|stroke|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}(?![0-9])/]",
          message:
            "Cor crua do Tailwind. Use os tokens do design system: ink-* no texto, surface-* no fundo, border-subtle/strong nas bordas, brand-* na marca, e amber-accent-* apenas para referência a fonte oficial (DESIGN.md).",
        },
        {
          selector:
            "TemplateElement[value.raw=/(?:^|[\\s:])(?:bg|text|border|from|via|to|ring|divide|placeholder|decoration|outline|fill|stroke|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}(?![0-9])/]",
          message:
            "Cor crua do Tailwind em template literal. Use os tokens do design system (DESIGN.md).",
        },
        {
          selector: "Literal[value=/bg-gradient-to-|backdrop-blur/]",
          message:
            "Gradiente ou vidro fosco. O DESIGN.md constrói profundidade por tonalidade (surface-page, raised, deep), não por degradê nem blur.",
        },
        {
          selector: "TemplateElement[value.raw=/bg-gradient-to-|backdrop-blur/]",
          message:
            "Gradiente ou vidro fosco em template literal. Use tonalidade (DESIGN.md).",
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
    ignores: [
      "node_modules/**",
      ".next/**",
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
