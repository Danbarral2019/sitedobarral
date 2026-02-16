import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Nova paleta brand - azul petroleo do manual de marca (#20364e)
        brand: {
          50: '#f0f4f7',
          100: '#d9e2ea',
          200: '#b3c5d5',
          300: '#8da8c0',
          400: '#5d8199',
          500: '#3a5a73',
          600: '#20364e', // Cor principal do manual
          700: '#1a2c3f',
          800: '#142230',
          900: '#0e1821',
          950: '#080d11',
        },
        // Manter primary como alias para brand (compatibilidade)
        primary: {
          50: '#f0f4f7',
          100: '#d9e2ea',
          200: '#b3c5d5',
          300: '#8da8c0',
          400: '#5d8199',
          500: '#3a5a73',
          600: '#20364e',
          700: '#1a2c3f',
          800: '#142230',
          900: '#0e1821',
          950: '#080d11',
        },
        // Azul vibrante para CTAs e destaques
        blue: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Cinza como cor complementar
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        // Amarelo/ambar suave para alertas
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        secondary: '#ffffff',
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'Poppins', 'system-ui', 'sans-serif'],
        serif: ['var(--font-cinzel)', 'Cinzel', 'Georgia', 'serif'],
        cinzel: ['var(--font-cinzel)', 'Cinzel', 'Georgia', 'serif'],
        poppins: ['var(--font-poppins)', 'Poppins', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-in-out',
        slideUp: 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;