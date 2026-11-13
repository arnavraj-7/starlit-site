import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The headline is the first thing painted, in Inter's variable (opsz) file: ask for that file in
// the page's head, alongside the CSS, instead of after the CSS has been read.
const preloadHeroFont = () => ({
  name: 'preload-hero-font',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      const f = ctx.bundle && Object.keys(ctx.bundle).find(n => /inter-latin-opsz-normal-[\w-]+\.woff2$/.test(n))
      return f ? html.replace('</title>', `</title>\n    <link rel="preload" as="font" type="font/woff2" href="/${f}" crossorigin />`) : html
    },
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preloadHeroFont()],
})
