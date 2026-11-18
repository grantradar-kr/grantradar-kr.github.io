import type { Policy } from './types'

/**
 * 공유: 네이티브/모바일이면 OS 공유 시트, 아니면 클립보드 복사.
 * 링크에는 정책 id만 담아 용량을 줄이고, 앱이 열리면 해당 정책을 찾아 보여준다.
 */
export function policyShareUrl(policy: Policy): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/policy/${encodeURIComponent(policy.id)}`
}

export function shareText(policy: Policy): string {
  const lines = [policy.title]
  if (policy.org) lines.push(`주관: ${policy.org}`)
  if (policy.deadline) lines.push(`마감: ${policy.deadline}`)
  lines.push(policyShareUrl(policy))
  return lines.join('\n')
}

export async function sharePolicy(policy: Policy): Promise<'shared' | 'copied' | 'failed'> {
  const text = shareText(policy)
  const shareData = {
    title: `${policy.title} · 보조금 레이더`,
    text,
    url: policyShareUrl(policy),
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(shareData)
      return 'shared'
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'failed'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export function openExternal(url?: string | null): void {
  if (!url) return
  const safe = url.startsWith('http') ? url : `https://${url}`
  window.open(safe, '_blank', 'noopener,noreferrer')
}
