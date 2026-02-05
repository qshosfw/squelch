import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { execSync } from "child_process"
import { VitePWA } from 'vite-plugin-pwa'

// Get commit hash
let commitHash = "unknown"
try {
    commitHash = execSync("git rev-parse --short HEAD").toString().trim()
} catch (e) {
    console.warn("Could not get commit hash")
}

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
            manifest: {
                name: 'Squelch',
                short_name: 'Squelch',
                description: 'Quansheng Radio Service Tool',
                theme_color: '#000000',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        })
    ],
    base: "./",
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    define: {
        __COMMIT_HASH__: JSON.stringify(commitHash),
        __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    },
})
