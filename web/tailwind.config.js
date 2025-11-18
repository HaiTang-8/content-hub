/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        border: 'hsl(214 32% 91%)',
        input: 'hsl(214 32% 91%)',
        ring: 'hsl(214 96% 78%)',
        background: '#f8fafc',
        foreground: '#0f172a',
        primary: {
          DEFAULT: '#4f46e5',
          foreground: '#f8fafc',
        },
        secondary: {
          DEFAULT: '#e2e8f0',
          foreground: '#0f172a',
        },
        muted: {
          DEFAULT: '#f1f5f9',
          foreground: '#64748b',
        },
        accent: {
          DEFAULT: '#6366f1',
          foreground: '#f8fafc',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#f8fafc',
        },
      },
      // 统一圆角来源，改动 CSS 变量即可在全局保持一致风格
      borderRadius: {
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'calc(var(--radius-lg) + 0.15rem)',
        '2xl': 'calc(var(--radius-lg) + 0.3rem)',
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        card: '0 15px 40px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
