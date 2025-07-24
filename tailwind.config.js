/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        json: {
          string: '#3B82F6',
          number: '#F59E0B',
          boolean: '#10B981',
          null: '#6B7280',
          key: '#374151',
        }
      },
      animation: {
        'expand': 'expand 0.2s ease-out',
        'collapse': 'collapse 0.2s ease-out',
      },
      keyframes: {
        expand: {
          '0%': { opacity: '0', height: '0' },
          '100%': { opacity: '1', height: 'auto' },
        },
        collapse: {
          '0%': { opacity: '1', height: 'auto' },
          '100%': { opacity: '0', height: '0' },
        },
      },
    },
  },
  plugins: [],
}