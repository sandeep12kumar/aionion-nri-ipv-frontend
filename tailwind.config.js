/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Aionion blue, from the logo (#0123ff).
        brand: {
          50: '#eef1ff', 100: '#dfe5ff', 200: '#c3ccff', 300: '#99a8ff', 400: '#6375ff',
          500: '#3048ff', 600: '#0f2ff0', 700: '#0a24c9', 800: '#0d209e', 900: '#111e78',
        },
        // Aionion coral, from the logo (#fe667b).
        accent: {
          50: '#fff1f3', 100: '#ffe1e6', 200: '#ffc7d0', 400: '#ff8597', 500: '#fe667b', 600: '#ec4660', 700: '#c72e48',
        },
        page: '#f6f7fb',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -12px rgba(15, 23, 42, 0.10)',
        button: '0 6px 14px -6px rgba(15, 47, 240, 0.55)',
      },
    },
  },
  plugins: [],
};
