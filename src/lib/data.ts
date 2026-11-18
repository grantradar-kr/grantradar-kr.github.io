import type { Meta, Policy } from './types'

const DATA_BASE = import.meta.env.BASE_URL || './'

let policiesPromise: Promise<Policy[]> | null = null
let metaPromise: Promise<Meta | null> | null = null

function dataUrl(file: string): string {
  const base = DATA_BASE.endsWith('/') ? DATA_BASE : `${DATA_BASE}/`
  return `${base}data/${file}`
}

export async function loadPolicies(): Promise<Policy[]> {
  if (!policiesPromise) {
    policiesPromise = fetch(dataUrl('policies.json'), { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`policies.json ${res.status}`)
        return res.json() as Promise<Policy[]>
      })
      .then((rows) => (Array.isArray(rows) ? rows : []))
      .catch((error) => {
        policiesPromise = null
        throw error
      })
  }
  return policiesPromise
}

export async function loadMeta(): Promise<Meta | null> {
  if (!metaPromise) {
    metaPromise = fetch(dataUrl('meta.json'), { cache: 'no-cache' })
      .then((res) => (res.ok ? (res.json() as Promise<Meta>) : null))
      .catch(() => null)
  }
  return metaPromise
}

export function formatDate(value?: string | null): string {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${Number(y)}.${Number(m)}.${Number(d)}`
}

export function ddayText(policy: Policy): string {
  if (typeof policy.dday === 'number') {
    if (policy.dday < 0) return '마감'
    if (policy.dday === 0) return '오늘 마감'
    return `D-${policy.dday}`
  }
  return policy.is_always === false ? '기간 확인' : '상시'
}

export function deadlineText(policy: Policy): string {
  if (policy.deadline) return `~ ${formatDate(policy.deadline)}`
  return '상시 모집'
}

export function relativeUpdated(iso?: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMin = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (diffMin < 1) return '방금 업데이트'
  if (diffMin < 60) return `${diffMin}분 전 업데이트`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전 업데이트`
  const diffDay = Math.round(diffHour / 24)
  return `${diffDay}일 전 업데이트`
}
