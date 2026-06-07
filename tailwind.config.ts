import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        upwork: {
          green: '#14a800',
          dark: '#1e1e2d',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
