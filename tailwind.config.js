/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin'

export const content = ['./src/**/*.{html,js,ts,jsx,tsx}']

export const theme = {
  extend: {
    animation: {
      customLoading: 'customLoading 1.2s ease-in-out infinite both'
    },
    keyframes: {
      customLoading: {
        '0%, 20%, 80%, 100%': {
          opacity: '1',
          backgroundColor: 'rgba(234,235,236,255)'
        },
        '50%': {
          opacity: '1',
          transform: 'scale(1.3)',
          backgroundColor: '#9A5FE8'
        }
      }
    }
  }
}

export const plugins = [
  plugin(({ matchUtilities, theme }) => {
    matchUtilities(
      {
        'animation-delay': (value) => {
          return {
            'animation-delay': value
          }
        }
      },
      {
        values: theme('transitionDelay')
      }
    )
  })
]
