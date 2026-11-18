import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string }
  }
}

interface AdSlotProps {
  enabled?: boolean
  variant?: 'banner' | 'card'
  className?: string
  label?: string
}

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT ?? ''
const ADSENSE_SLOT = import.meta.env.VITE_ADSENSE_SLOT ?? ''
const SHOW_PLACEHOLDER = (import.meta.env.VITE_SHOW_AD_PLACEHOLDER ?? '') === 'true'

function isNativeApp(): boolean {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.())
  } catch {
    return false
  }
}

/**
 * 광고 슬롯
 *  - 웹(PWA/Pages): AdSense (<ins class="adsbygoogle">)
 *  - Capacitor 앱: AdMob 배너 자리 (네이티브 플러그인 연결 전에는 빈 영역을 차지하지 않음)
 *  - 미승인/미설정: 레이아웃을 깨지 않는 안내 카드 또는 완전 비활성
 * 승인 전에는 enabled=false 로 두어 사용자 경험을 해치지 않는다.
 */
export default function AdSlot({ enabled = false, variant = 'banner', className = '', label }: AdSlotProps) {
  const insRef = useRef<HTMLModElement | null>(null)
  const [loaded, setLoaded] = useState(false)

  const native = isNativeApp()
  const adsenseReady = Boolean(ADSENSE_CLIENT && ADSENSE_SLOT) && !native

  useEffect(() => {
    if (!enabled || !adsenseReady) return
    const scriptId = 'adsbygoogle-js'
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.async = true
      script.crossOrigin = 'anonymous'
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`
      script.onload = () => setLoaded(true)
      document.head.appendChild(script)
    } else {
      setLoaded(true)
    }
  }, [enabled, adsenseReady])

  useEffect(() => {
    if (!enabled || !adsenseReady || !loaded || !insRef.current) return
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
    } catch {
      /* 광고 스크립트가 차단된 환경(광고차단기·앱 웹뷰)에서는 조용히 무시 */
    }
  }, [enabled, adsenseReady, loaded])

  if (!enabled) return null

  if (adsenseReady) {
    return (
      <div className={className}>
        {label ? <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-300">{label}</p> : null}
        <ins
          ref={insRef}
          className="adsbygoogle block"
          style={{ display: 'block', minHeight: variant === 'banner' ? 90 : 220 }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={ADSENSE_SLOT}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    )
  }

  if (!SHOW_PLACEHOLDER) return null

  return (
    <div
      className={`rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-center ${className}`}
      aria-label="광고·제휴 영역"
    >
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-300">Sponsored</p>
      <p className="mt-1 text-[12px] font-medium text-ink-400">
        {native ? '앱 광고(AdMob) 영역 — 승인 후 표시됩니다' : '광고·제휴 영역 — AdSense 승인 후 표시됩니다'}
      </p>
    </div>
  )
}
