/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#f6e2c1',
        'cream-dark': '#ead4a8',
        forest: '#4d6335',
        'forest-dark': '#3a4c28',
        'forest-deep': '#2d3d1f',
        'forest-light': '#5e7a3e',
        surface: '#faf7f2',
        'surface-muted': '#f0ebe2',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
