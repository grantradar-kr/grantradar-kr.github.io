import { useEffect, useMemo, useRef, useState } from 'react'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
    adfit?: { destroy?: (unit: string) => void }
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string }
  }
}

interface AdSlotProps {
  /** false 로 두면 아예 렌더하지 않는다. 기본값은 항상 표시(설정에서 끄지 않음). */
  enabled?: boolean
  variant?: 'banner' | 'card'
  className?: string
  label?: string
}

type NetworkKind = 'adsense' | 'adfit' | 'none'

interface AdConfig {
  network: string
  client: string
  slot: string
  unit: string
  width: number
  height: number
}

const env = import.meta.env

/** 공개 게시자 ID — 승인 전이라도 소유권 확인용으로 기본값을 사용한다. */
const DEFAULT_ADSENSE_CLIENT = 'ca-pub-3631676636047500'

const ENV_CONFIG: AdConfig = {
  network: (env.VITE_AD_NETWORK ?? 'auto').trim().toLowerCase() || 'auto',
  client: (env.VITE_ADSENSE_CLIENT ?? '').trim() || DEFAULT_ADSENSE_CLIENT,
  // 슬롯 ID 는 광고 단위를 만든 뒤 넣는다. 비어 있으면 <ins> 를 렌더하지 않는다.
  slot: (env.VITE_ADSENSE_SLOT ?? '').trim(),
  unit: (env.VITE_ADFIT_UNIT ?? '').trim(),
  width: Number(env.VITE_ADFIT_WIDTH ?? 320) || 320,
  height: Number(env.VITE_ADFIT_HEIGHT ?? 100) || 100,
}

const SHOW_PLACEHOLDER = (env.VITE_SHOW_AD_PLACEHOLDER ?? '') === 'true'

let runtimeConfigPromise: Promise<Partial<AdConfig>> | null = null

/**
 * 빌드 없이 광고 단위를 바꿀 수 있도록 public/ad-config.json 을 한 번 읽는다.
 * (워크플로 시크릿을 건드리지 않고 AdFit 단위를 추가할 때 사용)
 */
function loadRuntimeConfig(): Promise<Partial<AdConfig>> {
  if (runtimeConfigPromise) return runtimeConfigPromise
  runtimeConfigPromise = (async () => {
    try {
      const url = new URL('ad-config.json', document.baseURI).toString()
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) return {}
      const data = (await response.json()) as Record<string, unknown>
      const next: Partial<AdConfig> = {}
      if (typeof data.network === 'string') next.network = data.network.trim().toLowerCase()
      if (typeof data.adsenseClient === 'string') next.client = data.adsenseClient.trim()
      if (typeof data.adsenseSlot === 'string') next.slot = data.adsenseSlot.trim()
      if (typeof data.adfitUnit === 'string') next.unit = data.adfitUnit.trim()
      if (typeof data.adfitWidth === 'number') next.width = data.adfitWidth
      if (typeof data.adfitHeight === 'number') next.height = data.adfitHeight
      return next
    } catch {
      return {}
    }
  })()
  return runtimeConfigPromise
}

function isNativeApp(): boolean {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.())
  } catch {
    return false
  }
}

function pickNetwork(config: AdConfig, native: boolean): NetworkKind {
  if (native) return 'none'
  const adsenseReady = Boolean(config.client && config.slot)
  const adfitReady = Boolean(config.unit)
  switch (config.network) {
    case 'adsense':
      return adsenseReady ? 'adsense' : 'none'
    case 'adfit':
      return adfitReady ? 'adfit' : 'none'
    case 'none':
      return 'none'
    default:
      // auto: AdSense 가 설정되어 있으면 AdSense, 아니면 AdFit. 두 스크립트를 동시에 넣지 않는다.
      if (adsenseReady) return 'adsense'
      if (adfitReady) return 'adfit'
      return 'none'
  }
}

