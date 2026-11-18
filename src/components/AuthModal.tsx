import { useState } from 'react'
import Modal, { ModalHeader } from './Modal'
import { signInWithEmail, signOut, signUpWithEmail, supabaseEnabled, type CloudStatus } from '../lib/supabase'

interface Props {
  open: boolean
  onClose: () => void
  cloud: CloudStatus
  savedCount: number
  onAfterAuth: () => void
}

export default function AuthModal({ open, onClose, cloud, savedCount, onAfterAuth }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setMessage(null)
    const result =
      mode === 'signup' ? await signUpWithEmail(email.trim(), password) : await signInWithEmail(email.trim(), password)
    setMessage(result.message)
    setBusy(false)
    if (result.ok && mode === 'signin') {
      onAfterAuth()
      onClose()
    }
  }

  const logout = async () => {
    setBusy(true)
    await signOut()
    setBusy(false)
    onAfterAuth()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="sm" label="계정·동기화">
      <ModalHeader
        title={cloud.state === 'signed-in' ? '계정 · 클라우드 동기화' : '계정 만들기 · 로그인'}
        subtitle={
          supabaseEnabled
            ? '로그인하면 내 조건과 저장한 보조금이 기기를 바꿔도 유지됩니다.'
            : '현재는 서버에 연결되지 않아 이 기기에만 저장됩니다. 로그인 없이도 모든 기능을 쓸 수 있어요.'
        }
        onClose={onClose}
      />

      <div className="px-5 py-4">
        {cloud.state === 'signed-in' ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-brand-50 px-4 py-3.5 ring-1 ring-brand-100">
              <p className="text-[12px] font-bold text-brand-800">로그인됨</p>
              <p className="mt-0.5 text-[14px] font-semibold text-brand-900">{cloud.email}</p>
              <p className="mt-1 text-[11.5px] text-brand-700">내 조건 · 저장 {savedCount}건이 클라우드와 동기화됩니다.</p>
            </div>
            <button type="button" onClick={logout} disabled={busy} className="btn-ghost w-full">
              로그아웃
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex rounded-xl bg-slate-100 p-1">
              {[
                { key: 'signin', label: '로그인' },
                { key: 'signup', label: '회원가입' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setMode(tab.key as 'signin' | 'signup')
                    setMessage(null)
                  }}
                  className={`flex-1 rounded-lg py-2 text-[13px] font-bold transition ${
                    mode === tab.key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <label className="block">
              <span className="text-[12px] font-bold text-ink-500">이메일</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] outline-none focus:border-brand-500"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-bold text-ink-500">비밀번호</span>
              <input
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="6자 이상"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] outline-none focus:border-brand-500"
              />
            </label>

            {message ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] font-medium leading-relaxed text-ink-500">{message}</p>
            ) : null}

            <button
              type="button"
              onClick={submit}
              disabled={busy || !email.includes('@') || password.length < 6}
              className="btn-primary w-full"
            >
              {busy ? '처리 중…' : mode === 'signup' ? '회원가입' : '로그인'}
            </button>

            {!supabaseEnabled && (
              <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-800 ring-1 ring-amber-100">
                서버(Supabase)가 아직 연결되지 않았습니다. 앱은 지금처럼{' '}
                <b>이 기기 저장 모드</b>로 정상 동작하며, 연결 후에는 아래 안내대로 한 번만 로그인하면 기존 저장 목록을 그대로
                올릴 수 있습니다.
              </div>
            )}

            <p className="pt-1 text-center text-[11px] leading-relaxed text-ink-300">
              계속 진행하면 <b>이용약관</b>과 <b>개인정보처리방침</b>에 동의하는 것으로 봅니다. 수집 항목은 이메일과 내가 입력한
              조건뿐이며, 언제든 삭제할 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
