import { defineConfig } from 'vite'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        code: 'src/code.ts',
        ui: 'src/ui.ts'
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        format: 'es'
      }
    },
    copyPublicDir: false
  },
  server: {
    port: 3001
  },
  plugins: [
    {
      name: 'copy-static-files',
      buildStart() {
        // Ensure dist directory exists
        const distDir = resolve(__dirname, 'dist')
        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true })
        }
      },
      generateBundle() {
        const filesToCopy = [
          { src: 'src/ui.html', dest: 'ui.html' },
          { src: 'manifest.json', dest: 'manifest.json' }
        ]

        let successCount = 0
        let errorCount = 0

        filesToCopy.forEach(({ src, dest }) => {
          const srcPath = resolve(__dirname, src)
          const destPath = resolve(__dirname, 'dist', dest)

          try {
            if (existsSync(srcPath)) {
              copyFileSync(srcPath, destPath)
              console.log(`✅ Copied ${src} → dist/${dest}`)
              successCount++
            } else {
              console.error(`❌ Source file not found: ${src}`)
              errorCount++
            }
          } catch (error) {
            console.error(`❌ Failed to copy ${src}:`, error)
            errorCount++
          }
        })

        if (errorCount > 0) {
          console.warn(`⚠️  ${errorCount} file(s) failлed to copy`)
        } else {
          console.log(`✅ All ${successCount} static files copied successfully`)
        }
      }
    }
  ]
})