/**
 * 광고 슬롯
 *  - Google AdSense (VITE_ADSENSE_CLIENT · VITE_ADSENSE_SLOT)
 *  - Kakao AdFit (VITE_ADFIT_UNIT · VITE_ADFIT_WIDTH · VITE_ADFIT_HEIGHT)
 *  - 환경변수가 없으면 public/ad-config.json 값을 사용
 *  - 설정된 광고 네트워크가 없으면 아무것도 렌더하지 않아 빈 박스로 레이아웃을 해치지 않는다.
 *  - Capacitor 네이티브 앱에서는 웹 광고 스크립트를 넣지 않는다(AdMob 연결 지점).
 */
export default function AdSlot({ enabled = true, variant = 'banner', className = '', label }: AdSlotProps) {
  const insRef = useRef<HTMLModElement | null>(null)
  const [config, setConfig] = useState<AdConfig>(ENV_CONFIG)
  const [scriptReady, setScriptReady] = useState(false)

  const native = useMemo(() => isNativeApp(), [])

  // 런타임 설정 (없으면 환경변수 값 유지)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    void loadRuntimeConfig().then((runtime) => {
      if (!alive || Object.keys(runtime).length === 0) return
      setConfig((prev) => ({ ...prev, ...runtime }))
    })
    return () => {
      alive = false
    }
  }, [enabled])

  const network = useMemo(() => (enabled ? pickNetwork(config, native) : 'none'), [enabled, config, native])

  // AdSense 스크립트 로드 (한 번만)
  useEffect(() => {
    if (network !== 'adsense') return
    const scriptId = 'adsbygoogle-js'
    const existing = document.getElementById(scriptId)
    if (existing) {
      setScriptReady(true)
      return
    }
    const script = document.createElement('script')
    script.id = scriptId
    script.async = true
    script.crossOrigin = 'anonymous'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.client)}`
    script.onload = () => setScriptReady(true)
    script.onerror = () => setScriptReady(false)
    document.head.appendChild(script)
  }, [network, config.client])

  // AdSense 슬롯 요청
  useEffect(() => {
    if (network !== 'adsense' || !scriptReady || !insRef.current) return
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
    } catch {
      /* 광고 차단기·앱 웹뷰에서는 조용히 무시 */
    }
  }, [network, scriptReady, config.slot])

  // AdFit: ins 가 DOM 에 붙은 뒤 스크립트를 넣어야 ba.min.js 가 슬롯을 찾는다
  useEffect(() => {
    if (network !== 'adfit') return
    const scriptId = 'kakao-adfit-js'
    if (document.getElementById(scriptId)) return
    const script = document.createElement('script')
    script.id = scriptId
    script.async = true
    script.src = 'https://t1.kakaocdn.net/kas/static/ba.min.js'
    document.head.appendChild(script)
  }, [network, config.unit])

  // 슬롯이 사라질 때 AdFit 인스턴스 정리
  useEffect(() => {
    if (network !== 'adfit') return
    const unit = config.unit
    return () => {
      try {
        window.adfit?.destroy?.(unit)
      } catch {
        /* 정리 실패는 무시 — 페이지 전환에는 영향 없음 */
      }
    }
  }, [network, config.unit])

  if (network === 'none') {
    if (!enabled || !SHOW_PLACEHOLDER) return null
    return (
      <div
        className={`rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-center ${className}`}
        aria-label="광고 영역"
      >
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-300">Sponsored</p>
        <p className="mt-1 text-[12px] font-medium text-ink-400">
          {native ? '앱 광고(AdMob) 영역 — 연결 후 표시됩니다' : '광고 영역 — 광고 단위 설정 후 표시됩니다'}
        </p>
      </div>
    )
  }

  return (
    <div className={className} aria-label="광고">
      {label ? (
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-300">{label}</p>
      ) : null}
      {network === 'adsense' ? (
        <ins
          ref={insRef}
          className="adsbygoogle block"
          style={{ display: 'block', minHeight: variant === 'banner' ? 90 : 220 }}
          data-ad-client={config.client}
          data-ad-slot={config.slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <div className={`mx-auto w-full ${variant === 'banner' ? 'max-w-[360px]' : 'max-w-[340px]'}`}>
          <ins
            className="kakao_ad_area"
            style={{ display: 'none' }}
            data-ad-unit={config.unit}
            data-ad-width={String(config.width)}
            data-ad-height={String(config.height)}
          />
        </div>
      )}
    </div>
  )
}
