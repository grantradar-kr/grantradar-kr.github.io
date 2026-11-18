import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** AdSense 게시자(공개) ID — 저장소 기본값. VITE_ADSENSE_CLIENT 가 있으면 그 값을 우선한다. */
const DEFAULT_ADSENSE_CLIENT = 'ca-pub-3631676636047500'

/**
 * AdSense 소유권 확인 메타 태그 + 공식 스크립트 주입.
 *  - index.html 의 <!--ADSENSE_META--> / <!--ADSENSE_SCRIPT--> 를 실제 태그로 치환
 *  - 환경변수가 없으면 기본 게시자 ID 사용 (심사 크롤러가 확인할 수 있도록)
 *  - 스크립트에는 id="adsbygoogle-js" 를 붙여 AdSlot 이 중복 로드하지 않게 한다
 */
function adsensePlugin(client: string): Plugin {
  const pubId = client.startsWith('ca-') ? client.slice(3) : client

  return {
    name: 'grant-radar-adsense',
    transformIndexHtml(html) {
      const meta = `<meta name="google-adsense-account" content="${client}" />`
      const script =
        `<script async id="adsbygoogle-js" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous"></script>`
      return html.replace('<!--ADSENSE_META-->', meta).replace('<!--ADSENSE_SCRIPT-->', script)
    },
    generateBundle() {
      // public/ads.txt 가 있으면 그대로 복사된다. 없을 때만 게시자 ID 로 생성한다.
      if (!pubId || existsSync(resolve(process.cwd(), 'public/ads.txt'))) return
      this.emitFile({
        type: 'asset',
        fileName: 'ads.txt',
        source: `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`,
      })
    },
  }
}

// base: './' → GitHub Pages 하위 경로(/저장소명/)와 Capacitor(file://, https://localhost) 모두에서 동작
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const client = (env.VITE_ADSENSE_CLIENT ?? '').trim() || DEFAULT_ADSENSE_CLIENT
  return {
    base: './',
    plugins: [react(), adsensePlugin(client)],
    build: {
      outDir: 'dist',
      target: 'es2019',
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
          },
        },
      },
    },
    server: {
      port: 5173,
      host: true,
    },
    preview: {
      port: 4173,
    },
  }
})
