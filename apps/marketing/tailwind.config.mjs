/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      // Speclyy brand tokens — update these as brand identity is defined
      colors: {
        brand: {
          50:  '#f0f9f4',
          100: '#dcf1e5',
          200: '#bbe3ce',
          300: '#8dcdb0',
          400: '#5bb18d',
          500: '#3a9472',   // primary green — adjust to final brand colour
          600: '#2d7a5d',
          700: '#27614c',
          800: '#234e3e',
          900: '#1e4134',
          950: '#10241d',
        },
        neutral: {
          // Override with design-system neutrals once locked
        },
      },
      fontFamily: {
        sans:  ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],  // optional editorial accent
      },
      animation: {
        'fade-up':     'fadeUp 0.5s ease forwards',
        'fade-in':     'fadeIn 0.4s ease forwards',
        'slide-right': 'slideRight 0.4s ease forwards',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideRight: {
          '0%':   { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
