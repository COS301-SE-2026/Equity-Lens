/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      gridTemplateColumns: {
        'bento': 'repeat(12, 1fr)',
      },
      gridColumn: {
        'span-3': 'span 3 / span 3',
        'span-4': 'span 4 / span 4',
        'span-5': 'span 5 / span 5',
        'span-7': 'span 7 / span 7',
        'span-8': 'span 8 / span 8',
      },
    },
  },
  plugins: [],
}