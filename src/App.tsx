import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import HomeScreen from './components/HomeScreen'
import PublicDirectory from './components/PublicDirectory'
import SavedScreen from './components/SavedScreen'
import SettingsScreen from './components/SettingsScreen'
import GuidesScreen from './components/GuidesScreen'
import CalculatorsScreen, { type CalcKey } from './components/CalculatorsScreen'
import { CALCULATORS } from './components/CalculatorsScreen'
import AboutScreen from './components/AboutScreen'
import PolicyDetailModal from './components/PolicyDetailModal'
import OnboardingModal from './components/OnboardingModal'
import AuthModal from './components/AuthModal'
import LegalModal, { type LegalKind } from './components/LegalModal'
import { loadMeta, loadPolicies, relativeUpdated } from './lib/data'
import { DEFAULT_PROFILE, judge, scorePolicies } from './lib/matcher'
import {
  clearLocalData,
  loadProfile,
  loadSaved,
  loadSettings,
  persistSaved,
  saveProfile,
  saveSettings,
  setChecklist,
  toggleSavedPolicy,
  type AppSettings,
} from './lib/storage'
import {
  currentCloudStatus,
  fetchCloudProfile,
  fetchCloudSaved,
  pushCloudSaved,
  supabaseEnabled,
  upsertCloudProfile,
  type CloudStatus,
} from './lib/supabase'
import type { Meta, Policy, Profile, Route, SavedEntry } from './lib/types'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function parseHash(): { route: Route; policyId: string | null; guideSlug: string | null; calcKey: CalcKey | null } {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [head, ...rest] = raw.split('/')
  if (head === 'policy' && rest.length)
    return { route: 'home', policyId: decodeURIComponent(rest.join('/')), guideSlug: null, calcKey: null }
  if (head === 'guides') {
    const slug = rest.length ? decodeURIComponent(rest.join('/')) : null
    return { route: 'guides', policyId: null, guideSlug: slug, calcKey: null }
  }
  if (head === 'calculators') {
    const slug = rest.length ? decodeURIComponent(rest.join('/')) : ''
    const match = CALCULATORS.find((item) => item.key === slug)
    return { route: 'calculators', policyId: null, guideSlug: null, calcKey: match ? match.key : null }
  }
  if (head === 'about') return { route: 'about', policyId: null, guideSlug: null, calcKey: null }
  if (head === 'browse' || head === 'saved' || head === 'settings')
    return { route: head, policyId: null, guideSlug: null, calcKey: null }
  return { route: 'home', policyId: null, guideSlug: null, calcKey: null }
}

