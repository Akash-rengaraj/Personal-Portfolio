import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { BLOG_DIR, loadPosts } from './scripts/blog-source.mjs'

/** Group node_modules into long-cacheable vendor chunks. */
const VENDOR_GROUPS = [
  ['react', /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/],
  ['router', /[\\/]node_modules[\\/](react-router|react-router-dom|@remix-run)[\\/]/],
  ['helmet', /[\\/]node_modules[\\/](react-helmet-async|react-fast-compare|invariant|shallowequal)[\\/]/],
  ['firebase', /[\\/]node_modules[\\/](firebase|@firebase|idb|tslib)[\\/]/],
  ['three', /[\\/]node_modules[\\/]three[\\/]/],
]

const BLOG_MODULE = 'virtual:blog-posts'

/** Exposes the markdown posts as `virtual:blog-posts` with HTML already rendered. */
function blogPosts() {
  const resolvedId = `\0${BLOG_MODULE}`
  return {
    name: 'blog-posts',
    resolveId: (id) => (id === BLOG_MODULE ? resolvedId : undefined),
    async load(id) {
      if (id !== resolvedId) return undefined
      const posts = await loadPosts()
      for (const post of posts) this.addWatchFile(path.join(BLOG_DIR, `${post.slug}.md`))
      // the raw markdown isn't needed in the browser
      return `export default ${JSON.stringify(posts.map(({ body, ...post }) => post))}`
    },
    configureServer(server) {
      server.watcher.add(BLOG_DIR)
      server.watcher.on('all', (_event, file) => {
        if (!file.startsWith(BLOG_DIR)) return
        const mod = server.moduleGraph.getModuleById(resolvedId)
        if (mod) server.reloadModule(mod)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), blogPosts()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // rollup's CJS interop helpers must live with React, or the entry and vendor chunks import each other
          if (id.includes('commonjsHelpers')) return 'react'
          const group = VENDOR_GROUPS.find(([, pattern]) => pattern.test(id))
          return group?.[0]
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
