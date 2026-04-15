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
        // Naranja construcción — acento principal
        primary: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Acero — header, bordes, texto oscuro
        steel: {
          50:  '#f8f9fb',
          100: '#eaedf1',
          200: '#d0d6de',
          300: '#a8b3bf',
          400: '#718496',
          500: '#526070',
          600: '#3d4a58',
          700: '#2d3848',
          800: '#1c2738',
          900: '#141d2b',
          950: '#0c121c',
        },
        // Concreto — fondos y superficies
        concrete: {
          50:  '#fafaf8',
          100: '#f0eeea',
          200: '#e2dfd9',
          300: '#c8c4bc',
          400: '#a8a39a',
          500: '#888279',
          600: '#716b62',
          700: '#5c5750',
          800: '#4c4843',
          900: '#403d39',
        },
      },
      boxShadow: {
        'steel':    '0 1px 3px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.10)',
        'steel-md': '0 4px 12px rgba(0,0,0,0.18), 0 2px 4px rgba(0,0,0,0.10)',
        'steel-lg': '0 10px 30px rgba(0,0,0,0.22), 0 4px 8px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};
