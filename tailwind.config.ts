import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sbs: {
          navy:       '#1C374C',
          'navy-light': '#243F57',
          gold:       '#DDAD50',
          'gold-light': '#E8C472',
          cream:      '#E1D8B3',
          offwhite:   '#F7F5EF',
          gray:       '#5A6A75',
          black:      '#1A1A1A',
          border:     '#E0DDD5',
        },
        // keep alias so old upwork-green references resolve during migration
        upwork: {
          green: '#14a800',
          dark: '#1e1e2d',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
