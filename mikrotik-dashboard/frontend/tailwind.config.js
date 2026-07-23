/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#a855f7',
          pink: '#ec4899',
        },
      },
      boxShadow: {
        card: '0 4px 20px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
