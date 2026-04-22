/**
 * Speclyy Tailwind preset — surfaces design tokens as utilities.
 * Hex values mirror src/styles/tokens.css exactly.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        paper: {
          0:   '#FFFFFF',
          50:  '#FAF7F2',
          100: '#F3EEE6',
          200: '#E8E1D5',
          300: '#D6CDBD',
        },
        ink: {
          900: '#1A1814',
          800: '#2A2620',
          700: '#45403A',
          600: '#6B6558',
          500: '#928B7C',
          400: '#B3AC9E',
          300: '#CFC8BB',
        },
        terracotta: {
          50:  '#FBF1EB',
          100: '#F5DDCC',
          300: '#E5A684',
          500: '#C06B3E',
          600: '#A3552B',
          700: '#7E4020',
        },
        sage: {
          50:  '#EFF2EC',
          300: '#B4C1A4',
          500: '#6E8A5C',
          700: '#4A6340',
        },
        status: {
          complete: '#6E8A5C',
          tbd:      '#C69650',
          missing:  '#B85C4E',
        },
        // Semantic aliases
        app:       '#FAF7F2',
        surface:   '#FFFFFF',
        subtle:    '#F3EEE6',
        inverse:   '#1A1814',
        accent:    '#C06B3E',
        'accent-hover':   '#A3552B',
        'accent-pressed': '#7E4020',
      },
      fontFamily: {
        display: ['Fraunces', 'Cormorant Garamond', 'Times New Roman', 'serif'],
        sans:    ['Inter Tight', 'ui-sans-serif', '-apple-system', 'system-ui', 'sans-serif'],
        body:    ['Inter Tight', 'ui-sans-serif', '-apple-system', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        12: ['0.75rem',   { lineHeight: '1.45' }],
        13: ['0.8125rem', { lineHeight: '1.45' }],
        14: ['0.875rem',  { lineHeight: '1.45' }],
        15: ['0.9375rem', { lineHeight: '1.45' }],
        16: ['1rem',      { lineHeight: '1.45' }],
        18: ['1.125rem',  { lineHeight: '1.45' }],
        20: ['1.25rem',   { lineHeight: '1.3' }],
        24: ['1.5rem',    { lineHeight: '1.2' }],
        28: ['1.75rem',   { lineHeight: '1.2' }],
        32: ['2rem',      { lineHeight: '1.15' }],
        40: ['2.5rem',    { lineHeight: '1.1' }],
        48: ['3rem',      { lineHeight: '1.05' }],
        64: ['4rem',      { lineHeight: '1.02' }],
        80: ['5rem',      { lineHeight: '1' }],
        96: ['6rem',      { lineHeight: '1' }],
      },
      letterSpacing: {
        tighter: '-0.03em',
        tight:   '-0.015em',
        normal:  '0',
        wide:    '0.04em',
        wider:   '0.12em',
      },
      borderRadius: {
        xs:   '4px',
        sm:   '6px',
        md:   '10px',
        lg:   '16px',
        xl:   '24px',
        pill: '999px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(26,24,20,0.04)',
        sm: '0 1px 2px rgba(26,24,20,0.04), 0 2px 6px rgba(26,24,20,0.04)',
        md: '0 2px 4px rgba(26,24,20,0.04), 0 8px 20px rgba(26,24,20,0.06)',
        lg: '0 4px 8px rgba(26,24,20,0.06), 0 20px 40px rgba(26,24,20,0.08)',
        xl: '0 10px 20px rgba(26,24,20,0.06), 0 40px 80px rgba(26,24,20,0.12)',
        ring: '0 0 0 3px rgba(192,107,62,0.22)',
      },
      transitionTimingFunction: {
        out:    'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '360ms',
      },
      animation: {
        'fade-up':     'fadeUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-in':     'fadeIn 0.4s ease forwards',
        'slide-right': 'slideRight 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },
      keyframes: {
        fadeUp:     { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:     { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideRight: { '0%': { opacity: '0', transform: 'translateX(-12px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
}
