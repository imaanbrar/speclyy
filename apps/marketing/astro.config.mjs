import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'
import vercel from '@astrojs/vercel/static'

// https://astro.build/config
export default defineConfig({
  output: 'static',     // fully static — no server needed
  adapter: vercel(),

  integrations: [
    react(),            // React Islands for interactive sections
    tailwind({
      applyBaseStyles: false,  // we apply base styles in Layout.astro
    }),
  ],

  // Image optimisation — Sharp is used automatically
  image: {
    // Allow optimising images from these external domains
    domains: [],
  },

  // Vercel-specific: enable image service at edge
  vite: {
    ssr: {
      noExternal: ['framer-motion'],
    },
  },
})
