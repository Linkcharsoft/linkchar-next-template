/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin'

export const content = ['./src/**/*.{html,js,ts,jsx,tsx}']

export const theme = {
  extend: {
    colors: {
      'surface-50': '#FAFAFA',
      'surface-100': '#F5F5F5',
      'surface-200': '#EEEEEE',
      'surface-300': '#E0E0E0',
      'surface-400': '#BDBDBD',
      'surface-500': '#9E9E9E',
      'surface-600': '#757575',
      'surface-700': '#616161',
      'surface-800': '#424242',
      'surface-900': '#212121',
    },
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
