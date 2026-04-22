import preset from '@speclyy/design-system/tailwind-preset'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    './src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
  plugins: [],
}
