import type { Config } from 'tailwindcss'
// @ts-expect-error — preset ships as CJS
import preset from '@speclyy/design-system/tailwind-preset'

const config: Config = {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
  plugins: [],
}

export default config