export default function App() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [profile, setProfile] = useState<Profile>(() => loadProfile())
  const [saved, setSaved] = useState<SavedEntry[]>(() => loadSaved())
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())

  const [route, setRoute] = useState<Route>(() => parseHash().route)
  const [detailId, setDetailId] = useState<string | null>(() => parseHash().policyId)
  const [guideSlug, setGuideSlug] = useState<string | null>(() => parseHash().guideSlug)
  const [calcKey, setCalcKey] = useState<CalcKey | null>(() => parseHash().calcKey)

  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [legal, setLegal] = useState<LegalKind | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [cloud, setCloud] = useState<CloudStatus>({ state: supabaseEnabled ? 'guest' : 'disabled' })
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  const routeRef = useRef<Route>(route)

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2600)
  }, [])

  // ---------------- 데이터 로드 ----------------
  const fetchData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [rows, metaData] = await Promise.all([loadPolicies(), loadMeta()])
      setPolicies(rows)
      setMeta(metaData)
    } catch (error) {
      setLoadError((error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // ---------------- 첫 실행 온보딩 ----------------
  useEffect(() => {
    if (!loading && !profile.done && !settings.hideOnboarding) {
      setShowOnboarding(true)
    }
  }, [loading, profile.done, settings.hideOnboarding])

  // ---------------- 해시 라우팅 ----------------
  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHash()
      if (!parsed.policyId) {
        routeRef.current = parsed.route
        setRoute(parsed.route)
      }
      setGuideSlug(parsed.guideSlug)
      setCalcKey(parsed.calcKey)
      setDetailId(parsed.policyId)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // ---------------- 클라우드 동기화 ----------------
  const refreshCloud = useCallback(async () => {
    const status = await currentCloudStatus()
    setCloud(status)
    if (status.state === 'signed-in' && status.userId) {
      const remoteProfile = await fetchCloudProfile(status.userId)
      const remoteSaved = await fetchCloudSaved(status.userId)
      if (remoteProfile?.done) {
        setProfile((local) => {
          const localTime = local.updatedAt ? Date.parse(local.updatedAt) : 0
          const remoteTime = remoteProfile.updatedAt ? Date.parse(remoteProfile.updatedAt) : 0
          const chosen = remoteTime >= localTime ? remoteProfile : local
          saveProfile(chosen)
          return chosen
        })
      }
      if (remoteSaved.length) {
        setSaved((local) => {
          const map = new Map(local.map((entry) => [entry.id, entry]))
          remoteSaved.forEach((entry) => map.set(entry.id, { ...map.get(entry.id), ...entry }))
          const merged = Array.from(map.values())
          persistSaved(merged)
          return merged
        })
      }
    }
  }, [])

  useEffect(() => {
    void refreshCloud()
  }, [refreshCloud])

  // 프로필·저장 목록 자동 업로드 (로그인 상태에서만, 0.8초 디바운스)
  useEffect(() => {
    if (cloud.state !== 'signed-in' || !cloud.userId) return
    const timer = window.setTimeout(() => {
      void upsertCloudProfile(cloud.userId as string, profile)
      void pushCloudSaved(cloud.userId as string, saved)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [profile, saved, cloud.state, cloud.userId])

  // ---------------- 설치 프롬프트 ----------------
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // ---------------- 파생 데이터 ----------------
  const scored = useMemo(() => (policies.length ? scorePolicies(policies, profile) : []), [policies, profile])
  const policiesById = useMemo(() => new Map(policies.map((policy) => [policy.id, policy])), [policies])
  const savedIds = useMemo(() => new Set(saved.map((entry) => entry.id)), [saved])
  const detailPolicy = detailId ? (policiesById.get(detailId) ?? null) : null
  const detailJudgement = detailPolicy ? judge(detailPolicy, profile) : null
  const detailSaved = detailId ? saved.find((entry) => entry.id === detailId) : undefined

  // ---------------- 핸들러 ----------------
  const openAuth = useCallback((mode: 'signin' | 'signup' = 'signin') => {
    setAuthMode(mode)
    setShowAuth(true)
  }, [])

  const navigate = (next: Route) => {
    routeRef.current = next
    setRoute(next)
    setDetailId(null)
    setGuideSlug(null)
    setCalcKey(null)
    window.location.hash = `#/${next}`
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openCalculator = (key: CalcKey | null) => {
    routeRef.current = 'calculators'
    setRoute('calculators')
    setCalcKey(key)
    setGuideSlug(null)
    setDetailId(null)
    window.location.hash = key ? `#/calculators/${key}` : '#/calculators'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openGuide = (slug: string) => {
    routeRef.current = 'guides'
    setRoute('guides')
    setGuideSlug(slug)
    setCalcKey(null)
    setDetailId(null)
    window.location.hash = `#/guides/${encodeURIComponent(slug)}`
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openPolicy = (id: string) => {
    setDetailId(id)
    window.location.hash = `#/policy/${encodeURIComponent(id)}`
  }

  const closePolicy = () => {
    setDetailId(null)
    window.location.hash = `#/${routeRef.current}`
  }

  const handleSaveProfile = (next: Profile) => {
    setProfile(next)
    saveProfile(next)
    setShowOnboarding(false)
    notify('내 조건을 저장했어요. 추천을 다시 계산했습니다.')
  }

  const handleToggleSave = (id: string) => {
    setSaved((prev) => {
      const next = toggleSavedPolicy(prev, id)
      persistSaved(next)
      return next
    })
  }

  const handleChecklist = (id: string, checklist: Record<string, boolean>) => {
    setSaved((prev) => {
      const exists = prev.some((entry) => entry.id === id)
      const base = exists ? prev : [{ id, savedAt: new Date().toISOString(), checklist: {} }, ...prev]
      const next = setChecklist(base, id, checklist)
      persistSaved(next)
      return next
    })
  }

  const handleClearData = () => {
    clearLocalData()
    setProfile(DEFAULT_PROFILE)
    setSaved([])
    setSettings((prev) => ({ ...prev }))
    notify('이 기기에 저장된 데이터를 모두 지웠습니다.')
  }

  const handleInstall = async () => {
    if (!installEvent) {
      notify('브라우저 메뉴에서 "홈 화면에 추가"를 선택해 주세요.')
      return
    }
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') notify('홈 화면에 추가했어요.')
    setInstallEvent(null)
  }

  const dismissOnboarding = () => {
    setShowOnboarding(false)
    setSettings((prev) => {
      const next = { ...prev, hideOnboarding: true }
      saveSettings(next)
      return next
    })
  }

  // ---------------- 렌더 ----------------
  return (
    <div className="min-h-screen bg-canvas">
      <Header
        profile={profile}
        cloud={cloud}
        route={route}
        updatedLabel={meta ? relativeUpdated(meta.generated_at) : undefined}
        onOpenProfile={() => setShowOnboarding(true)}
        onOpenAuth={openAuth}
      />

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 sm:pb-16">
        {loadError ? (
          <div className="card mx-auto mt-8 max-w-md px-6 py-10 text-center">
            <p className="text-[30px]">📡</p>
            <h2 className="mt-2 text-[16px] font-extrabold text-ink-900">정책 데이터를 불러오지 못했어요</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-400">
              네트워크 상태를 확인한 뒤 다시 시도해 주세요.
              <br />
              <span className="text-ink-300">({loadError})</span>
            </p>
            <button type="button" onClick={() => void fetchData()} className="btn-primary mt-4">
              다시 불러오기
            </button>
          </div>
        ) : route === 'browse' ? (
          <PublicDirectory
            policies={policies}
            meta={meta}
            loading={loading}
            savedIds={savedIds}
            onOpenPolicy={openPolicy}
            onToggleSave={handleToggleSave}
            onOpenGuides={() => navigate('guides')}
            onOpenGuide={openGuide}
          />
        ) : route === 'saved' ? (
          <SavedScreen
            saved={saved}
            policiesById={policiesById}
            onOpenPolicy={openPolicy}
            onRemove={handleToggleSave}
            onGoHome={() => navigate('home')}
            onOpenProfile={() => setShowOnboarding(true)}
          />
        ) : route === 'calculators' ? (
          <CalculatorsScreen
            initial={calcKey ?? undefined}
            onSelect={openCalculator}
            onOpenGuide={openGuide}
            onGoHome={() => navigate('home')}
            onToast={notify}
          />
        ) : route === 'guides' ? (
          <GuidesScreen
            slug={guideSlug}
            onOpenGuide={openGuide}
            onOpenCalculators={() => openCalculator(null)}
            onOpenCalculator={openCalculator}
            onBackToGuides={() => {
              routeRef.current = 'guides'
              setRoute('guides')
              setGuideSlug(null)
              window.location.hash = '#/guides'
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            onGoHome={() => navigate('home')}
          />
        ) : route === 'about' ? (
          <AboutScreen onOpenGuides={() => navigate('guides')} onOpenGuide={openGuide} />
        ) : route === 'settings' ? (
          <SettingsScreen
            profile={profile}
            meta={meta}
            cloud={cloud}
            savedCount={saved.length}
            canInstall={Boolean(installEvent)}
            onEditProfile={() => setShowOnboarding(true)}
            onOpenAuth={openAuth}
            onOpenGuides={() => navigate('guides')}
            onOpenAbout={() => navigate('about')}
            onOpenLegal={(kind) => setLegal(kind)}
            onClearData={handleClearData}
            onInstall={() => void handleInstall()}
            onToast={notify}
          />
        ) : (
          <HomeScreen
            scored={scored}
            meta={meta}
            profile={profile}
            savedIds={savedIds}
            loading={loading}
            onOpenPolicy={openPolicy}
            onToggleSave={handleToggleSave}
            onEditProfile={() => setShowOnboarding(true)}
            onOpenGuides={() => navigate('guides')}
            onOpenGuide={openGuide}
            onOpenCalculator={() => openCalculator(null)}
          />
        )}

        <footer className="mt-8 border-t border-slate-200/70 pt-4 text-[11px] leading-relaxed text-ink-300">
          <p className="font-semibold text-ink-400">보조금 레이더 · GrantRadar KR</p>
          <p className="mt-1">
            본 서비스는 정부·공공기관 공식 앱이 아닌 민간 정보 매칭 플랫폼이며, 공공데이터 및 각 기관 공개 공고를 기반으로 제공합니다.
            최종 자격·신청은 공식 사이트에서 확인하세요.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <a href="#/about" className="font-semibold hover:text-brand-700">
              서비스 소개
            </a>
            <a href="#/guides" className="font-semibold hover:text-brand-700">
              가이드
            </a>
            <a href="#/calculators" className="font-semibold hover:text-brand-700">
              계산기
            </a>
            <button type="button" onClick={() => setLegal('privacy')} className="font-semibold hover:text-brand-700">
              개인정보처리방침
            </button>
            <button type="button" onClick={() => setLegal('terms')} className="font-semibold hover:text-brand-700">
              이용약관
            </button>
            <a href="#/browse" className="font-semibold hover:text-brand-700">
              분야별 전체 보기
            </a>
          </div>
          <p className="mt-2 text-ink-300">
            문의 <a href="mailto:sasolution.edu@gmail.com" className="underline hover:text-brand-700">sasolution.edu@gmail.com</a>
          </p>
        </footer>
      </main>

      <BottomNav route={route} onChange={(next) => navigate(next)} />

      <PolicyDetailModal
        policy={detailPolicy}
        judgement={detailJudgement}
        savedEntry={detailSaved}
        onClose={closePolicy}
        onToggleSave={handleToggleSave}
        onChecklistChange={handleChecklist}
        onToast={notify}
      />

      <OnboardingModal
        open={showOnboarding}
        initial={profile}
        firstRun={!profile.done}
        onClose={dismissOnboarding}
        onSave={handleSaveProfile}
      />

      <AuthModal
        open={showAuth}
        initialMode={authMode}
        onClose={() => setShowAuth(false)}
        cloud={cloud}
        savedCount={saved.length}
        onAfterAuth={() => void refreshCloud()}
      />

      <LegalModal kind={legal} onClose={() => setLegal(null)} />

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 sm:bottom-8">
          <div className="animate-fade-up rounded-full bg-ink-900/92 px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-pop">
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  )
}
