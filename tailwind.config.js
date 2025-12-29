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
    fontSize: {
      48: '48px',
      44: '44px',
      40: '40px',
      36: '36px',
      32: '32px',
      28: '28px',
      24: '24px',
      20: '20px',
      18: '18px',
      16: '16px',
      14: '14px',
      12: '12px',
      10: '10px'
    },
    screens: {
      '2xs': '375px',
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1420px'
    }
  }
}

export const plugins = [
  plugin(({ addComponents }) => {
    const sizes = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64]

    const generateStyles = (namePrefix, fontWeight, fontStyle = 'normal', lineHeight = null) => {
      return Object.fromEntries(
        sizes.map(size => {
          const className = `.${namePrefix}-${size}`
          const style = {
            fontSize: `${size}px`,
            fontWeight: fontWeight,
            fontStyle: fontStyle
          }
          if (lineHeight) {
            style.lineHeight = lineHeight
          }
          return [className, style]
        })
      )
    }

    addComponents({
      /* Extra bold (800) */
      ...generateStyles('text-extrabold', '800'),

      /* Bold (700) */
      ...generateStyles('text-bold', '700'),

      /* Demi (600) */
      ...generateStyles('text-semibold', '600'),

      /* Regular (500) */
      ...generateStyles('text-medium', '500'),

      /* Regular (400) */
      ...generateStyles('text-regular', '400'),

      /* Light (300) */
      ...generateStyles('text-light', '300'),
    })
  })
]