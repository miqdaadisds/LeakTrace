/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#07111e',
          800: '#0c1b2f',
          700: '#132845',
          600: '#1b375e',
          500: '#254b7f',
          400: '#3b6ea8',
        },
        defence: {
          gold: '#dfb15b',
          amber: '#e69a28',
          crimson: '#c53030',
          emerald: '#10b981',
          cyan: '#06b6d4',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
